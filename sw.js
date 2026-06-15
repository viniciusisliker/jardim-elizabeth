/* Jardim Elizabeth — PWA: cache leve + push + atualização */

const CACHE = 'je-shell-v3';
const SHELL = [
  '/',
  '/index.html',
  '/hub',
  '/hub.html',
  '/site.webmanifest',
  '/img/favicon.png',
  '/img/icon.png'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE)
      .then((cache) => cache.addAll(SHELL).catch(() => {}))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys()
      .then((keys) => Promise.all(keys.filter((k) => k !== CACHE).map((k) => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

self.addEventListener('message', (event) => {
  if (event.data?.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

self.addEventListener('push', (event) => {
  let payload = { title: 'Jardim Elizabeth', body: 'Nova notificação no Hub.' };
  try {
    if (event.data) payload = { ...payload, ...event.data.json() };
  } catch { /* use defaults */ }

  const title = payload.title || 'Jardim Elizabeth';
  const options = {
    body: payload.body || '',
    icon: '/img/favicon.png',
    badge: '/img/favicon.png',
    data: { url: payload.url || '/hub.html' },
    tag: payload.tag || 'je-hub-notification'
  };

  event.waitUntil(self.registration.showNotification(title, options));
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const target = event.notification.data?.url || '/hub.html';
  event.waitUntil(
    self.clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(target);
          }
          return undefined;
        }
      }
      if (self.clients.openWindow) {
        return self.clients.openWindow(target);
      }
      return undefined;
    })
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  const sameOrigin = url.origin === self.location.origin;
  const isShell = sameOrigin && (
    SHELL.includes(url.pathname) ||
    url.pathname.endsWith('.css') ||
    url.pathname.endsWith('.js') ||
    url.pathname.startsWith('/img/')
  );

  if (!isShell) {
    event.respondWith(fetch(req));
    return;
  }

  event.respondWith(
    (async () => {
      const cached = await caches.match(req);
      try {
        const res = await fetch(req);
        if (res && res.ok) {
          const copy = res.clone();
          caches.open(CACHE).then((cache) => cache.put(req, copy)).catch(() => {});
        }
        return res;
      } catch {
        if (cached) return cached;
        if (req.mode === 'navigate') {
          const fallback = (await caches.match('/')) || (await caches.match('/index.html'));
          if (fallback) return fallback;
        }
        return new Response('Sem conexão. Tente novamente.', {
          status: 503,
          headers: { 'Content-Type': 'text/plain; charset=utf-8' }
        });
      }
    })()
  );
});
