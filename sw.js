const CACHE_NAME = 'dhaham-pasala-v1';
const assets = [
  './',
  'index.html',
  'styles.css',
  'script.js',
  'manifest.json',
  'logo.png'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(assets);
    })
  );
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});
