// Payload-free Web Push. No food names, meal records, or account identifiers are collected.
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
export async function vapidRequest(endpoint,env,{now=Date.now(),ttl=90}={}){
 const u=pushEndpoint(endpoint);
 const key=await crypto.subtle.importKey('jwk',JSON.parse(env.VAPID_PRIVATE_JWK),{name:'ECDSA',namedCurve:'P-256'},false,['sign']);
 const jwt=jwtPart({typ:'JWT',alg:'ES256'})+'.'+jwtPart({aud:u.origin,exp:Math.floor(now/1000)+12*3600,sub:env.VAPID_SUBJECT});
 const sig=await crypto.subtle.sign({name:'ECDSA',hash:'SHA-256'},key,enc.encode(jwt));
 return new Request(u,{method:'POST',redirect:'error',headers:{
  Authorization:'vapid t='+jwt+'.'+b64(sig)+', k='+env.VAPID_PUBLIC_KEY,TTL:String(ttl),Urgency:'normal',Topic:'fuel-and-flow-gap'
 }});
}
function response(status,body){return body===undefined?new Response(null,{status}):Response.json(body,{status});}
function cors(r,origin){
 const out=new Response(r.body,r);
 out.headers.set('Access-Control-Allow-Origin',origin);
 out.headers.set('Access-Control-Allow-Methods','GET, PUT, DELETE, OPTIONS');
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
  if(path==='/v1/config'&&request.method==='GET')return reply(200,{publicKey:env.VAPID_PUBLIC_KEY});
  const match=/^\/v1\/device\/([0-9a-f]{32})$/.exec(path);
  if(!match||!['PUT','DELETE'].includes(request.method))return reply(404);
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
