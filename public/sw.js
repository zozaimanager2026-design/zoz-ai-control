const CACHE = 'zoz-ai-mobile-v3';
const SHELL = ['/mobile.html', '/manifest.webmanifest', '/icon-192.svg', '/icon-512.svg', '/command-router.js'];
self.addEventListener('install', event => {
  event.waitUntil(caches.open(CACHE).then(cache => cache.addAll(SHELL)).then(() => self.skipWaiting()));
});
self.addEventListener('activate', event => {
  event.waitUntil(caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k)))).then(() => self.clients.claim()));
});
self.addEventListener('fetch', event => {
  const url = new URL(event.request.url);
  if (url.origin !== self.location.origin) return;
  if (event.request.method !== 'GET') return;
  if (url.pathname === '/mobile.html') {
    event.respondWith(fetch(event.request).then(async response => {
      try {
        const html = await response.text();
        const injected = html.replace('</body>', '<script src="/command-router.js"></script></body>');
        const headers = new Headers(response.headers);
        headers.delete('content-encoding');
        headers.delete('content-length');
        return new Response(injected, {status: response.status, statusText: response.statusText, headers});
      } catch (_) { return response; }
    }).catch(() => caches.match(event.request).then(r => r || caches.match('/mobile.html'))));
    return;
  }
  event.respondWith(fetch(event.request).catch(() => caches.match(event.request).then(r => r || caches.match('/mobile.html'))));
});
