// Background Web Push Notification handler for Booyah Win Staff Portal
self.addEventListener('install', function () {
  self.skipWaiting();
});

self.addEventListener('activate', function (event) {
  event.waitUntil(clients.claim());
});

self.addEventListener('push', function (event) {
  let data = {
    title: 'Booyah Win Staff Alert',
    message: 'New operation update received',
    actionUrl: '/matches',
    icon: '/favicon.png',
    badge: '/favicon.png',
    tag: 'booyah-staff-alert',
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
    icon: data.icon || '/favicon.png',
    badge: data.badge || '/favicon.png',
    tag: data.tag || 'booyah-staff-alert',
    renotify: true,
    vibrate: [250, 100, 250],
    data: {
      actionUrl: data.actionUrl || '/matches',
    },
  };

  event.waitUntil(self.registration.showNotification(data.title, options));
});

self.addEventListener('notificationclick', function (event) {
  event.notification.close();

  const targetUrl = event.notification.data?.actionUrl || '/matches';

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

