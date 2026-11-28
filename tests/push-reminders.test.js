import test from 'node:test';
import assert from 'node:assert/strict';
import {generateKeyPairSync,verify} from 'node:crypto';
import {mealGapSchedule,mealGapDetails,deviceTimeZone,pushService,describeReminderSync,reconcilePush,testPushDelivery,PUSH_KEY,readPushPreferences} from '../push-reminders.js';
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
 assert.equal(req.headers.get('TTL'),'55');assert.equal(req.redirect,'manual');assert.equal(await req.text(),'');
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
 listeners.push({data:{json:()=>({kind:'scheduled-test'})},waitUntil:()=>{}});
 assert.equal(shown[0].title,'Fuel & Flow · Test push');
 assert.equal(shown[0].tag,'fuel-and-flow-test-push');
 assert.equal(shown[1].tag,'fuel-and-flow-meal-gap');
 assert.equal(shown[2].title,'Fuel & Flow · Scheduled test');
 assert.equal(shown[2].tag,'fuel-and-flow-scheduled-test');
 assert.equal(shown[1].renotify,true);
});

test('Eastern schedule follows DST and local calendar date while using four elapsed hours',()=>{
 const old=process.env.TZ;
 try{
  process.env.TZ='America/New_York';
  assert.equal(deviceTimeZone(),'America/New_York');
  const state=(key,time)=>({days:{[key]:{meals:[{time}]}}});
  const assertDue=(key,time,now,due)=>assert.equal(
   new Date(mealGapSchedule(state(key,time),new Date(now)).due).toISOString(),due);
  assertDue('2026-01-09','16:00','2026-01-09T22:00:00Z','2026-01-10T01:00:00.000Z');
  assertDue('2026-07-09','16:00','2026-07-09T22:00:00Z','2026-07-10T00:00:00.000Z');
  assertDue('2026-11-01','00:15','2026-11-01T04:16:00Z','2026-11-01T11:00:00.000Z');
  // Fall 01:30 refers to the earlier occurrence, even at 01:15 after the clocks turn back.
  assertDue('2026-11-01','01:30','2026-11-01T06:15:00Z','2026-11-01T11:00:00.000Z');
  assert.equal(mealGapDetails(state('2026-03-08','02:30'),new Date('2026-03-08T08:00:00Z')).reason,'no-timed-meal');
  assert.equal(mealGapDetails(state('2026-07-09','18:00'),new Date('2026-07-10T00:30:00Z')).reason,'quiet-hours');
  assert.equal(mealGapDetails(state('2026-07-09','15:00'),new Date('2026-07-10T00:02:00Z')).reason,'window-passed');
  // After midnight Eastern, yesterday’s log is not a candidate.
  assert.equal(mealGapSchedule(state('2026-07-09','17:00'),new Date('2026-07-10T04:15:00Z')),null);
 }finally{if(old===undefined)delete process.env.TZ;else process.env.TZ=old;}
});
test('relay can arm a valid same-day morning alert more than five hours away',async()=>{
 let received;
 const REMINDERS={idFromName:id=>id,get:()=>({fetch:async(_,opts)=>{
  received=JSON.parse(opts.body);return Response.json({status:'queued',alarmAt:received.due,due:received.due});
 }})};
 const now=Date.now(), due=now+7*3600000;
 const result=await worker.fetch(new Request('https://relay.example/v1/device/'+'1'.repeat(32),{
  method:'PUT',headers:{Origin:env.APP_ORIGIN,Authorization:'Bearer '+env.PAIRING_KEY},
  body:JSON.stringify({endpoint,due,until:due+600000})
 }),{...env,REMINDERS});
 assert.equal(result.status,200);
 assert.deepEqual(await result.json(),{status:'queued',alarmAt:due,due});
 assert.equal(received.due,due);
});
test('Sync renews a vanished native subscription after successful instant test, keeps pairing and queues encrypted schedule',async(t)=>{
 t.mock.timers.enable({apis:['Date'],now:+tDate()});
 const endpointB=endpoint+'-renewed';
 const keys={p256dh:'B'+ 'A'.repeat(86),auth:'Y'.repeat(22)};
 const prefs={enabled:true,url:'https://relay.example.workers.dev',id:'c'.repeat(32),key:env.PAIRING_KEY};
 const store=new Map([[PUSH_KEY,JSON.stringify(prefs)]]),calls=[];
 let sub=null, renewals=0;
 const makeSub=endpoint=>({endpoint,toJSON:()=>({endpoint,keys})});
 sub=makeSub(endpoint);
 const original=Object.fromEntries(['navigator','Notification','PushManager','isSecureContext','location','localStorage','fetch']
  .map(k=>[k,Object.getOwnPropertyDescriptor(globalThis,k)]));
 const reg={scope:'https://shieldss.github.io/Fuel-and-Flow/',active:{postMessage(_data,[port]){port.postMessage({testPush:true,scheduledTest:true});port.close();}},
  pushManager:{getSubscription:async()=>sub,subscribe:async options=>{
   renewals++;assert.equal(options.userVisibleOnly,true);assert.equal(options.applicationServerKey.length,65);
   sub=makeSub(endpointB);return sub;
  }}};
 const put=(key,value)=>Object.defineProperty(globalThis,key,{value,configurable:true,writable:true});
 put('navigator',{onLine:true,serviceWorker:{getRegistration:async scope=>{assert.equal(scope,reg.scope);return reg;}}});
 put('Notification',{permission:'granted',requestPermission(){throw Error('Unexpected permission prompt');}});
 put('PushManager',class {});
 put('isSecureContext',true);
 put('location',{href:reg.scope+'#settings/notifications'});
 put('localStorage',{getItem:key=>store.get(key),setItem:(key,value)=>store.set(key,value)});
 put('fetch',async(url,options)=>{
  const body=options.body?JSON.parse(options.body):null;
  calls.push({url,method:options.method,body});
  if(url.endsWith('/v1/config'))return Response.json({publicKey:env.VAPID_PUBLIC_KEY,testPush:true,scheduledTest:true});
  if(options.method==='POST')return new Response(null,{status:204});
  return Response.json({status:'queued',alarmAt:body.due,due:body.due,last:null});
 });
 try{
  await testPushDelivery();
  assert.equal(renewals,0);
  assert.equal(calls.at(-1).body.endpoint,endpoint);
  sub=null; // Browser drops its native subscription, not our stored consent or settings.
  const state=day(['11:00']), baseline=structuredClone(state);
  const result=await reconcilePush(()=>state,{force:true});
  assert.equal(renewals,1);
  assert.equal(result.server.status,'queued');
  assert.match(describeReminderSync(result),/Browser subscription restored.*queued for/);
  assert.deepEqual(calls.at(-1).body,{endpoint:endpointB,keys,due:+new Date(2026,10,27,15),until:+new Date(2026,10,27,15,10)});
  assert.deepEqual(readPushPreferences(),{...prefs,publicKey:env.VAPID_PUBLIC_KEY});
  assert.deepEqual(state,baseline);
  // Renewing does not require a fresh browser permission prompt or erase local food.
  const before=calls.length;
  await reconcilePush(()=>state);
  assert.equal(calls.length,before);
 }finally{
  for(const [key,descriptor] of Object.entries(original)){
   if(descriptor)Object.defineProperty(globalThis,key,descriptor);else delete globalThis[key];
  }
 }
});
function tDate(){return new Date(2026,10,27,12);}
