self.addEventListener('install', e => self.skipWaiting());
self.addEventListener('activate', e => e.waitUntil(clients.claim()));

self.addEventListener('push', e => {
  const data = e.data.json();
  
  const options = {
    body: data.body,
    icon: 'icon.svg',
    badge: 'icon.svg',
    vibrate: [200, 100, 200, 100, 200, 100, 400], // Makes the phone vibrate strongly
    tag: 'routine-alert', // Overwrites old notifications so they don't stack
    renotify: true, // Makes it vibrate/sound even if a notification is already there
    data: {
      url: self.registration.scope
    },
    actions: [
      { action: 'open', title: 'Open App' }
    ]
  };

  e.waitUntil(
    self.registration.showNotification(data.title, options)
  );
});

self.addEventListener('notificationclick', e => {
  e.notification.close();
  e.waitUntil(
    clients.openWindow(e.notification.data.url)
  );
});
