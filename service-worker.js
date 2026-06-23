// Courtside service worker — lightweight app-shell caching only.
// Does NOT cache Supabase API calls or auth requests, so live data and
// auth always go to the network. Safe, minimal, no offline DB sync.

const CACHE_NAME = 'courtside-shell-v1';
const SHELL_FILES = [
  './index.html',
  './manifest.json',
  './icon-192.png',
  './icon-512.png',
];

// Install: cache the app shell
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(SHELL_FILES))
  );
  self.skipWaiting();
});

// Activate: clean up old caches
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    )
  );
  self.clients.claim();
});

// Fetch strategy:
// - Supabase requests (API, auth, storage) → always network, never cached.
// - Everything else (app shell) → network-first, falling back to cache
//   only if the network request fails (e.g. offline).
self.addEventListener('fetch', (event) => {
  const url = event.request.url;

  // Never intercept Supabase or any cross-origin API/auth traffic.
  if (url.includes('supabase.co') || url.includes('/auth/') || url.includes('/rest/') || url.includes('/storage/')) {
    return; // let the browser handle it normally
  }

  // Only handle GET requests for the app shell.
  if (event.request.method !== 'GET') return;

  event.respondWith(
    fetch(event.request)
      .then((networkResponse) => {
        // Update the cache with the latest shell file in the background.
        const copy = networkResponse.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(event.request, copy));
        return networkResponse;
      })
      .catch(() => caches.match(event.request))
  );
});
