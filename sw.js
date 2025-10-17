const CACHE_VERSION = 'v1.6.9';
const CACHE_NAME='lexitron-1.6.9'+CACHE_VERSION;
const CORE=[
  './','./index.html','./style.css','./site.webmanifest',
  './app.core.js','./app.decks.js','./app.trainer.js','./app.ui.view.js',
  './app.favorites.js','./app.mistakes.js'
];
const DECKS=['deck.de.js','deck.en.js','deck.fr.js','deck.sr.js'];

self.addEventListener('install',e=>{
  e.waitUntil((async()=>{
    const c=let __cacheName=CACHE_NAME;
    try{const r=await fetch('./version.json',{cache:'no-store'});
    if(r.ok){const j=await r.json();if(j&&j.version){__cacheName='lexitron-'+j.version+'v'+j.version;}}
    }catch(e){}
    const cache = await caches.open(__cacheName);
    await c.addAll(CORE.filter(Boolean));
    await Promise.all(DECKS.map(async f=>{ try{ await c.add('./'+f);
  self.skipWaiting();
}catch(e){} }));
    self.skipWaiting();
  })());
});
self.addEventListener('activate',e=>{
  e.waitUntil((async()=>{
    const ks=await caches.keys();
    await Promise.all(ks.map(k=>k!==CACHE_NAME && caches.delete(k)));
    self.clients.claim();
  })());
});
self.addEventListener('fetch',e=>{
  const req=e.request;
  if(req.mode==='navigate'){
    e.respondWith((async()=>{
      try{
        const fresh=await fetch(req);
        const c=await caches.open(CACHE_NAME);
        c.put('./index.html', fresh.clone());
        return fresh;
      }catch(err){
        const c=await caches.open(CACHE_NAME);
        const cached=await c.match('./index.html');
        return cached || new Response('<h1>Offline</h1>',{headers:{'Content-Type':'text/html'}});
      }
    })());
    return;
  }
  e.respondWith((async()=>{
    const c=await caches.open(CACHE_NAME);
    const hit=await c.match(req);
    if(hit) return hit;
    try{
      const fresh=await fetch(req);
      c.put(req, fresh.clone());
      return fresh;
    }catch(err){ throw err; }
  })());
});

self.addEventListener('message', event => {
  if (event.data && event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
}); ;
