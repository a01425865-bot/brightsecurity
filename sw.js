// ============================================================
// BRIGHT SECURITY — Service Worker (sw.js)
// ============================================================
// Provides offline support via a cache-first strategy.
// Caches the app shell on install so the app works without
// a network connection after the first visit.
// ============================================================

const CACHE_NAME = 'bright-security-v1';

// Files to cache for offline use (the app shell)
const APP_SHELL = [
  './',
  './index.html',
  './manifest.json'
];

// External resources to cache (fonts)
const EXTERNAL_RESOURCES = [
  'https://fonts.googleapis.com/css2?family=DM+Sans:ital,wght@0,400;0,500;0,600;0,700&family=Playfair+Display:wght@700;800&display=swap'
];

// ── INSTALL: Pre-cache the app shell ──
self.addEventListener('install', (event) => {
  console.log('[SW] Installing Bright Security service worker...');
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      console.log('[SW] Caching app shell');
      // Cache local files first (these should always succeed)
      return cache.addAll(APP_SHELL).then(() => {
        // Try to cache external resources but don't fail if they're unavailable
        return Promise.allSettled(
          EXTERNAL_RESOURCES.map((url) =>
            cache.add(url).catch((err) => {
              console.warn(`[SW] Could not cache external resource: ${url}`, err);
            })
          )
        );
      });
    })
  );
  // Activate immediately without waiting for old SW to finish
  self.skipWaiting();
});

// ── ACTIVATE: Clean up old caches ──
self.addEventListener('activate', (event) => {
  console.log('[SW] Activating service worker...');
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => {
            console.log(`[SW] Deleting old cache: ${name}`);
            return caches.delete(name);
          })
      );
    })
  );
  // Take control of all open pages immediately
  self.clients.claim();
});

// ── FETCH: Cache-first strategy with network fallback ──
self.addEventListener('fetch', (event) => {
  // Only handle GET requests
  if (event.request.method !== 'GET') return;

  event.respondWith(
    caches.match(event.request).then((cachedResponse) => {
      if (cachedResponse) {
        // Return cached version and update cache in the background
        fetchAndCache(event.request);
        return cachedResponse;
      }

      // Not in cache — fetch from network and cache it
      return fetchAndCache(event.request);
    }).catch(() => {
      // Both cache and network failed — return offline fallback
      if (event.request.destination === 'document') {
        return caches.match('./index.html');
      }
    })
  );
});

// ── Helper: Fetch from network and update cache ──
function fetchAndCache(request) {
  return fetch(request).then((networkResponse) => {
    // Only cache successful responses
    if (networkResponse && networkResponse.status === 200) {
      const responseClone = networkResponse.clone();
      caches.open(CACHE_NAME).then((cache) => {
        cache.put(request, responseClone);
      });
    }
    return networkResponse;
  });
}
