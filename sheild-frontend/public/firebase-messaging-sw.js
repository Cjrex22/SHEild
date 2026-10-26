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

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(self.clients.claim());
});

const messaging = firebase.messaging();

messaging.onBackgroundMessage((payload) => {
  const type = payload.data?.type || '';
  const fromName = payload.data?.fromName || '';
  
  // Create stylized, high-contrast title & body for the service worker alert
  const { title, body } = getFormattedNotification(type, fromName, payload);

  const baseUrl = self.location.origin;
  const notifOptions = {
    body: body,
    icon: baseUrl + '/shield-logo.png',
    badge: baseUrl + '/shield-badge.png',
    vibrate: type === 'sos' ? [400, 150, 400, 150, 400] : [200, 100, 200],
    data: {
      type: type,
      url: getUrlByType(type),
      ...(payload.data || {})
    },
    requireInteraction: type === 'sos',
    tag: type === 'sos' ? 'sos-alert' : undefined,
    renotify: type === 'sos',
    actions: getActionsByType(type)
  };

  self.registration.showNotification(title, notifOptions);
});

function getFormattedNotification(type, name, payload) {
  const who = name || 'Guardian';
  switch (type) {
    case 'sos':
      return {
        title: `🚨 EMERGENCY: ${who} in Danger!`,
        body: payload.notification?.body || `${who} triggered Emergency SOS! Tap to open live tracking.`
      };
    case 'safe':
      return {
        title: `🛡️ SHEild Protection • All Clear`,
        body: `${who} is confirmed safe. Emergency session resolved.`
      };
    case 'circle_add':
      return {
        title: `👥 Guard Circle Request`,
        body: `${who} invited you to connect in their Guard Circle.`
      };
    case 'location':
      return {
        title: `📍 Live Location • ${who}`,
        body: `${who} shared live GPS coordinates with you.`
      };
    case 'bodyguard':
      return {
        title: `🛡️ Digital Bodyguard Alert`,
        body: `${who} activated protective safety watch.`
      };
    default:
      return {
        title: payload.notification?.title || '🛡️ SHEild Safety Alert',
        body: payload.notification?.body || payload.data?.body || 'New safety update received.'
      };
  }
}

function getActionsByType(type) {
  switch (type) {
    case 'sos':
      return [
        { action: 'open_sos', title: '🚨 Open SOS' }
      ];
    case 'circle_add':
      return [
        { action: 'open_circle', title: '👥 View Circle' }
      ];
    case 'location':
      return [
        { action: 'open_map', title: '📍 View Map' }
      ];
    case 'safe':
      return [
        { action: 'open_dash', title: '🛡️ Open SHEild' }
      ];
    default:
      return [];
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
      // Focus existing window or open a new one
      for (const client of clientList) {
        if ('focus' in client) {
          client.focus();
          if ('navigate' in client) {
            return client.navigate(targetUrl);
          }
          return;
        }
      }
      return clients.openWindow(targetUrl);
    })
  );
});
