/* Generated into dist/sw.js by build/sw-plugin.ts. */
const VERSION = '__VERSION__';
const ASSETS = __ASSETS__;
const CACHE = `tally-${VERSION}`;
// Assets are versioned by filename, and a server's Vary header must not block an offline match.
const MATCH = { cacheName: CACHE, ignoreVary: true };

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches
      .open(CACHE)
      .then((cache) => cache.addAll(ASSETS.map((url) => new Request(url, { cache: 'reload' }))))
      .then(() => self.skipWaiting()),
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches
      .keys()
      .then((keys) =>
        Promise.all(keys.filter((key) => key.startsWith('tally-') && key !== CACHE).map((key) => caches.delete(key))),
      )
      .then(() => self.clients.claim()),
  );
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET' || new URL(request.url).origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(caches.match('./', MATCH).then((hit) => hit || fetch(request)));
    return;
  }
  event.respondWith(caches.match(request, MATCH).then((hit) => hit || fetch(request)));
});
