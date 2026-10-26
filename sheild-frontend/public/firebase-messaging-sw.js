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

function extractSenderName(payload) {
  const d = payload.data || {};
  let name = d.fromName || d.name || d.senderName || '';
  if (name && name !== 'Guardian' && name !== 'undefined') {
    return name.trim();
  }

  // Parse from notification body or data body
  const bodyText = payload.notification?.body || d.body || '';
  if (bodyText) {
    const m = bodyText.match(/^([A-Za-z0-9_ -]+?)\s+(?:shared|is\s+now|is\s+safe|is\s+in|triggered|activated|invited)/i);
    if (m && m[1] && m[1].toLowerCase() !== 'guardian') {
      return m[1].trim();
    }
  }

  // Parse from notification title or data title
  const titleText = payload.notification?.title || d.title || '';
  if (titleText) {
    const m = titleText.match(/(?:by|EMERGENCY:\s*|:\s*|•\s*)([A-Za-z0-9_ -]+)/i) || titleText.match(/^([A-Za-z0-9_ -]+)\s+is\s+Safe/i);
    if (m && m[1] && m[1].toLowerCase() !== 'guardian') {
      return m[1].trim();
    }
  }

  return 'Your Contact';
}

messaging.onBackgroundMessage((payload) => {
  const type = payload.data?.type || '';
  const fromName = extractSenderName(payload);
  
  // Create stylized, high-contrast title & body for the service worker alert
  const { title, body } = getFormattedNotification(type, fromName, payload);

  const baseUrl = self.location.origin;
  
  // Build Google Maps URL if coordinates exist
  let mapsUrl = payload.data?.mapsLink || payload.data?.url;
  if (!mapsUrl && payload.data?.lat && payload.data?.lng && payload.data.lat !== '0' && payload.data.lng !== '0') {
    mapsUrl = `https://www.google.com/maps?q=${payload.data.lat},${payload.data.lng}`;
  }

  const notifOptions = {
    body: body,
    icon: baseUrl + '/shield-logo.png',
    badge: baseUrl + '/shield-badge.png',
    vibrate: type === 'sos' ? [400, 150, 400, 150, 400] : [200, 100, 200],
    data: {
      type: type,
      fromName: fromName,
      mapsLink: mapsUrl,
      url: type === 'location' ? (mapsUrl || 'https://www.google.com/maps') : getUrlByType(type),
      ...(payload.data || {})
    },
    requireInteraction: type === 'sos',
    tag: type === 'sos' ? 'sos-alert' : undefined,
    renotify: type === 'sos',
    actions: getActionsByType(type)
  };

  self.registration.showNotification(title, notifOptions);
});

function getFormattedNotification(type, who, payload) {
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
        title: `👥 Guard Circle Request from ${who}`,
        body: `${who} invited you to connect in their Guard Circle.`
      };
    case 'location':
      return {
        title: `📍 Live Location • ${who}`,
        body: `${who} shared live GPS coordinates with you. Tap to view on Google Maps.`
      };
    case 'bodyguard':
      return {
        title: `🛡️ Digital Bodyguard • ${who}`,
        body: `${who} activated protective safety watch.`
      };
    default:
      return {
        title: payload.notification?.title || `🛡️ SHEild Safety Alert • ${who}`,
        body: payload.notification?.body || payload.data?.body || 'New safety update received.'
      };
  }
}

function getActionsByType(type) {
  switch (type) {
    case 'location':
      return [
        { action: 'open_google_maps', title: '🗺️ View on Google Maps' }
      ];
    case 'sos':
      return [
        { action: 'open_sos', title: '🚨 Open SOS' }
      ];
    case 'circle_add':
      return [
        { action: 'open_circle', title: '👥 View Circle' }
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
    case 'location': return 'https://www.google.com/maps';
    default: return '/dashboard';
  }
}

self.addEventListener('notificationclick', (event) => {
  event.notification.close();
  
  const notifData = event.notification.data || {};
  const notifType = notifData.type || '';

  // For location alerts or clicking View on Google Maps, take directly to Google Maps
  if (notifType === 'location' || event.action === 'open_google_maps' || event.action === 'open_map') {
    let mapsUrl = notifData.mapsLink || notifData.url;
    if (!mapsUrl || !mapsUrl.startsWith('http')) {
      if (notifData.lat && notifData.lng && notifData.lat !== '0' && notifData.lng !== '0') {
        mapsUrl = `https://www.google.com/maps?q=${notifData.lat},${notifData.lng}`;
      } else {
        mapsUrl = 'https://www.google.com/maps';
      }
    }
    event.waitUntil(clients.openWindow(mapsUrl));
    return;
  }

  const targetUrl = (notifData.url && notifData.url.startsWith('/')) ? notifData.url : '/dashboard';

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
