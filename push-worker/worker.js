// Meal alerts are payload-free; tests carry an encrypted generic marker. No food names, meal records, or account identifiers are collected.
const enc=new TextEncoder();
const LIMIT=10*60*1000;
const b64=bytes=>btoa(String.fromCharCode(...new Uint8Array(bytes))).replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
const jwtPart=v=>b64(enc.encode(JSON.stringify(v)));

function authorized(request,secret){
 if(!/^[a-f0-9]{64}$/.test(secret||''))return false;
 const received=request.headers.get('Authorization')||'', expected='Bearer '+secret;
 if(received.length!==expected.length)return false;
 let diff=0;
 for(let i=0;i<expected.length;i++)diff|=received.charCodeAt(i)^expected.charCodeAt(i);
 return diff===0;
}
export function pushEndpoint(raw){
 if(typeof raw!=='string'||raw.length>2048)throw Error('Invalid push endpoint.');
 const u=new URL(raw);
 const allowed=u.hostname==='fcm.googleapis.com'||u.hostname==='updates.push.services.mozilla.com'||u.hostname==='push.services.mozilla.com'||u.hostname.endsWith('.push.apple.com')||u.hostname==='web.push.apple.com'||u.hostname==='wns.windows.com'||u.hostname.endsWith('.notify.windows.com');
 if(!allowed||u.protocol!=='https:'||u.port||u.username||u.password||u.hash||u.pathname==='/')throw Error('This browser’s push service is not supported.');
 return u;
}
const unb64=s=>Uint8Array.from(atob(s.replaceAll('-','+').replaceAll('_','/').padEnd(Math.ceil(s.length/4)*4,'=')),c=>c.charCodeAt(0));
const join=(...values)=>{const out=new Uint8Array(values.reduce((n,v)=>n+v.length,0));let i=0;for(const v of values){out.set(v,i);i+=v.length;}return out;};
async function hkdf(secret,salt,info,bits){
 const key=await crypto.subtle.importKey('raw',secret,'HKDF',false,['deriveBits']);
 return new Uint8Array(await crypto.subtle.deriveBits({name:'HKDF',hash:'SHA-256',salt,info},key,bits));
}
// RFC 8291 (Web Push) using the RFC 8188 aes128gcm single final record format.
export async function encodePush(keys,payload){
 const curve={name:'ECDH',namedCurve:'P-256'},salt=crypto.getRandomValues(new Uint8Array(16)),ua=unb64(keys.p256dh);
 const client=await crypto.subtle.importKey('raw',ua,curve,false,[]);
 const server=await crypto.subtle.generateKey(curve,true,['deriveBits']);
 const as=new Uint8Array(await crypto.subtle.exportKey('raw',server.publicKey));
 const shared=new Uint8Array(await crypto.subtle.deriveBits({name:'ECDH',public:client},server.privateKey,256));
 const ikm=await hkdf(shared,unb64(keys.auth),join(enc.encode('WebPush: info\0'),ua,as),256);
 const cek=await hkdf(ikm,salt,enc.encode('Content-Encoding: aes128gcm\0'),128);
 const iv=await hkdf(ikm,salt,enc.encode('Content-Encoding: nonce\0'),96);
 const key=await crypto.subtle.importKey('raw',cek,'AES-GCM',false,['encrypt']);
 const cipher=new Uint8Array(await crypto.subtle.encrypt({name:'AES-GCM',iv},key,join(enc.encode(JSON.stringify(payload)),Uint8Array.of(2))));
 const recordSize=new Uint8Array(4);new DataView(recordSize.buffer).setUint32(0,4096);
 return join(salt,recordSize,Uint8Array.of(as.length),as,cipher);
}
export async function vapidRequest(endpoint,env,{now=Date.now(),ttl=90,testKeys=null}={}){
 const u=pushEndpoint(endpoint);
 const key=await crypto.subtle.importKey('jwk',JSON.parse(env.VAPID_PRIVATE_JWK),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const jwt=jwtPart({typ:'JWT',alg:'ES256'})+'.'+jwtPart({aud:u.origin,exp:Math.floor(now/1000)+12*3600,sub:env.VAPID_SUBJECT});
 const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(jwt));
 // Workers reject redirect:'error' at construction; manual prevents forwarding VAPID credentials.
 return new Request(u,{method:'POST',redirect:'manual',headers:{
  Authorization:'vapid t='+jwt+'.'+b64(sig)+', k='+env.VAPID_PUBLIC_KEY,TTL:String(ttl),Urgency:'normal',Topic:testKeys?'fuel-and-flow-test':'fuel-and-flow-gap',
  ...(testKeys?{'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream'}:{})
 },body:testKeys?await encodePush(testKeys,{kind:'test'}):undefined});
}
function response(status,body){return body===undefined?new Response(null,{status}):Response.json(body,{status});}
function cors(r,origin){
 const out=new Response(r.body,r);
 out.headers.set('Access-Control-Allow-Origin',origin);
 out.headers.set('Access-Control-Allow-Methods','GET, PUT, POST, DELETE, OPTIONS');
 out.headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');
 out.headers.set('Cache-Control','no-store');
 out.headers.set('Vary','Origin');
 return out;
}
export default {
 async fetch(request,env){
  const origin=request.headers.get('Origin'), path=new URL(request.url).pathname;
  if(origin!==env.APP_ORIGIN)return response(403);
  const reply=(status,data)=>cors(response(status,data),origin);
  if(request.method==='OPTIONS')return reply(204);
  if(!authorized(request,env.PAIRING_KEY))return reply(401,{error:'Check the pairing key.'});
  if(!/^[A-Za-z0-9_-]{87}$/.test(env.VAPID_PUBLIC_KEY||'')||!env.VAPID_PRIVATE_JWK||!/^mailto:[^\s@]+@[^\s@]+$/.test(env.VAPID_SUBJECT||''))return reply(503,{error:'The reminder service is not fully configured.'});
  if(path==='/v1/config'&&request.method==='GET')return reply(200,{publicKey:env.VAPID_PUBLIC_KEY,testPush:true});
  const match=/^\/v1\/device\/([0-9a-f]{32})$/.exec(path);
  if(!match||!['PUT','POST','DELETE'].includes(request.method))return reply(404);
  const stub=env.REMINDERS.get(env.REMINDERS.idFromName(match[1]));
  if(request.method==='DELETE')return cors(await stub.fetch('https://internal/cancel',{method:'DELETE'}),origin);
  // Read at most 4 KiB even when Content-Length is missing.
  try{
   if(!request.body)return reply(400,{error:'Missing schedule.'});
   const reader=request.body.getReader(), chunks=[];let n=0;
   for(;;){const x=await reader.read();if(x.done)break;n+=x.value.length;if(n>4096){await reader.cancel();return reply(413);}chunks.push(x.value);}
   const bytes=new Uint8Array(n);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const data=JSON.parse(new TextDecoder().decode(bytes));const now=Date.now();
   const endpoint=pushEndpoint(data.endpoint).href;
   if(request.method==='POST'){
    const keys=data.keys||{};
    if(!/^[A-Za-z0-9_-]{87}$/.test(keys.p256dh||'')||!/^[A-Za-z0-9_-]{22}$/.test(keys.auth||'')||unb64(keys.p256dh)[0]!==4)
     return reply(400,{error:'Invalid test subscription keys.'});
    return cors(await stub.fetch('https://internal/test',{method:'POST',body:JSON.stringify({endpoint,keys:{p256dh:keys.p256dh,auth:keys.auth}})}),origin);
   }
   if(data.due!==null&&(!Number.isSafeInteger(data.due)||data.due<now-LIMIT||data.due>now+5*3600000||!Number.isSafeInteger(data.until)||data.until<=data.due||data.until-data.due>LIMIT))return reply(400,{error:'Invalid reminder time. Check your device clock.'});
   return cors(await stub.fetch('https://internal/schedule',{method:'PUT',body:JSON.stringify({endpoint,due:data.due,until:data.due===null?null:data.until})}),origin);
  }catch{return reply(400,{error:'Invalid browser push subscription or reminder time.'});}
 }
};

export class GapReminder{
 constructor(ctx,env){this.storage=ctx.storage;this.env=env;}
 async fetch(request){
  if(request.method==='DELETE'){
   await this.storage.deleteAlarm();await this.storage.deleteAll();return response(204);
  }
  if(request.method==='POST'){
   const {endpoint,keys}=await request.json();
   const now=Date.now();
   if((await this.storage.get('testAfter')||0)>now)return response(429,{error:'Wait 30 seconds between test pushes.'});
   await this.storage.put('testAfter',now+30000);
   let req;
   try{req=await vapidRequest(endpoint,this.env,{now,ttl:90,testKeys:keys});}
   catch{return response(502,{error:'The reminder server could not prepare an encrypted test push. Check the Worker and its signing configuration.'});}
   try{
    const result=await fetch(req,{signal:AbortSignal.timeout(8000)});
    if(result.ok)return response(204);
    if(result.status===404||result.status===410)return response(409,{error:'The browser subscription has expired. Turn notifications off and back on, then try again.'});
    return response(502,{error:'The push provider rejected the test (HTTP '+result.status+').'});
   }catch{return response(502,{error:'Could not reach the push provider. Try again in 30 seconds.'});}
  }
  const job=await request.json();
  const old=await this.storage.get('job'), sent=await this.storage.get('sent');
  if(job.due===null||sent?.[String(job.due)]&&sent[String(job.due)]>Date.now()){
   await this.storage.deleteAlarm();await this.storage.delete('job');return response(204);
  }
  if(old?.endpoint===job.endpoint&&old.due===job.due&&old.until===job.until&&await this.storage.getAlarm())return response(204);
  await this.storage.put('job',job);
  await this.storage.setAlarm(Math.max(job.due,Date.now()));
  return response(204);
 }
 async alarm(){
  const job=await this.storage.get('job');if(!job)return;
  const now=Date.now();
  if(now<job.due){await this.storage.setAlarm(job.due);return;}
  if(now>=job.until){await this.storage.delete('job');return;}
  const req=await vapidRequest(job.endpoint,this.env,{ttl:Math.max(1,Math.min(120,Math.floor((job.until-now)/1000)))});
  const res=await fetch(req);
  // An HTTP request can change the schedule while the push network call is pending.
  const current=await this.storage.get('job');
  if(current?.due!==job.due||current?.endpoint!==job.endpoint)return;
  if(res.ok){
   const previous=await this.storage.get('sent')||{};
   const recent=Object.fromEntries(Object.entries(previous).filter(([,expires])=>expires>now));
   recent[job.due]=now+24*3600000;
   await this.storage.put('sent',recent);
  }else if(res.status===429||res.status>=500)throw Error('Push temporarily unavailable.');
  // Invalid or revoked endpoint, or successfully sent: stop and drop the saved endpoint.
  await this.storage.delete('job');
 }
}
