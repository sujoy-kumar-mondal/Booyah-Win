// Background Web Push Notification handler for Booyah Win
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
  let data = {
    title: 'Booyah Win',
    message: 'New tournament update or notification received',
    actionUrl: '/notifications',
    icon: '/pwa-192x192.png',
    badge: '/favicon.png',
    tag: 'booyah-win-alert',
  };

  if (event.data) {
    try {
      const json = event.data.json();
      data = { ...data, ...json };
    } catch {
      data.message = event.data.text() || data.message;
    }
  }

  const options = {
    body: data.message,
    icon: data.icon || '/pwa-192x192.png',
    badge: data.badge || '/favicon.png',
    tag: data.tag || 'booyah-win-alert',
    renotify: true,
    vibrate: [200, 100, 200],
    data: {
      actionUrl: data.actionUrl || '/notifications',
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = event.notification.data?.actionUrl || '/notifications';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then(function (clientList) {
      for (let i = 0; i < clientList.length; i++) {
        const client = clientList[i];
        if (client.url && 'focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      if (clients.openWindow) {
        return clients.openWindow(targetUrl);
      }
    })
  );
});

