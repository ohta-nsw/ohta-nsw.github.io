
// シンプルなService Worker（オフラインで最低限読み込めるように）
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open('pwa-bt-v1').then((cache) => cache.addAll([
      './',
      './index.html',
      './app.js',
      './manifest.webmanifest'
    ]))
  );
});

self.addEventListener('fetch', (event) => {
  event.respondWith(
    caches.match(event.request).then(resp => resp || fetch(event.request))
  );
});
