import relay,{GapReminder,vapidRequest} from './worker.js';

const base64url=value=>btoa(String.fromCharCode(...new Uint8Array(value)))
 .replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export {GapReminder};
export default {
 async test(_controller,runtime){
  const signer=await crypto.subtle.generateKey({name:'ECDSA',namedCurve:'P-256'},true,['sign','verify']);
  const env={
   VAPID_PRIVATE_JWK:JSON.stringify(await crypto.subtle.exportKey('jwk',signer.privateKey)),
   VAPID_PUBLIC_KEY:base64url(await crypto.subtle.exportKey('raw',signer.publicKey)),
   VAPID_SUBJECT:'mailto:operator@example.com'
  };
  const subscriber=await crypto.subtle.generateKey({name:'ECDH',namedCurve:'P-256'},true,['deriveBits']);
  const testKeys={
   p256dh:base64url(await crypto.subtle.exportKey('raw',subscriber.publicKey)),
   auth:base64url(crypto.getRandomValues(new Uint8Array(16)))
  };
  // These are only synthetic requests. Never contact a live push provider in this test.
  const endpoint='https://fcm.googleapis.com/fcm/send/synthetic';
  const regular=await vapidRequest(endpoint,env);
  const diagnostic=await vapidRequest(endpoint,env,{testKeys});
  if(regular.redirect!=='manual'||diagnostic.redirect!=='manual')throw Error('Push must not follow redirects.');
  if((await regular.arrayBuffer()).byteLength!==0)throw Error('Meal alert must not carry a payload.');
  if(diagnostic.headers.get('Content-Encoding')!=='aes128gcm'||(await diagnostic.arrayBuffer()).byteLength<=86)
   throw Error('Test payload was not encrypted.');
  const test=(device,endpoint)=>device.fetch(new Request('https://internal/test',{
   method:'POST',body:JSON.stringify({endpoint,keys:testKeys})
  }));
  const device=()=>{
   const data=new Map();
   const storage={get:async key=>data.get(key),put:async(key,value)=>data.set(key,value),
    delete:async key=>data.delete(key)};
   return {data,instance:new GapReminder({storage},env)};
  };
  const d=device(),now=Date.now();
  const due=now-1000;
  const job={endpoint,due,until:now+60000};
  d.data.set('job',job);
  const accepted=await test(d.instance,endpoint);
  if(accepted.status!==204||d.data.get('job')!==job)throw Error('Test failed or changed the meal alarm: '+await accepted.text());
  await d.instance.alarm();
  if(d.data.has('job')||!d.data.get('sent')?.[due])throw Error('Meal alert was not sent.');
  const redirected=await test(device().instance,endpoint+'-redirect');
  if(redirected.status!==502||!(await redirected.text()).includes('HTTP 302'))throw Error('Provider redirect must not be followed.');
  // Exercise the actual SQLite Durable Object and an autonomous alarm (not a direct alarm() call).
  const scope='https://relay.example/v1/device/'+'a'.repeat(32);
  const live=(path,method,body)=>relay.fetch(new Request(scope+path,{
   method,headers:{Authorization:'Bearer '+runtime.PAIRING_KEY,Origin:runtime.APP_ORIGIN},
   ...(body?{body:JSON.stringify(body)}:{})
  }),runtime);
  const get=async(path,method,body)=>{
   const res=await live(path,method,body);
   if(!res.ok)throw Error('Relay returned '+res.status+': '+await res.text());
   return res.json();
  };
  const begin=Date.now();
  const realDue=begin+3500;
  const realEndpoint='https://fcm.googleapis.com/fcm/send/real-alarm';
  const realJob={endpoint:realEndpoint,keys:testKeys,due:realDue,until:realDue+120000};
  const normal=await get('','PUT',realJob);
  if(normal.status!=='queued'||normal.alarmAt!==realDue)throw Error('Expected real DO alarm timestamp.');
  const diagnosticAlarm=await get('/scheduled-test','POST',{endpoint:realEndpoint,keys:testKeys});
  if(diagnosticAlarm.status!=='queued'||diagnosticAlarm.due-begin<60000)
   throw Error('Expected isolated scheduled test to have its own alarm.');
  await scheduler.wait(5000);
  const acceptedNormal=await get('','PUT',realJob);
  if(acceptedNormal.status!=='accepted'||acceptedNormal.last?.httpStatus!==201||acceptedNormal.last.at<realDue)
   throw Error('Expected normal alarm to run autonomously; got '+JSON.stringify(acceptedNormal));
  const stillQueued=await get('/scheduled-test','GET');
  if(stillQueued.status!=='queued'||stillQueued.alarmAt!==diagnosticAlarm.due)
   throw Error('Normal reminder disturbed the diagnostic alarm.');
  await scheduler.wait(Math.max(0,diagnosticAlarm.due-Date.now()+2000));
  const after=await get('/scheduled-test','GET');
  if(after.status!=='idle'||after.last?.status!=='accepted'||after.last?.httpStatus!==201||after.last.at<diagnosticAlarm.due)
   throw Error('Expected diagnostic alarm to run autonomously; got '+JSON.stringify(after));
  const acceptedAgain=await get('','PUT',realJob);
  if(acceptedAgain.status!=='accepted'||acceptedAgain.last?.at!==acceptedNormal.last?.at)
   throw Error('Scheduling or checking a diagnostic changed regular reminder history.');
  const nextDue=Date.now()+3600000;
  await get('','PUT',{endpoint:realEndpoint,keys:testKeys,due:nextDue,until:nextDue+30000});
  const cancelled=await live('','DELETE');
  if(cancelled.status!==204||(await get('/scheduled-test','GET')).last!==null)
   throw Error('Turning reminders off must clear both durable object schedules.');

 }
};
