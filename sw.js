const CACHE='fuel-and-flow-shell-v2-24-13';const FILES=['./','./index.html','./app.js?v=2.24.13','./push-reminders.js?v=2.24.13','./appearance-tools.js?v=2.22.0','./core.js?v=2.22.0','./meal-tools.js?v=2.22.0','./workout-tools.js?v=2.22.0','./grocery-tools.js?v=2.22.0','./swipe-tools.js?v=2.18.1','./nutrition-tools.js?v=2.22.0','./upgrade-tools.js?v=2.22.0','./food-lookup.js?v=2.15.0','./view-tools.js?v=2.18.0','./view-tools.js?v=2.24.13','./hydration-tools.js?v=2.15.0','./version.json','./styles.css?v=2.24.13','./themes.css?v=2.24.13','./fonts/atkinsonhyperlegiblenext.woff2','./fonts/manrope.woff2','./fonts/sourceserif4.woff2','./manifest.webmanifest','./icons/logo.svg','./icons/icon-192.png','./icons/icon-512.png','./icons/maskable-512.png'];
self.addEventListener('install',event=>event.waitUntil(caches.open(CACHE).then(cache=>cache.addAll(FILES.map(url=>new Request(url,{cache:'reload'})))).then(()=>self.skipWaiting())));
self.addEventListener('activate',event=>event.waitUntil(caches.keys().then(keys=>Promise.all(keys.filter(k=>k.startsWith('fuel-and-flow-shell-')&&k!==CACHE).map(k=>caches.delete(k)))).then(()=>self.clients.claim())));
self.addEventListener('fetch',event=>{if(event.request.method!=='GET'||new URL(event.request.url).origin!==self.location.origin)return;event.respondWith(fetch(event.request).then(response=>{if(response.ok&&!response.redirected){const copy=response.clone();caches.open(CACHE).then(cache=>cache.put(event.request,copy));}return response;}).catch(()=>caches.match(event.request).then(cached=>cached||(event.request.mode==='navigate'?caches.match('./index.html'):Response.error()))));});

self.addEventListener('message',event=>{if(event.data?.type==='SKIP_WAITING')self.skipWaiting();if(event.data?.type==='PUSH_TEST_SUPPORT')event.ports[0]?.postMessage({testPush:true,scheduledTest:true});});

self.addEventListener('push',event=>{
 let kind='meal-gap';
 try{kind=event.data?.json()?.kind||kind;}catch{}
 const test=kind==='test',scheduled=kind==='scheduled-test';
 const tag=scheduled?'fuel-and-flow-scheduled-test':test?'fuel-and-flow-test-push':'fuel-and-flow-meal-gap';
 const title=scheduled?'Fuel & Flow · Scheduled test':test?'Fuel & Flow · Test push':'Fuel & Flow · Meal reminder';
 const body=scheduled?'The background alarm fired. Your food log was not changed.':test?'Background push reached this device. Your food log was not changed.':'It has been four hours since your last logged meal. If you already ate, update your log.';
 event.waitUntil(self.registration.showNotification(title,{
  body,icon:'./icons/icon-192.png',badge:'./icons/icon-192.png',tag,renotify:true,
  data:{type:tag}
 }));
});
self.addEventListener('notificationclick',event=>{
 if(!['fuel-and-flow-meal-gap','fuel-and-flow-test-push','fuel-and-flow-scheduled-test'].includes(event.notification.data?.type))return;
 event.notification.close();
 const url=new URL('./',self.registration.scope).href;
 event.waitUntil(clients.matchAll({type:'window',includeUncontrolled:true}).then(list=>{
  const client=list.find(c=>c.url.startsWith(url));
  return client?client.focus():clients.openWindow(url);
 }));
});
