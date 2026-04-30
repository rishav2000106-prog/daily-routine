const CACHE_NAME = 'routineos-v1';
const ASSETS = [
  '/daily-routine/',
  '/daily-routine/index.html',
  '/daily-routine/index.css',
  '/daily-routine/app.js',
  '/daily-routine/icon.svg',
  '/daily-routine/manifest.json'
];

self.addEventListener('install', (e) => {
  e.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(ASSETS))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (e) => {
  e.waitUntil(
    caches.keys().then((keys) => {
      return Promise.all(
        keys.filter(key => key !== CACHE_NAME).map(key => caches.delete(key))
      );
    })
  );
  self.clients.claim();
});

self.addEventListener('fetch', (e) => {
  e.respondWith(
    caches.match(e.request).then((response) => {
      return response || fetch(e.request);
    })
  );
});

self.addEventListener('push', e => {
  const data = e.data.json();
  console.log('Push Received...', data);
  self.registration.showNotification(data.title, {
    body: data.body,
    icon: data.icon,
    vibrate: [200, 100, 200, 100, 200, 100, 200],
    requireInteraction: true
  });
});

self.addEventListener('notificationclick', function(event) {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window' }).then(windowClients => {
      for (let client of windowClients) {
        if (client.url.includes('/daily-routine/') && 'focus' in client) {
          return client.focus();
        }
      }
      if (clients.openWindow) {
        return clients.openWindow('/daily-routine/');
      }
    })
  );
});
