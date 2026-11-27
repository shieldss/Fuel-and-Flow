import {GapReminder,vapidRequest} from './worker.js';

const base64url=value=>btoa(String.fromCharCode(...new Uint8Array(value)))
 .replaceAll('+','-').replaceAll('/','_').replace(/=+$/,'');
export default {
 async test(){
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
 }
};
