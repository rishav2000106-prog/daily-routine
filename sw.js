/* RoutineOS Service Worker — Notifications + Offline Cache */
const CACHE = 'routineos-v2';
const ASSETS = ['/', '/daily-routine/', '/daily-routine/index.html', '/daily-routine/app.js', '/daily-routine/index.css', '/daily-routine/icon.svg'];

self.addEventListener('install', e => {
  self.skipWaiting();
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(ASSETS).catch(()=>{})));
});

self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('fetch', e => {
  e.respondWith(fetch(e.request).catch(() => caches.match(e.request)));
});

/* Push notification from server */
self.addEventListener('push', e => {
  const data = e.data ? e.data.json() : { title: 'RoutineOS', body: 'Time for your routine!' };
  e.waitUntil(self.registration.showNotification(data.title, {
    body: data.body, icon: '/daily-routine/icon.svg', badge: '/daily-routine/icon.svg',
    vibrate: [300, 100, 300, 100, 600], tag: 'routine-alert', renotify: true,
    data: { url: self.registration.scope },
    actions: [{ action: 'open', title: '✅ Open App' }, { action: 'dismiss', title: 'Dismiss' }]
  }));
});

/* Scheduled local notification trigger */
self.addEventListener('message', e => {
  if (e.data && e.data.type === 'ROUTINE_ALERT') {
    self.registration.showNotification('⏰ ' + e.data.name, {
      body: e.data.body || "It's time for your routine!",
      icon: '/daily-routine/icon.svg', badge: '/daily-routine/icon.svg',
      vibrate: [400, 150, 400, 150, 800, 150, 800],
      tag: 'routine-' + e.data.id, renotify: true,
      data: { url: self.registration.scope },
      actions: [{ action: 'done', title: '✅ Mark Done' }, { action: 'snooze', title: '⏱ Snooze 5m' }]
    });
  }
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(clients.matchAll({ type: 'window' }).then(list => {
    if (list.length) return list[0].focus();
    return clients.openWindow(e.notification.data.url);
  }));
});
