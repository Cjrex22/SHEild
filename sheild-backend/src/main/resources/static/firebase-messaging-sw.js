importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-app-compat.js');
importScripts('https://www.gstatic.com/firebasejs/10.12.0/firebase-messaging-compat.js');

firebase.initializeApp({
  apiKey: "AIzaSyDVycmqQCpLQYH22e5hi5hcUFxe3obEDS4",
  authDomain: "sheild-app-prod-1234.firebaseapp.com",
  projectId: "sheild-app-prod-1234",
  storageBucket: "sheild-app-prod-1234.appspot.com",
  messagingSenderId: "296306996390",
  appId: "1:296306996390:web:ca1b7c1141a1cd0f447067"
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const type = payload.data?.type || '';
  const title = payload.notification?.title || getTitleByType(type);
  const body = payload.notification?.body || payload.data?.body || 'You have a new notification.';

  // Determine icon and badge based on type
  let icon = '/sheild-pwa-192.png';
  let badge = '/sheild-pwa-192.png';

  const notifOptions = {
    body: body,
    icon: icon,
    badge: badge,
    vibrate: type === 'sos' ? [300, 100, 300, 100, 300] : [200, 100, 200],
    data: {
      type: type,
      url: getUrlByType(type),
      ...(payload.data || {})
    },
    requireInteraction: type === 'sos',
    tag: type === 'sos' ? 'sos-alert' : undefined,
    renotify: type === 'sos'
  };

  self.registration.showNotification(title, notifOptions);
});

function getTitleByType(type) {
  switch (type) {
    case 'sos': return '🚨 EMERGENCY ALERT';
    case 'safe': return '✅ Safety Update';
    case 'circle_add': return '👥 Guard Circle Invite';
    case 'location': return '📍 Location Shared';
    case 'bodyguard': return '🛡️ Safety Alert';
    default: return '🛡️ SHEild Alert';
  }
}

function getUrlByType(type) {
  switch (type) {
    case 'circle_add': return '/circle';
    case 'location': return '/map';
    default: return '/dashboard';
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  const targetUrl = (event.notification.data && event.notification.data.url) ? event.notification.data.url : '/dashboard';

  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      // Try to find an already-open window and navigate it
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      // No window open — open a new one
      return clients.openWindow(targetUrl);
    })
  );
});
