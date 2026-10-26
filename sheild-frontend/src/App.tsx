import { useEffect, useCallback } from 'react';
import { BrowserRouter, Routes, Route, Navigate } from 'react-router-dom';
import { Toaster } from 'react-hot-toast';
import { auth } from './lib/firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { useAuthStore } from './stores/authStore';
import { api } from './lib/api';
import { collection, onSnapshot, query, orderBy, limit, doc, setDoc } from 'firebase/firestore';
import { db } from './lib/firebase';
import { useNotificationStore } from './stores/notificationStore';
import { usePwaStore, type BeforeInstallPromptEvent } from './stores/pwaStore';
import { useSosStore } from './stores/sosStore';
import { useShakeDetection } from './hooks/useShakeDetection';
import ShakeSOSOverlay from './components/ShakeSOSOverlay';
import { formatLocationName } from './lib/locationHelper';
import { resetFcmRegistration } from './lib/fcm';

import WelcomePage from './pages/auth/WelcomePage';
import SignUpPage from './pages/auth/SignUpPage';
import ProfileSetupPage from './pages/auth/ProfileSetupPage';
import SignInPage from './pages/auth/SignInPage';
import ForgotPasswordPage from './pages/auth/ForgotPasswordPage';

import DashboardPage from './pages/DashboardPage';
import CirclePage from './pages/CirclePage';
import MapPage from './pages/MapPage';
import SettingsPage from './pages/SettingsPage';
import BottomNav from './components/BottomNav';
import SafeZonesPage from './pages/SafeZonesPage';

function ProtectedRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <div>Loading...</div>;
  if (!user) return <Navigate to="/auth/welcome" />;
  return <>{children}</>;
}

function AuthRoute({ children }: { children: React.ReactNode }) {
  const { user, loading } = useAuthStore();
  if (loading) return <div>Loading...</div>;
  if (user) return <Navigate to="/dashboard" />;
  return <>{children}</>;
}

function App() {
  const { user, setUser, setProfile, clearUser } = useAuthStore();
  const { shakeOverlayVisible, setShakeOverlayVisible, setSosActive, setSessionId } = useSosStore();

  // Shake-to-SOS: single mount point for the entire app
  const onShakeConfirmed = useCallback(() => {
    const { sosActive } = useSosStore.getState();
    if (sosActive) return; // Guard: SOS already active
    setShakeOverlayVisible(true);
  }, [setShakeOverlayVisible]);

  useShakeDetection(onShakeConfirmed);

  // Fire the actual SOS when overlay countdown reaches 0
  const handleShakeConfirm = useCallback(async () => {
    setShakeOverlayVisible(false);
    const { sosActive } = useSosStore.getState();
    if (sosActive) return;

    try {
      setSosActive(true);

      // Get current location if available
      let lat = 0, lng = 0, locationName = 'Unknown';
      try {
        const pos = await new Promise<GeolocationPosition>((resolve, reject) => {
          navigator.geolocation.getCurrentPosition(resolve, reject, { timeout: 3000 });
        });
        lat = pos.coords.latitude;
        lng = pos.coords.longitude;
        try {
          const geo = await api.get(`/geocode/reverse?lat=${lat}&lng=${lng}`);
          locationName = formatLocationName(geo?.locationName, lat, lng);
        } catch { /* fallback to 'Unknown' */ }
      } catch { /* geolocation failed, proceed with zeros */ }

      const res = await api.post('/emergency/sos', { lat, lng, locationName });
      setSessionId(res.sessionId);

      // Auto-call police if enabled
      const { autoCallPolice, policeNumber } = useSosStore.getState();
      if (autoCallPolice) {
        setTimeout(() => {
          window.location.href = 'tel:' + (policeNumber || '100');
        }, 2000);
      }
    } catch {
      // SOS trigger failed — keep sosActive true so user sees something happened
    }
  }, [setSosActive, setSessionId, setShakeOverlayVisible]);

  const handleShakeCancel = useCallback(() => {
    setShakeOverlayVisible(false);
  }, [setShakeOverlayVisible]);

  // PWA install prompt capture
  useEffect(() => {
    const { setDeferredPrompt, setInstalled } = usePwaStore.getState();

    // Check if already running as installed PWA
    if (window.matchMedia('(display-mode: standalone)').matches) {
      setInstalled(true);
    }

    const handleBeforeInstall = (e: Event) => {
      e.preventDefault();
      setDeferredPrompt(e as BeforeInstallPromptEvent);
    };
    
    // Check if the global script caught it before React loaded
    if ((window as any).deferredPwaPrompt) {
        setDeferredPrompt((window as any).deferredPwaPrompt);
    }

    const handleAppInstalled = () => {
      setInstalled(true);
      usePwaStore.getState().clearPrompt();
    };

    window.addEventListener('beforeinstallprompt', handleBeforeInstall);
    window.addEventListener('appinstalled', handleAppInstalled);

    return () => {
      window.removeEventListener('beforeinstallprompt', handleBeforeInstall);
      window.removeEventListener('appinstalled', handleAppInstalled);
    };
  }, []);

  useEffect(() => {
    const unsub = onAuthStateChanged(auth, async (firebaseUser) => {
      if (firebaseUser) {
        setUser(firebaseUser);
        try {
          const profile = await api.get('/auth/profile');
          setProfile(profile);
        } catch (e) {
          // profile load failed silently
        }
      } else {
        clearUser();
        resetFcmRegistration(); // Allow re-registration for next user
      }
    });
    return unsub;
  }, [setUser, setProfile, clearUser]);

  useEffect(() => {
    let unsubNotifs: () => void;
    let unsubCircle: () => void;

    if (user?.uid) {
      let circleRecords: Record<string, any> = {};

      const healCircleNotifications = (items: any[], records: Record<string, any>) => {
        if (!user.uid || items.length === 0) return;
        items.forEach(item => {
          const isCircleNotif = item.type === 'circle_add' || item.type === 'circle' || (item.message && item.message.toLowerCase().includes('guard circle'));
          if (!isCircleNotif) return;

          const targetUid = item.fromUid;
          if (targetUid && records[targetUid]) {
            const rec = records[targetUid];
            if (!item.accepted) {
              setDoc(doc(db, 'notifications', user.uid, 'items', item.id), {
                accepted: true,
                read: true
              }, { merge: true }).catch(() => {});
            }
            if (rec.status !== 'accepted' || !rec.accepted) {
              setDoc(doc(db, 'users', user.uid, 'guardCircleDetails', targetUid), {
                status: 'accepted',
                accepted: true,
                connectedAt: new Date()
              }, { merge: true }).catch(() => {});
            }
          }
        });
      };

      const q = query(
        collection(db, 'notifications', user.uid, 'items'),
        orderBy('createdAt', 'desc'),
        limit(50)
      );
      unsubNotifs = onSnapshot(q, (snap) => {
        const items = snap.docs.map(doc => ({ id: doc.id, ...doc.data() })) as any[];
        useNotificationStore.getState().setItems(items);
        healCircleNotifications(items, circleRecords);
      });

      unsubCircle = onSnapshot(collection(db, 'users', user.uid, 'guardCircleDetails'), (snap) => {
        const records: Record<string, any> = {};
        snap.docs.forEach(d => {
          records[d.id] = d.data();
        });
        circleRecords = records;
        const currentItems = useNotificationStore.getState().items;
        healCircleNotifications(currentItems, records);
      });
    }

    return () => {
      if (unsubNotifs) unsubNotifs();
      if (unsubCircle) unsubCircle();
    };
  }, [user]);

  return (
    <BrowserRouter>
      <Toaster position="top-center" toastOptions={{
        style: {
          background: 'var(--c-surface)',
          color: 'var(--c-text-1)',
          border: '1px solid var(--c-border)',
        }
      }} />
      <Routes>
        <Route path="/" element={<Navigate to="/auth/welcome" replace />} />

        {/* Auth Routes */}
        <Route path="/auth/welcome" element={<AuthRoute><WelcomePage /></AuthRoute>} />
        <Route path="/auth/signup" element={<AuthRoute><SignUpPage /></AuthRoute>} />
        <Route path="/auth/profile-setup" element={<ProtectedRoute><ProfileSetupPage /></ProtectedRoute>} />
        <Route path="/auth/signin" element={<AuthRoute><SignInPage /></AuthRoute>} />
        <Route path="/auth/forgot-password" element={<AuthRoute><ForgotPasswordPage /></AuthRoute>} />

        {/* Protected Routes */}
        <Route path="/dashboard" element={<ProtectedRoute><DashboardPage /></ProtectedRoute>} />
        <Route path="/circle" element={<ProtectedRoute><CirclePage /></ProtectedRoute>} />
        <Route path="/map" element={<ProtectedRoute><MapPage /></ProtectedRoute>} />
        <Route path="/safe-zones" element={<ProtectedRoute><SafeZonesPage /></ProtectedRoute>} />
        <Route path="/settings" element={<ProtectedRoute><SettingsPage /></ProtectedRoute>} />
      </Routes>
      <BottomNav />

      {/* Shake-to-SOS Confirmation Overlay — always in tree, portal-rendered */}
      <ShakeSOSOverlay
        visible={shakeOverlayVisible}
        onConfirm={handleShakeConfirm}
        onCancel={handleShakeCancel}
      />
    </BrowserRouter>
  );
}

export default App;
