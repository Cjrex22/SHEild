import { getToken, onMessage } from 'firebase/messaging';
import { messaging } from './firebase';
import { api } from './api';
import toast from 'react-hot-toast';

let registeredForUid: string | null = null;
let foregroundListenerSetup = false;

export async function registerFcmToken(uid?: string): Promise<void> {
  try {
    // If already registered for this uid, skip
    if (uid && registeredForUid === uid) return;

    if (!('Notification' in window)) return;
    if (!('serviceWorker' in navigator)) return;

    // Request permission — this is a no-op if already granted/denied
    const permission = await Notification.requestPermission();
    if (permission !== 'granted') {
      console.warn('[FCM] Notification permission not granted:', permission);
      return;
    }

    const registration = await navigator.serviceWorker.ready;

    const vapidKey = import.meta.env.VITE_FIREBASE_VAPID_KEY;
    if (!vapidKey) {
      console.warn('[FCM] VITE_FIREBASE_VAPID_KEY is not set. Push notifications will not work.');
      return;
    }

    if (!messaging) {
      console.warn('[FCM] Messaging not available in this browser.');
      return;
    }

    const token = await getToken(messaging, {
      vapidKey,
      serviceWorkerRegistration: registration
    });

    if (!token) {
      console.warn('[FCM] No FCM token obtained. Push notifications may not work.');
      return;
    }

    await api.post('/settings/fcm-token', { token });
    registeredForUid = uid || 'unknown';
    console.log('[FCM] Token registered successfully.');

  } catch (err: any) {
    console.error('[FCM] Registration failed:', err?.message || err);
  }
}

export function setupForegroundNotifications(): void {
  try {
    if (!messaging) return;
    if (foregroundListenerSetup) return;
    foregroundListenerSetup = true;

    onMessage(messaging, (payload) => {
      const title = payload.notification?.title || 'SHEild Alert';
      const body = payload.notification?.body || '';
      const type = payload.data?.type || '';

      let icon = '🛡️';
      if (type === 'sos') icon = '🚨';
      else if (type === 'safe') icon = '✅';
      else if (type === 'circle_add') icon = '👥';
      else if (type === 'location') icon = '📍';

      toast(body || title, {
        icon,
        duration: type === 'sos' ? 10000 : 6000,
      });
    });
  } catch (err) {
    console.error('[FCM] Foreground listener failed:', err);
  }
}

export function resetFcmRegistration(): void {
  registeredForUid = null;
}
