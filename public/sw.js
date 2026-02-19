
const CACHE_NAME = 'edutrack-static-v1';

// Assets to cache immediately on install
const PRECACHE_URLS = [
  '/',
  '/login',
  '/landing',
  '/manifest.json'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => cache.addAll(PRECACHE_URLS))
      .then(self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.filter((name) => name !== CACHE_NAME).map((name) => caches.delete(name))
      );
    })
  );
});

self.addEventListener('fetch', (event) => {
  // Only handle GET requests for static assets and pages
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        return cachedResponse;
      }

      return fetch(event.request).then((response) => {
        // Don't cache dynamic API calls or Firebase Auth/DB requests
        const url = new URL(event.request.url);
        const shouldCache = 
            response.status === 200 && 
            !url.pathname.startsWith('/api') && 
            !url.hostname.includes('firebase');

        if (shouldCache) {
          const responseToCache = response.clone();
          caches.open(CACHE_NAME).then((cache) => {
            cache.put(event.request, responseToCache);
          });
        }

        return response;
      }).catch(() => {
        // Fallback for when both cache and network fail
        if (event.request.mode === 'navigate') {
          return caches.match('/');
        }
      });
    })
  );
});
