// הר הקופונים — Service Worker
const CACHE_NAME = 'har-hakuponim-v1';
const STATIC_ASSETS = [
  '/har-hakuponim/',
  '/har-hakuponim/index.html',
  '/har-hakuponim/app.js',
  '/har-hakuponim/style.css',
  '/har-hakuponim/manifest.json',
  'https://fonts.googleapis.com/css2?family=Heebo:wght@300;400;500;600;700;800;900&display=swap',
  'https://cdn.jsdelivr.net/npm/jquery@3.7.1/dist/jquery.min.js',
  'https://cdn.jsdelivr.net/npm/papaparse@5.4.1/papaparse.min.js',
  'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.min.js'
];

// Install — cache all static assets
self.addEventListener('install', event => {
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME).then(cache => cache.addAll(STATIC_ASSETS))
  );
});

// Activate — clean old caches
self.addEventListener('activate', event => {
  event.waitUntil(
    caches.keys().then(keys =>
      Promise.all(keys.filter(k => k !== CACHE_NAME).map(k => caches.delete(k)))
    ).then(() => self.clients.claim())
  );
});

// Fetch — cache-first for static, network-first for API
self.addEventListener('fetch', event => {
  const { request } = event;
  // Skip non-GET and chrome-extension requests
  if (request.method !== 'GET' || request.url.startsWith('chrome-extension')) return;

  event.respondWith(
    caches.match(request).then(cached => {
      if (cached) return cached;
      return fetch(request).then(response => {
        if (!response || response.status !== 200 || response.type === 'opaque') return response;
        const clone = response.clone();
        caches.open(CACHE_NAME).then(cache => cache.put(request, clone));
        return response;
      }).catch(() => {
        // Offline fallback for navigation requests
        if (request.destination === 'document') {
          return caches.match('/har-hakuponim/index.html');
        }
      });
    })
  );
});

// Background Sync placeholder
self.addEventListener('sync', event => {
  console.log('Background sync:', event.tag);
});
