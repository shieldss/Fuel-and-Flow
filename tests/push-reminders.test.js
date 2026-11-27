import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {mealGapSchedule,pushService} from '../push-reminders.js';
import worker,{GapReminder,pushEndpoint,vapidRequest} from '../push-worker/worker.js';
import {dateKey} from '../core.js';

const t=(h,m,s=0)=>new Date(2026,10,27,h,m,s);
const day=(times,extra={})=>({days:{[dateKey(t(10,0))]:{meals:times.map(time=>({time})),...extra}}});
test('four-hour schedule uses only today’s latest actual timed meal',()=>{
 const state=day(['08:00','12:00','bad','15:00'],{drinks:[{time:'13:00',calories:100}]});
 state.plans={[dateKey(t(10,0))]:{meals:[{time:'13:00'}]}};
 assert.deepEqual(mealGapSchedule(state,t(14,0)),{due:+t(16,0),until:+t(16,10)});
 assert.deepEqual(mealGapSchedule(state,t(15,1)),{due:+t(19,0),until:+t(19,10)});
 assert.equal(mealGapSchedule(day(['08:00']),t(12,10)),null);
 assert.equal(mealGapSchedule(day(['08:00']),t(12,0)).due,+t(12,0));
 assert.equal(mealGapSchedule(day(['15:00']),t(14,0)),null);
});
test('no alerts before first meal, after cutoff, or after completion',()=>{
 assert.equal(mealGapSchedule(day([], {drinks:[{time:'10:00'}]}),t(14,0)),null);
 assert.equal(mealGapSchedule(day(['12:00'],{complete:true}),t(14,0)),null);
 assert.equal(mealGapSchedule(day(['18:00']),t(20,0)),null);
 assert.equal(mealGapSchedule(day(['17:57']),t(21,58)).until,+t(22,0));
 assert.equal(mealGapSchedule(day(['00:30']),t(1,0)).due,+t(6,0));
});
test('reminder and push endpoints are restricted to HTTPS trusted service hosts',()=>{
 assert.equal(pushService('https://example.workers.dev/'),'https://example.workers.dev');
 for(const u of ['https://example.com','https://evil.workers.dev.example.org','https://a.workers.dev/capture','https://a.workers.dev?x=y','http://a.workers.dev'])assert.throws(()=>pushService(u));
 for(const u of ['http://fcm.googleapis.com/send/a','https://fcm.googleapis.com.evil.example/send/a','https://127.0.0.1/run','https://fcm.googleapis.com:8443/a','https://foo@fcm.googleapis.com/a'])assert.throws(()=>pushEndpoint(u));
});
const {privateKey,publicKey}=generateKeyPairSync('ec',{namedCurve:'prime256v1'});
const jwk=privateKey.export({format:'jwk'});
const env={APP_ORIGIN:'https://shieldss.github.io',PAIRING_KEY:'a'.repeat(64),VAPID_SUBJECT:'mailto:operator@example.com',
 VAPID_PRIVATE_JWK:JSON.stringify(jwk),VAPID_PUBLIC_KEY:Buffer.concat([Buffer.from([4]),Buffer.from(jwk.x,'base64url'),Buffer.from(jwk.y,'base64url')]).toString('base64url')};
const endpoint='https://fcm.googleapis.com/fcm/send/demo';
test('Web Push request has valid ES256 VAPID authentication and no payload',async()=>{
 const req=await vapidRequest(endpoint,env,{ttl:55});
 const [h,p,s]=req.headers.get('Authorization').match(/t=([^,]+)/)[1].split('.');
 const decode=x=>JSON.parse(Buffer.from(x,'base64url').toString());
 assert.equal(decode(h).alg,'ES256');assert.equal(decode(p).aud,'https://fcm.googleapis.com');
 assert.ok(verify('sha256',Buffer.from(h+'.'+p),{key:publicKey,dsaEncoding:'ieee-p1363'},Buffer.from(s,'base64url')));
 assert.equal(req.headers.get('TTL'),'55');assert.equal(req.redirect,'error');assert.equal(await req.text(),'');
});
test('relay rejects missing authorization or different origins; forwards only allowed fields',async()=>{
 let received;
 const config={...env,REMINDERS:{idFromName:name=>name,get:()=>({fetch:async(_,r)=>{received=JSON.parse(r.body);return new Response(null,{status:204});}})}};
 const url='https://push.example/v1/device/'+'b'.repeat(32);
 const body={endpoint,due:Date.now()+60000,until:Date.now()+90000,foodName:'Never send this'};
 const call=(origin,key)=>worker.fetch(new Request(url,{method:'PUT',headers:{Origin:origin,Authorization:'Bearer '+key},body:JSON.stringify(body)}),config);
 assert.equal((await call('https://other.example',env.PAIRING_KEY)).status,403);
 assert.equal((await call(env.APP_ORIGIN,'bad')).status,401);
 assert.equal((await call(env.APP_ORIGIN,env.PAIRING_KEY)).status,204);
 assert.deepEqual(received,{endpoint,due:body.due,until:body.until});
});
test('alarm sends at most once for the same gap and can be cancelled',async()=>{
 const records=new Map();let next=null,deliveries=0;
 const storage={get:async k=>records.get(k),put:async(k,v)=>records.set(k,v),delete:async k=>records.delete(k),deleteAll:async()=>records.clear(),
  getAlarm:async()=>next,setAlarm:async value=>{next=value;},deleteAlarm:async()=>{next=null;}};
 const object=new GapReminder({storage},env), actual=globalThis.fetch;
 globalThis.fetch=async()=>{deliveries++;return new Response(null,{status:201});};
 try{
  const n=Date.now();
  const put=job=>object.fetch(new Request('https://internal/schedule',{method:'PUT',body:JSON.stringify(job)}));
  await put({endpoint,due:n-1000,until:n+3000});assert.ok(next);
  await object.alarm();assert.equal(deliveries,1);assert.equal(records.has('job'),false);
  await put({endpoint,due:n-1000,until:n+3000});assert.equal(next,null);
  await object.alarm();assert.equal(deliveries,1);
  await put({endpoint,due:n+3000,until:n+4000});
  assert.ok(next);
  await object.fetch(new Request('https://internal/cancel',{method:'DELETE'}));
  assert.equal(next,null);assert.equal(records.size,0);
 }finally{globalThis.fetch=actual;}
});
test('test push is encrypted, rate-limited and leaves the meal alarm unchanged',async()=>{
 const records=new Map();
 const storage={get:async k=>records.get(k),put:async(k,v)=>records.set(k,v)};
 const object=new GapReminder({storage},env),actual=globalThis.fetch;
 const config={...env,REMINDERS:{idFromName:name=>name,get:()=>({fetch:(url,opts)=>object.fetch(new Request(url,opts))})}};
 const curve={name:'ECDH',namedCurve:'P-256'};
 const client=await crypto.subtle.generateKey(curve,true,['deriveBits']);
 const ua=Buffer.from(await crypto.subtle.exportKey('raw',client.publicKey));
 const auth=Buffer.from(crypto.getRandomValues(new Uint8Array(16)));
 const job={endpoint,due:Date.now()+120000,until:Date.now()+240000};
 records.set('job',job);
 let sent;
 globalThis.fetch=async req=>{sent=req;return new Response(null,{status:201});};
 const keys={p256dh:ua.toString('base64url'),auth:auth.toString('base64url')};
 const call=(body,key=env.PAIRING_KEY)=>worker.fetch(new Request('https://push.example/v1/device/'+'b'.repeat(32),{method:'POST',
  headers:{Origin:env.APP_ORIGIN,Authorization:'Bearer '+key},body:JSON.stringify(body)}),config);
 try{
  assert.equal((await call({endpoint,keys},'bad')).status,401);
  assert.equal((await call({endpoint:'https://example.com/path',keys})).status,400);
  assert.equal((await call({endpoint,keys:{...keys,auth:'bad'}})).status,400);
  assert.equal((await call({endpoint,keys,foodName:'not transmitted'})).status,204);
  assert.equal(sent.headers.get('Content-Encoding'),'aes128gcm');
  assert.equal(sent.headers.get('Topic'),'fuel-and-flow-test');
  const wire=Buffer.from(await sent.arrayBuffer()),salt=wire.subarray(0,16);
  const as=wire.subarray(21,21+wire[20]);
  const server=await crypto.subtle.importKey('raw',as,curve,false,[]);
  const shared=await crypto.subtle.deriveBits({name:'ECDH',public:server},client.privateKey,256);
  const {hkdfSync,createDecipheriv}=await import('node:crypto');
  const ikm=hkdfSync('sha256',Buffer.from(shared),auth,Buffer.concat([Buffer.from('WebPush: info\0'),ua,as]),32);
  const key=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: aes128gcm\0'),16));
  const nonce=Buffer.from(hkdfSync('sha256',ikm,salt,Buffer.from('Content-Encoding: nonce\0'),12));
  const decipher=createDecipheriv('aes-128-gcm',key,nonce);
  decipher.setAuthTag(wire.subarray(-16));
  const payload=Buffer.concat([decipher.update(wire.subarray(21+wire[20],-16)),decipher.final()]);
  assert.equal(payload.at(-1),2);
  assert.deepEqual(JSON.parse(payload.subarray(0,-1)),{kind:'test'});
  assert.equal((await call({endpoint,keys})).status,429);
  assert.deepEqual(records.get('job'),job);
  assert.equal(records.has('sent'),false);
 }finally{globalThis.fetch=actual;}
});

test('service worker labels test and regular push separately',async()=>{
 const {runInNewContext}=await import('node:vm');
 const {readFile}=await import('node:fs/promises');
 const listeners={}, shown=[];
 runInNewContext(await readFile(new URL('../sw.js',import.meta.url),'utf8'),{self:{
  addEventListener:(type,listener)=>listeners[type]=listener,
  registration:{showNotification:async(title,options)=>shown.push({title,...options})}
 }});
 listeners.push({data:{json:()=>({kind:'test'})},waitUntil:()=>{}});
 listeners.push({waitUntil:()=>{}});
 assert.equal(shown[0].title,'Fuel & Flow · Test push');
 assert.equal(shown[0].tag,'fuel-and-flow-test-push');
 assert.equal(shown[1].tag,'fuel-and-flow-meal-gap');
});
