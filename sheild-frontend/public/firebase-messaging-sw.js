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
  const title = payload.notification?.title || 'SHEild Alert';
  const body = payload.notification?.body || 'You have a new safety alert.';

  self.registration.showNotification(title, {
    body: body,
    icon: '/sheild-pwa-192.png',
    badge: '/sheild-pwa-192.png',
    vibrate: [200, 100, 200],
    data: payload.data || {},
    requireInteraction: payload.data?.type === 'sos'
  });
});

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  event.waitUntil(
    clients.matchAll({ type: 'window', includeUncontrolled: true }).then((clientList) => {
      for (const client of clientList) {
        if (client.url.includes('/dashboard') && 'focus' in client) {
          return client.focus();
        }
      }
      return clients.openWindow('/dashboard');
    })
  );
});
