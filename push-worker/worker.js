// Alerts carry only encrypted generic markers. No food names, meal records, or account identifiers are collected.
const enc=new TextEncoder();
const LIMIT=10*60*1000;
const TEST_DELAY=60000;
const TEST_LIFETIME=5*60000;
const TOPICS={test:'fuel-and-flow-test','scheduled-test':'fuel-flow-scheduled-test','meal-gap':'fuel-and-flow-gap'};
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
export async function vapidRequest(endpoint,env,{now=Date.now(),ttl=90,testKeys=null,keys=testKeys,kind=testKeys?'test':'meal-gap'}={}){
 const u=pushEndpoint(endpoint);
 const key=await crypto.subtle.importKey('jwk',JSON.parse(env.VAPID_PRIVATE_JWK),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const jwt=jwtPart({typ:'JWT',alg:'ES256'})+'.'+jwtPart({aud:u.origin,exp:Math.floor(now/1000)+12*3600,sub:env.VAPID_SUBJECT});
 const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(jwt));
 // Workers reject redirect:'error' at construction; manual prevents forwarding VAPID credentials.
 return new Request(u,{method:'POST',redirect:'manual',headers:{
  Authorization:'vapid t='+jwt+'.'+b64(sig)+', k='+env.VAPID_PUBLIC_KEY,TTL:String(ttl),Urgency:kind==='test'?'normal':'high',Topic:TOPICS[kind],
  ...(keys?{'Content-Encoding':'aes128gcm','Content-Type':'application/octet-stream'}:{})
 },body:keys?await encodePush(keys,{kind}):undefined});
}
function subscriptionKeys(keys){
 if(!/^[A-Za-z0-9_-]{87}$/.test(keys?.p256dh||'')||!/^[A-Za-z0-9_-]{22}$/.test(keys?.auth||'')||unb64(keys.p256dh)[0]!==4)
  throw Error('Invalid subscription keys.');
 return {p256dh:keys.p256dh,auth:keys.auth};
}
function response(status,body){return body===undefined?new Response(null,{status}):Response.json(body,{status});}
function cors(r,origin){
 const out=new Response(r.body,r);
 out.headers.set('Access-Control-Allow-Origin',origin);
 out.headers.set('Access-Control-Allow-Methods','GET, PUT, POST, DELETE, OPTIONS');
 out.headers.set('Access-Control-Allow-Headers','Authorization, Content-Type');
 out.headers.set('Cache-Control','no-store');
 out.headers.set('Access-Control-Max-Age','600');
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
  if(path==='/v1/config'&&request.method==='GET')return reply(200,{publicKey:env.VAPID_PUBLIC_KEY,testPush:true,scheduledTest:true});
  const match=/^\/v1\/device\/([0-9a-f]{32})(\/scheduled-test)?$/.exec(path);
  if(!match)return reply(404);
  const diagnostic=Boolean(match[2]);
  if(!(diagnostic?['GET','POST']:['PUT','POST','DELETE']).includes(request.method))return reply(404);
  const stubFor=name=>env.REMINDERS.get(env.REMINDERS.idFromName(name));
  const stub=stubFor(diagnostic?match[1]+':scheduled-test':match[1]);
  if(request.method==='GET')return cors(await stub.fetch('https://internal/status'),origin);
  if(request.method==='DELETE'){
   const cancel=target=>target.fetch('https://internal/cancel',{method:'DELETE'});
   const results=await Promise.allSettled([cancel(stub),cancel(stubFor(match[1]+':scheduled-test'))]);
   return results.every(result=>result.status==='fulfilled'&&result.value.ok)?reply(204):
    reply(503,{error:'One alarm could not be cleared. Reopen online to try again.'});
  }
  // Read at most 4 KiB even when Content-Length is missing.
  let forward;
  try{
   if(!request.body)return reply(400,{error:'Missing schedule.'});
   const reader=request.body.getReader(), chunks=[];let n=0;
   for(;;){const x=await reader.read();if(x.done)break;n+=x.value.length;if(n>4096){await reader.cancel();return reply(413);}chunks.push(x.value);}
   const bytes=new Uint8Array(n);let offset=0;for(const chunk of chunks){bytes.set(chunk,offset);offset+=chunk.length;}
   const data=JSON.parse(new TextDecoder().decode(bytes));const now=Date.now();
   const endpoint=pushEndpoint(data.endpoint).href;
   if(request.method==='POST'){
    let keys;try{keys=subscriptionKeys(data.keys);}catch{return reply(400,{error:'Invalid browser subscription keys.'});}
    const route=diagnostic?'https://internal/scheduled-test':'https://internal/test';
    forward=[route,{method:'POST',body:JSON.stringify({endpoint,keys})}];
   }else{
    // A midnight meal is quiet until 06:00; the local interval can span seven actual hours on fall-back day.
    if(data.due!==null&&(!Number.isSafeInteger(data.due)||data.due<now-LIMIT||data.due>now+8*3600000||!Number.isSafeInteger(data.until)||data.until<=data.due||data.until-data.due>LIMIT))return reply(400,{error:'Invalid reminder time. Check your device clock.'});
    const keys=data.due!==null&&data.keys!=null?subscriptionKeys(data.keys):null;
    forward=['https://internal/schedule',{method:'PUT',body:JSON.stringify({endpoint,due:data.due,until:data.due===null?null:data.until,...(keys?{keys}:{})})}];
   }
  }catch{return reply(400,{error:'Invalid browser push subscription or reminder time.'});}
  try{return cors(await stub.fetch(...forward),origin);}
  catch{return reply(503,{error:'The Worker could not access its alarm storage. Try Sync now again.'});}
 }
};

export class GapReminder{
 constructor(ctx,env){this.storage=ctx.storage;this.env=env;this.inFlight=null;}
 async status(){
  const job=await this.storage.get('job');
  const last=await this.storage.get('last');
  if(!job)return {status:'idle',last:last??null};
  const alarmAt=await this.storage.getAlarm();
  const sending=this.inFlight?.id===job.id&&this.inFlight?.due===job.due;
  return {status:alarmAt!=null?'queued':sending?'sending':'not-armed',due:job.due,alarmAt:alarmAt??null,last:last??null};
 }
 async arm(job){
  const stored={...job,id:crypto.randomUUID()};
  await this.storage.put('job',stored);
  await this.storage.setAlarm(Math.max(job.due,Date.now()));
  return response(200,await this.status());
 }
 async fetch(request){
  if(request.method==='GET')return response(200,await this.status());
  if(request.method==='DELETE'){
   await this.storage.deleteAlarm();await this.storage.deleteAll();return response(204);
  }
  if(request.method==='POST'){
   const {endpoint,keys}=await request.json();
   const now=Date.now();
   if(new URL(request.url).pathname==='/scheduled-test'){
    if((await this.storage.get('job'))?.until>now||(await this.storage.get('testAfter')||0)>now)
     return response(429,{error:'A scheduled test is already pending. Wait for it, then tap Sync now.'});
    await this.storage.put('testAfter',now+TEST_DELAY);
    return this.arm({endpoint,keys,kind:'scheduled-test',due:now+TEST_DELAY,until:now+TEST_DELAY+TEST_LIFETIME});
   }
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
  if(job.due===null||sent?.[String(job.due)]>Date.now()){
   await this.storage.deleteAlarm();await this.storage.delete('job');
   const current=await this.status();
   return response(200,job.due===null?current:{...current,status:'accepted',due:job.due});
  }
  if(job.until<=Date.now()){
   await this.storage.deleteAlarm();await this.storage.delete('job');
   return response(200,{status:'expired',due:job.due,last:(await this.storage.get('last'))??null});
  }
  if(old?.endpoint===job.endpoint&&old.due===job.due&&old.until===job.until&&old.keys?.auth===job.keys?.auth&&old.keys?.p256dh===job.keys?.p256dh){
   const current=await this.status();
   if(current.status!=='not-armed')return response(200,current);
  }
  return this.arm(job);
 }
 async alarm(info={}){
  const job=await this.storage.get('job');if(!job)return;
  const now=Date.now();
  if(now<job.due){await this.storage.setAlarm(job.due);return;}
  if(now>=job.until){
   await this.storage.put('last',{status:'expired',due:job.due,at:now});
   await this.storage.delete('job');return;
  }
  this.inFlight=job;
  try{
   let req, result;
   try{req=await vapidRequest(job.endpoint,this.env,{
    now, ttl:Math.max(1,Math.floor((job.until-now)/1000)), keys:job.keys??null,kind:job.kind??'meal-gap'
   });}
   catch{return await this.finish(job,'prepare-error',now);}
   if(!await this.isCurrent(job))return;
   try{result=await fetch(req,{signal:AbortSignal.timeout(8000)});}
   catch{
    if(!await this.isCurrent(job))return;
    await this.storage.put('last',{status:'retrying',due:job.due,at:now});
    if(info.retryCount>=6)return await this.finish(job,'network-error',now);
    throw Error('Push provider temporarily unreachable.');
   }
   if(!await this.isCurrent(job))return;
   if(result.ok){
    if(job.kind!=='scheduled-test'){
     const previous=await this.storage.get('sent')||{};
     const recent=Object.fromEntries(Object.entries(previous).filter(([,expires])=>expires>now));
     recent[job.due]=now+24*3600000;
     await this.storage.put('sent',recent);
    }
    return await this.finish(job,'accepted',now,result.status);
   }
   if((result.status===429||result.status>=500)&&!(info.retryCount>=6)){
    await this.storage.put('last',{status:'retrying',due:job.due,at:now,httpStatus:result.status});
    throw Error('Push temporarily unavailable.');
   }
   return await this.finish(job,[404,410].includes(result.status)?'subscription-expired':'provider-error',now,result.status);
  }finally{this.inFlight=null;}
 }
 async isCurrent(job){
  const current=await this.storage.get('job');
  return current!=null&&current.id===job.id&&current.due===job.due&&current.endpoint===job.endpoint;
 }
 async finish(job,status,at,httpStatus){
  if(!await this.isCurrent(job))return;
  await this.storage.put('last',{status,due:job.due,at,...(httpStatus!=null?{httpStatus}:{})});
  await this.storage.delete('job');
 }
}
