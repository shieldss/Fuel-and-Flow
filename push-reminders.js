import {dateKey} from './core.js?v=2.22.0';

export const PUSH_KEY='fuel-and-flow-gap-push-v1';
const WINDOW_MS=10*60000;
const timePattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
export const deviceTimeZone=()=>Intl.DateTimeFormat().resolvedOptions().timeZone||'device local time';
export const formatPushTime=value=>new Intl.DateTimeFormat(undefined,{weekday:'short',hour:'numeric',minute:'2-digit',timeZoneName:'short'}).format(value);
export function mealGapDetails(state,now=new Date()){
 const day=state.days?.[dateKey(now)];
 if(day?.complete)return {gap:null,reason:'completed'};
 let latest=null;
 for(const meal of day?.meals||[]){
  if(typeof meal?.time!=='string'||!timePattern.test(meal.time))continue;
  const [hours,minutes]=meal.time.split(':').map(Number), candidate=new Date(now);
  // A time duplicated at the fall DST change uses the earlier occurrence. A nonexistent time is ignored.
  candidate.setHours(hours,minutes,0,0);
  if(candidate.getHours()!==hours||candidate.getMinutes()!==minutes||candidate>now)continue;
  if(latest===null||candidate>latest)latest=candidate;
 }
 if(latest===null)return {gap:null,reason:'no-timed-meal'};
 const quiet=new Date(now);quiet.setHours(22,0,0,0);
 const morning=new Date(now);morning.setHours(6,0,0,0);
 // Add four elapsed hours, then apply the local calendar day's quiet hours.
 const due=Math.max(+latest+4*3600000,+morning);
 const until=Math.min(due+WINDOW_MS,+quiet);
 if(due>=until)return {gap:null,reason:'quiet-hours'};
 if(+now>=until)return {gap:null,reason:'window-passed'};
 return {gap:{due,until},reason:null};
}
export function mealGapSchedule(state,now=new Date()){return mealGapDetails(state,now).gap;}
const noSchedule={
 completed:'Today’s food log is marked complete.',
 'no-timed-meal':'There’s no timed, eaten meal in today’s log yet.',
 'quiet-hours':'The four-hour gap would end at or after 10 PM.',
 'window-passed':'The alert window for the last meal has already passed.'
};
export function describePushStatus(value,label='Meal-gap alert'){
 if(!value)return '';
 const {status,due,alarmAt,last}=value;
 const time=Number.isSafeInteger(due)?formatPushTime(due):'the scheduled time';
 const lastTime=Number.isSafeInteger(last?.at)?formatPushTime(last.at):'the scheduled time';
 const result=last?.status==='accepted'?'was accepted by the push provider (not proof it displayed on this device)':
  last?.status==='expired'?'expired before a send could finish':
  last?.status==='subscription-expired'?'could not be sent because the browser subscription has expired. Turn notifications off and back on':
  last?.status==='prepare-error'?'could not be prepared by the Worker':
  last?.status==='network-error'?'could not reach the push provider':
  last?.status==='provider-error'?'was rejected by the provider (HTTP '+last.httpStatus+')':
  last?.status==='retrying'?'will retry a temporary delivery error':'';
 const previous=result?' '+label+' last attempt ('+lastTime+'): '+result+'.':'';
 if(status==='queued'&&Number.isSafeInteger(alarmAt))return label+' queued for '+time+'.'+previous;
 if(status==='sending')return label+' is being sent now.';
 if(status==='accepted')return label+' for '+time+' was already accepted by the provider.';
 if(status==='expired')return label+' for '+time+' has expired.'+previous;
 if(status==='not-armed')return label+' was not armed. Tap Sync now to retry.'+previous;
 return previous.trim();
}
export function describeReminderSync(sync){
 if(!sync)return '';
 return (sync.renewed?'Browser subscription restored. ':'')+describeMealSchedule(sync);
}
function describeMealSchedule({gap,reason,server}){
 if(!server)return gap
  ?'Settings synced. Local candidate: '+formatPushTime(gap.due)+'. Update the Worker to confirm the server alarm.'
  :'Settings synced. No meal-gap alert queued. '+noSchedule[reason];
 const details=describePushStatus(server);
 return gap?(details||'The server did not confirm a scheduled alarm. Tap Sync now to recheck.'):
  'No meal-gap alert queued. '+noSchedule[reason]+(details?' '+details:'');
}
export function pushService(value){
 let u;try{u=new URL(String(value).trim());}catch{throw Error('Enter your HTTPS workers.dev URL.');}
 if(u.protocol!=='https:'||u.username||u.password||u.port||u.pathname!=='/'||u.search||u.hash||!u.hostname.endsWith('.workers.dev'))throw Error('Enter your HTTPS workers.dev URL without a path.');
 return u.origin;
}
export function pushSupported(){
 return typeof Notification!=='undefined'&&'PushManager' in globalThis&&'serviceWorker' in navigator&&globalThis.isSecureContext;
}
export function readPushPreferences(){
 try{
  const p=JSON.parse(localStorage.getItem(PUSH_KEY));
  return p&&typeof p==='object'&&p.url&&p.key&&p.id?p:{enabled:false};
 }catch{return {enabled:false};}
}
const save=p=>localStorage.setItem(PUSH_KEY,JSON.stringify(p));
const devicePath=p=>'/v1/device/'+p.id;
const id=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
async function request(p,path,method,body){
 const response=await fetch(p.url+path,{method,cache:'no-store',redirect:'error',credentials:'omit',keepalive:method==='PUT'||method==='DELETE',signal:AbortSignal.timeout(12000),
  headers:{Authorization:'Bearer '+p.key,...(body?{'Content-Type':'application/json'}:{})},body:body?JSON.stringify(body):undefined});
 if(!response.ok){const data=await response.json().catch(()=>({}));throw Error(data.error||'Reminder service returned '+response.status+'.');}
 return response;
}
function appRegistration(){
 const url=new URL('./',location.href);
 return navigator.serviceWorker.getRegistration(url.href).then(reg=>{
  if(!reg?.active||reg.scope!==url.href)throw Error('Reload Fuel & Flow online so its offline worker is active.');
  return reg;
 });
}
function decodePublicKey(key){
 if(!/^[A-Za-z0-9_-]{87}$/.test(key||''))throw Error('The server’s browser push key is invalid.');
 return Uint8Array.from(atob(key.replaceAll('-','+').replaceAll('_','/')+'='),x=>x.charCodeAt(0));
}
function rememberPublicKey(p,publicKey){
 const current=readPushPreferences();
 if(current.enabled&&current.id===p.id&&current.url===p.url&&current.key===p.key&&current.publicKey!==publicKey)
  save({...current,publicKey});
}
async function activeSubscription(reg,p,config=null){
 const existing=await reg.pushManager.getSubscription();
 if(existing)return {sub:existing,renewed:false};
 // The browser may revoke/rotate its native subscription independently of app settings.
 // Recover on the same app registration without touching diary, server identity or pairing.
 const publicKey=config?.publicKey||p.publicKey||(await (await request(p,'/v1/config','GET')).json()).publicKey;
 let sub;
 try{sub=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:decodePublicKey(publicKey)});}
 catch(e){
  sub=await reg.pushManager.getSubscription();
  if(!sub)throw Error('This browser did not renew its push subscription. Reload Fuel & Flow online and tap Sync now. If it still fails, turn notifications off and back on.');
 }
 rememberPublicKey(p,publicKey);
 return {sub,renewed:true};
}
let tail=Promise.resolve(), lastOK='', lastError='', lastSync=null, observer=()=>{};
const serial=fn=>{const task=tail.then(fn);tail=task.catch(()=>{});return task;};
const setError=message=>{lastError=message;observer();};
export function pushError(){return lastError;}
export function latestPushSync(){return lastSync;}
export function onPushStatus(fn){observer=fn;}
function scheduleBody(sub,gap){
 const json=sub.toJSON?.()??{}, keys=json.keys;
 if(gap&&!keys)throw Error('This browser’s push subscription is missing encryption keys. Turn reminders off and back on.');
 return {endpoint:sub.endpoint,due:gap?.due??null,until:gap?.until??null,...(gap?{keys}:{} )};
}
async function putSchedule(p,sub,details){
 const body=scheduleBody(sub,details.gap);
 const response=await request(p,devicePath(p),'PUT',body);
 return {...details,server:response.status===204?null:await response.json(),syncedAt:Date.now()};
}
export function reconcilePush(getState,{force=false}={}){
 if(!pushSupported()||!readPushPreferences().enabled&&!readPushPreferences().cancelPending)return;
 return serial(async()=>{
  const p=readPushPreferences();
  if(!p.enabled&&!p.cancelPending)return;
  try{
   if(!p.enabled){
    const reg=await appRegistration();
    const subscription=await reg.pushManager.getSubscription();
    if(subscription)await subscription.unsubscribe();
    for(const tag of ['fuel-and-flow-meal-gap','fuel-and-flow-scheduled-test'])
     for(const notification of await reg.getNotifications({tag}))notification.close();
    await request(p,devicePath(p),'DELETE');
    if(readPushPreferences().cancelPending)save({...p,cancelPending:false});lastOK='';lastSync=null;setError('');
    return;
   }
   if(Notification.permission!=='granted')throw Error('Allow notifications for Fuel & Flow in your browser, then tap Sync now.');
   const reg=await appRegistration();
   const {sub,renewed}=await activeSubscription(reg,p);
   const details=mealGapDetails(getState()),body=scheduleBody(sub,details.gap);
   const sig=JSON.stringify([p.id,p.url,body]);
   if(!force&&!renewed&&!lastError&&lastOK===sig){lastSync={...lastSync,...details};return lastSync;}
   lastSync={...(await putSchedule(p,sub,details)),renewed};
   if(lastSync.server?.status!=='not-armed')lastOK=sig;
   setError('');return lastSync;
  }catch(err){setError(navigator.onLine===false?'Not synced while offline. Reopen Fuel & Flow online to update the reminder.':err.message);}
 });
}
export async function enablePush(url,key,getState){
 if(!pushSupported())throw Error('This browser does not support Web Push. On iPhone, open Fuel & Flow from the Home Screen.');
 const prev=readPushPreferences();
 const origin=pushService(url),same=prev.url===origin;
 if(!same&&prev.cancelPending)throw Error('Reconnect and let the previous server finish turning off before switching servers.');
 const p={url:origin,key:String(key||'').trim()||(same?prev.key:''),id:same?prev.id:id(),enabled:true,cancelPending:false};
 if(!/^[a-f0-9]{64}$/.test(p.key||''))throw Error('Enter the 64-character pairing key from your Worker setup.');
 // Request permission directly from the Settings submit gesture, before a network round trip.
 if(await Notification.requestPermission()!=='granted')throw Error('Notifications are blocked. Enable them for this site in browser settings.');
 await serial(async()=>{
  const config=await (await request(p,'/v1/config','GET')).json();
  const publicKey=decodePublicKey(config.publicKey);
  p.publicKey=config.publicKey;
  const reg=await appRegistration();
  let sub=await reg.pushManager.getSubscription();
  const currentKey=new Uint8Array(sub?.options?.applicationServerKey??[]);
  if(sub&&(currentKey.length!==publicKey.length||currentKey.some((x,i)=>x!==publicKey[i]))){await sub.unsubscribe();sub=null;}
  sub||=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey});
  const details=mealGapDetails(getState()),body=scheduleBody(sub,details.gap);
  lastSync=await putSchedule(p,sub,details);
  save(p);if(lastSync.server?.status!=='not-armed')lastOK=JSON.stringify([p.id,p.url,body]);setError('');
 });
}
export async function disablePush(){
 if(!pushSupported())return;
 const p=readPushPreferences();
 if(!p.id)return;
 save({...p,enabled:false,cancelPending:true});lastOK='';lastSync=null;setError('');
 await reconcilePush(()=>({}));
}

// The browser-only check works before the optional server upgrade.
export async function testBrowserNotification(){
 if(!pushSupported()||Notification.permission!=='granted')throw Error('Allow notifications for Fuel & Flow in your browser first.');
 const reg=await appRegistration();
 await reg.showNotification('Fuel & Flow · Browser test',{
  body:'This device can display Fuel & Flow notifications. This check does not test background push.',
  icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',tag:'fuel-and-flow-browser-test'
 });
}
export function testPushDelivery({scheduled=false}={}){
 return serial(async()=>{
  const p=readPushPreferences();
  if(!p.enabled)throw Error('Turn on meal-gap notifications first.');
  if(!pushSupported()||Notification.permission!=='granted')throw Error('Allow notifications for Fuel & Flow in your browser first.');
  const reg=await appRegistration();
  const config=await (await request(p,'/v1/config','GET')).json();
  if(scheduled&&config.scheduledTest!==true)throw Error('Update your existing Fuel & Flow Worker to run a scheduled test.');
  if(!scheduled&&config.testPush!==true)throw Error('Update your existing Fuel & Flow Worker to enable test push. Browser test and regular reminders still work without that update.');
  const channel=new MessageChannel();
  const ready=await new Promise(resolve=>{
   const timer=setTimeout(()=>resolve(false),1200);
   channel.port1.onmessage=event=>{clearTimeout(timer);resolve(scheduled?event.data?.scheduledTest===true:event.data?.testPush===true);};
   reg.active.postMessage({type:'PUSH_TEST_SUPPORT'},[channel.port2]);
  }).finally(()=>channel.port1.close());
  if(!ready)throw Error('Reload Fuel & Flow online to activate the app update, then try again.');
  const {sub}=await activeSubscription(reg,p,config);
  rememberPublicKey(p,config.publicKey);
  const response=await request(p,devicePath(p)+(scheduled?'/scheduled-test':''),'POST',sub.toJSON());
  return scheduled?response.json():undefined;
 });
}

export function scheduledPushTestStatus(){
 return serial(async()=>{
  const p=readPushPreferences();
  if(!p.enabled)return null;
  const config=await (await request(p,'/v1/config','GET')).json();
  if(config.scheduledTest!==true)return null;
  return (await request(p,devicePath(p)+'/scheduled-test','GET')).json();
 });
}
