// Bumped so the old cache (which may hold stale API responses from before this fix) gets
// deleted by the cleanup below, rather than sitting around unused.
const CACHE_NAME = 'sflbiotrack-v2';

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(keys.filter((key) => key !== CACHE_NAME).map((key) => caches.delete(key)))
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  if (event.request.method !== 'GET') return;

  // Only ever cache/serve-stale for the app's own files (the JS/CSS/images it needs to
  // boot). Backend API calls must be left completely alone: the app has its own local-first
  // system that already knows how to fall back to correctly-saved data when offline. If this
  // worker silently served an old cached API response instead, the app would have no way to
  // tell that from a real fresh one — it would treat stale data as current and overwrite
  // whatever was correctly saved locally with it.
  if (new URL(event.request.url).origin !== self.location.origin) return;

  event.respondWith(
    caches.open(CACHE_NAME).then((cache) =>
      fetch(event.request)
        .then((response) => {
          cache.put(event.request, response.clone());
          return response;
        })
        .catch(() => cache.match(event.request))
    )
  );
});
