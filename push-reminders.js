import {dateKey} from './core.js?v=2.22.0';

export const PUSH_KEY='fuel-and-flow-gap-push-v1';
const WINDOW_MS=10*60000;
const timePattern=/^(?:[01]\d|2[0-3]):[0-5]\d$/;
const clock=now=>String(now.getHours()).padStart(2,'0')+':'+String(now.getMinutes()).padStart(2,'0');
export function mealGapSchedule(state,now=new Date()){
 const day=state.days?.[dateKey(now)], current=clock(now);
 if(day?.complete)return null;
 let latest='';
 for(const meal of day?.meals||[])if(timePattern.test(meal.time)&&meal.time<=current&&meal.time>latest)latest=meal.time;
 if(!latest)return null;
 const [hours,minutes]=latest.split(':').map(Number);
 const quiet=new Date(now);quiet.setHours(22,0,0,0);
 const morning=new Date(now);morning.setHours(6,0,0,0);
 const last=new Date(now);last.setHours(hours,minutes,0,0);
 // Like the overview, only today's actual timed meals count; don't follow the gap overnight.
 const due=Math.max(+last+4*3600000,+morning);
 const until=Math.min(due+WINDOW_MS,+quiet);
 return due<until&&+now<until?{due,until}:null;
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
 const response=await fetch(p.url+path,{method,cache:'no-store',redirect:'error',credentials:'omit',signal:AbortSignal.timeout(12000),
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
let tail=Promise.resolve(), lastOK='', lastError='', observer=()=>{};
const serial=fn=>{const task=tail.then(fn);tail=task.catch(()=>{});return task;};
const setError=message=>{lastError=message;observer();};
export function pushError(){return lastError;}
export function onPushStatus(fn){observer=fn;}
export function reconcilePush(getState){
 if(!pushSupported()||!readPushPreferences().enabled&&!readPushPreferences().cancelPending)return;
 return serial(async()=>{
  const p=readPushPreferences();
  if(!p.enabled&&!p.cancelPending)return;
  try{
   if(!p.enabled){
    const reg=await appRegistration();
    const subscription=await reg.pushManager.getSubscription();
    if(subscription)await subscription.unsubscribe();
    for(const notification of await reg.getNotifications({tag:'fuel-and-flow-meal-gap'}))notification.close();
    await request(p,devicePath(p),'DELETE');
    if(readPushPreferences().cancelPending)save({...p,cancelPending:false});lastOK='';setError('');
    return;
   }
   if(Notification.permission!=='granted')throw Error('Allow Fuel & Flow notifications in your browser, then turn reminders on again.');
   const reg=await appRegistration();
   const sub=await reg.pushManager.getSubscription();
   if(!sub)throw Error('Turn reminders off and back on to renew this browser’s subscription.');
   const gap=mealGapSchedule(getState());
   const body={endpoint:sub.endpoint,due:gap?.due??null,until:gap?.until??null};
   const sig=JSON.stringify([p.id,p.url,body]);
   if(lastOK===sig)return;
   await request(p,devicePath(p),'PUT',body);lastOK=sig;setError('');
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
  if(!/^[A-Za-z0-9_-]{87}$/.test(config.publicKey||''))throw Error('The server’s browser push key is invalid.');
  const publicKey=Uint8Array.from(atob(config.publicKey.replaceAll('-','+').replaceAll('_','/')+'='),x=>x.charCodeAt(0));
  const reg=await appRegistration();
  let sub=await reg.pushManager.getSubscription();
  const currentKey=new Uint8Array(sub?.options?.applicationServerKey??[]);
  if(sub&&(currentKey.length!==publicKey.length||currentKey.some((x,i)=>x!==publicKey[i]))){await sub.unsubscribe();sub=null;}
  sub||=await reg.pushManager.subscribe({userVisibleOnly:true,applicationServerKey:publicKey});
  const gap=mealGapSchedule(getState()), body={endpoint:sub.endpoint,due:gap?.due??null,until:gap?.until??null};
  try {
   await request(p,devicePath(p),'PUT',body);
   save(p);lastOK=JSON.stringify([p.id,p.url,body]);setError('');
  }catch(err){try{await sub.unsubscribe();}catch{};throw err;}
 });
}
export async function disablePush(){
 if(!pushSupported())return;
 const p=readPushPreferences();
 if(!p.id)return;
 save({...p,enabled:false,cancelPending:true});lastOK='';setError('');
 await reconcilePush(()=>({}));
}
