import { useState, useEffect, useRef } from 'react';
import { useAuthStore } from '../stores/authStore';
import { useSosStore } from '../stores/sosStore';
import { useNotificationStore } from '../stores/notificationStore';
import { api } from '../lib/api';
import { Shield, Bell, MapPin, ShieldCheck, Phone, Smartphone } from 'lucide-react';
import toast from 'react-hot-toast';
import { useNavigate } from 'react-router-dom';

import { db } from '../lib/firebase';
import { collection, onSnapshot, query, orderBy, doc, setDoc } from 'firebase/firestore';
import NotificationPanel from '../components/NotificationPanel';
import QuickDialModal from '../components/QuickDialModal';
import { registerFcmToken, setupForegroundNotifications } from '../lib/fcm';
import { formatLocationName } from '../lib/locationHelper';

export default function DashboardPage() {
    const navigate = useNavigate();
    const { profile } = useAuthStore();
    const { unreadCount } = useNotificationStore();
    const { sosActive, bodyguardActive, setSosActive, setBodyguardActive, setSessionId, setAutoCallPolice, setPoliceNumber, shakeToSosEnabled, toggleShakeSos, permissionState } = useSosStore();

    const [locationName, setLocationName] = useState('Locating...');
    const [coords, setCoords] = useState({ lat: 0, lng: 0 });

    const [isNotifOpen, setIsNotifOpen] = useState(false);
    const [isQuickDialOpen, setIsQuickDialOpen] = useState(false);
    const [quickDials, setQuickDials] = useState<any[]>([]);
    
    const [isLocationLoading, setIsLocationLoading] = useState(false);
    const [isSafeLoading, setIsSafeLoading] = useState(false);
    const [isBodyguardLoading, setIsBodyguardLoading] = useState(false);

    const [isPressing, setIsPressing] = useState(false);
    const pressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
    // Load SOS settings on mount so emergency number is ready before SOS can trigger
    useEffect(() => {
        api.get('/settings').then((settings: any) => {
            setAutoCallPolice(settings?.autoCallPolice ?? true);
            setPoliceNumber(settings?.emergencyNumber || '100');
        }).catch(() => {
            // Fallback defaults already set in store
        });
    }, []);

    useEffect(() => {
        let watchId: number;
        if ("geolocation" in navigator) {
            watchId = navigator.geolocation.watchPosition(async (pos) => {
                const lat = pos.coords.latitude;
                const lng = pos.coords.longitude;
                setCoords({ lat, lng });
                try {
                    const res = await api.get(`/geocode/reverse?lat=${lat}&lng=${lng}`);
                    const normalized = formatLocationName(res?.locationName, lat, lng);
                    setLocationName(normalized);
                } catch (e) {
                    const fallback = formatLocationName(null, lat, lng);
                    setLocationName(fallback !== 'Location unavailable' ? fallback : 'Location unavailable');
                }
            }, () => {
                setLocationName('Location permission denied');
            }, { enableHighAccuracy: true });
        }
        return () => navigator.geolocation.clearWatch(watchId);
    }, []);

    useEffect(() => {
        if (!profile?.uid) return;
        const q = query(collection(db, `users/${profile.uid}/quickDials`), orderBy('createdAt'));
        const unsubscribe = onSnapshot(q, (snapshot) => {
            const data = snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setQuickDials(data);
        });
        return () => unsubscribe();
    }, [profile?.uid]);

    useEffect(() => {
        if (!profile?.uid) return;
        registerFcmToken(profile.uid);
        setupForegroundNotifications();
    }, [profile?.uid]);

    const qdPressTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

    const handleQdDown = (id: string, name: string) => {
        qdPressTimer.current = setTimeout(async () => {
            qdPressTimer.current = null;
            if (window.confirm(`Remove ${name} from Quick Dials?`)) {
                try {
                    await api.delete(`/quick-dials/${id}`);
                    toast.success('Contact removed');
                } catch {
                    toast.error('Failed to remove contact');
                }
            }
        }, 500);
    };

    const handleQdClick = (_e: React.PointerEvent, number: string) => {
        if (qdPressTimer.current) {
            clearTimeout(qdPressTimer.current);
            qdPressTimer.current = null;
            window.location.href = `tel:${number}`;
        }
    };

    // SOS Logic
    const activateSos = async () => {
        if (sosActive) return;
        setIsPressing(false);
        try {
            // Step 1: Show SOS active banner
            setSosActive(true);
            toast.success('SOS Activated! Alerts sent.');

            // Step 2: Call backend to alert Guard Circle
            const res = await api.post('/emergency/sos', { lat: coords.lat, lng: coords.lng, locationName });
            setSessionId(res.sessionId);

            // Step 3: Wait 2 seconds then auto-call if enabled
            const { autoCallPolice: shouldCall, policeNumber: numToCall } = useSosStore.getState();
            if (shouldCall) {
                setTimeout(() => {
                    const number = numToCall || '100';
                    window.location.href = 'tel:' + number;
                }, 2000);
            }
        } catch (e) {
            toast.error('Failed to activate SOS');
        }
    };

    const handlePressStart = () => {
        if (sosActive) return;
        setIsPressing(true);
        const seconds = profile?.settings?.holdCountdown || profile?.settings?.sosCountdownSeconds || 3;
        pressTimer.current = setTimeout(activateSos, seconds * 1000);
    };

    const handlePressEnd = () => {
        setIsPressing(false);
        if (pressTimer.current) clearTimeout(pressTimer.current);
    };

    const handleSafe = async () => {
        if (!window.confirm("Send I'm Safe to your Guard Circle?")) return;
        setIsSafeLoading(true);
        try {
            await api.post('/emergency/safe', { lat: coords.lat, lng: coords.lng, locationName });
            setSosActive(false);
            setBodyguardActive(false);
            setSessionId(null);
            
            toast.success('Guard Circle notified you are safe');
        } catch (e) {
            toast.error('Failed to mark safe');
        } finally {
            setIsSafeLoading(false);
        }
    };

    const toggleBodyguard = async () => {
        setIsBodyguardLoading(true);
        try {
            const willBeActive = !bodyguardActive;
            if (willBeActive) {
                await api.post('/emergency/bodyguard', { lat: coords.lat, lng: coords.lng, locationName });
                toast.success('Guard Circle alerted — they are watching over you');
            } else {
                await api.post('/emergency/safe', { lat: coords.lat, lng: coords.lng, locationName });
                toast.success('Guard Circle notified you are safe');
            }
            setBodyguardActive(willBeActive);
        } catch (e) {
            toast.error('Failed to toggle Bodyguard');
        } finally {
            setIsBodyguardLoading(false);
        }
    };

    const [circleUids, setCircleUids] = useState<string[]>([]);

    useEffect(() => {
        if (!profile?.uid) return;
        const unsubDetails = onSnapshot(collection(db, 'users', profile.uid, 'guardCircleDetails'), (snap) => {
            const acceptedUids = snap.docs
                .filter(d => {
                    const data = d.data();
                    return data.status !== 'pending' && data.accepted !== false && d.id !== profile.uid;
                })
                .map(d => d.id);
            setCircleUids(prev => Array.from(new Set([...prev, ...acceptedUids])));
        });

        const unsubUser = onSnapshot(doc(db, 'users', profile.uid), (snap) => {
            if (snap.exists()) {
                const data = snap.data();
                if (Array.isArray(data.guardCircle)) {
                    setCircleUids(prev => Array.from(new Set([...prev, ...data.guardCircle])));
                }
            }
        });

        return () => {
            unsubDetails();
            unsubUser();
        };
    }, [profile?.uid]);

    const shareLocation = async () => {
        const profileCircle = Array.isArray(profile?.guardCircle) ? profile.guardCircle : [];
        const allTargetUids = Array.from(new Set([...circleUids, ...profileCircle])).filter(Boolean);

        if (allTargetUids.length === 0) {
            toast.error('Add people to your Guard Circle first');
            return;
        }
        setIsLocationLoading(true);
        try {
            let currentLat = coords.lat;
            let currentLng = coords.lng;
            let currentLocationName = locationName;

            // Fetch fresh high-accuracy position immediately
            if ("geolocation" in navigator) {
                try {
                    const pos: GeolocationPosition = await new Promise((resolve, reject) => {
                        navigator.geolocation.getCurrentPosition(resolve, reject, {
                            enableHighAccuracy: true,
                            timeout: 8000,
                            maximumAge: 5000
                        });
                    });
                    currentLat = pos.coords.latitude;
                    currentLng = pos.coords.longitude;
                    setCoords({ lat: currentLat, lng: currentLng });
                    try {
                        const res = await api.get(`/geocode/reverse?lat=${currentLat}&lng=${currentLng}`);
                        currentLocationName = formatLocationName(res?.locationName, currentLat, currentLng);
                        setLocationName(currentLocationName);
                    } catch {
                        currentLocationName = formatLocationName(null, currentLat, currentLng);
                    }
                } catch {
                    // Cached coordinates will be used
                }
            }

            if (!currentLat && !currentLng) {
                toast.error('Unable to access your current GPS location. Please allow location permissions.');
                return;
            }

            // 1. Direct Firestore write to each guardian's notifications collection
            // Guaranteeing instant delivery even if backend has latency or cold-start
            const mapsLink = `https://www.google.com/maps?q=${currentLat},${currentLng}`;
            const senderName = profile?.name || profile?.username || 'Your Contact';
            
            allTargetUids.forEach(targetUid => {
                const notifRef = doc(collection(db, 'notifications', targetUid, 'items'));
                setDoc(notifRef, {
                    type: 'location',
                    fromUid: profile.uid,
                    fromName: senderName,
                    fromUsername: profile?.username || '',
                    fromAvatarUrl: profile?.avatarUrl || '',
                    message: `${senderName} shared live location with you. Tap to view on Google Maps.`,
                    lat: currentLat,
                    lng: currentLng,
                    mapsLink: mapsLink,
                    locationName: currentLocationName,
                    read: false,
                    createdAt: new Date()
                }).catch(() => {});
            });

            // 2. Call backend to trigger FCM web push notifications
            api.post('/emergency/share-location', { 
                lat: currentLat, 
                lng: currentLng, 
                locationName: currentLocationName 
            }).catch(err => {
                console.warn('Backend FCM push delayed:', err);
            });

            toast.success(`Live location sent to ${allTargetUids.length} contacts`, { icon: '📍' });
        } catch (e) {
            console.error('Error sharing location:', e);
            toast.error('Failed to share location');
        } finally {
            setIsLocationLoading(false);
        }
    };

    return (
        <div className="min-h-screen bg-bg pb-24 relative overflow-x-hidden pt-safe">
            <header className="sticky top-0 z-50 bg-nav-bg backdrop-blur-md border-b border-border px-4 h-16 flex items-center justify-between">
                <button 
                    onClick={() => navigate('/settings')}
                    className="w-9 h-9 rounded-full overflow-hidden bg-surface-2 flex items-center justify-center shadow-sm cursor-pointer transition-transform active:scale-95 hover:scale-[0.95]" 
                    style={{ backgroundColor: profile?.avatarColor }}
                >
                    {profile?.avatarUrl ? (
                        <img src={profile.avatarUrl} alt="Avatar" className="w-full h-full object-cover" />
                    ) : (
                        <span className="text-white font-bold">{profile?.name?.charAt(0) || 'U'}</span>
                    )}
                </button>

                <div className="flex items-center gap-2.5">
                    <img src="/shield-logo.png" alt="SHEild Logo" className="w-9 h-9 object-contain" />
                    <h1 
                        className="text-2xl sm:text-[26px] font-extrabold text-white tracking-tight leading-none"
                        style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"' }}
                    >
                        SHEild
                    </h1>
                </div>

                <button onClick={() => setIsNotifOpen(true)} className="relative w-9 h-9 flex items-center justify-center text-text-2 hover:text-white transition-colors">
                    <Bell size={24} />
                    {unreadCount > 0 && (
                        <span className="absolute top-1 right-1 w-2.5 h-2.5 bg-danger rounded-full border border-bg" />
                    )}
                </button>
            </header>

            <main className="p-4 flex flex-col gap-6 max-w-md mx-auto">
                <div className="bg-surface border border-border rounded-[20px] p-4 shadow-card">
                    <p className="text-[10px] uppercase text-text-3 font-semibold mb-2 tracking-wider">Current Area</p>
                    <div className="flex items-center gap-3">
                        <div className="w-10 h-10 rounded-full bg-surface-2 flex items-center justify-center text-primary">
                            <MapPin size={20} />
                        </div>
                        <div className="flex-1">
                            <h2 className="text-white font-bold text-lg leading-tight line-clamp-1">{locationName}</h2>
                            <div className="flex items-center gap-2 mt-1">
                                <span className="w-2 h-2 rounded-full bg-safe animate-pulse" />
                                <span className="text-xs text-text-2">Live tracking active</span>
                            </div>
                        </div>
                    </div>
                </div>

                <div className="flex flex-col items-center justify-center py-6 min-h-[220px] relative">
                    <button
                        onPointerDown={handlePressStart}
                        onPointerUp={handlePressEnd}
                        onPointerLeave={handlePressEnd}
                        className={`w-[124px] h-[124px] rounded-full flex flex-col items-center justify-center shadow-sos relative transition-transform z-10 select-none touch-none ${isPressing ? 'scale-90' : ''} ${sosActive ? 'animate-pulse shadow-[0_0_50px_rgba(255,34,34,0.6)]' : ''}`}
                        style={{ background: sosActive ? 'var(--c-danger)' : 'radial-gradient(circle, var(--c-primary-light), var(--c-primary))' }}
                    >
                        {isPressing && !sosActive && <div className="absolute inset-0 rounded-full border-4 border-white/40 animate-ping" />}
                        <span 
                            className="font-body text-[32px] font-bold text-white tracking-[2px]"
                            style={{ fontFamily: 'var(--font-body)' }}
                        >
                            SOS
                        </span>
                    </button>
                    <p className="text-sm text-text-3 mt-8 text-center font-medium">
                        {sosActive ? 'SOS is ACTIVE' : `Hold ${profile?.settings?.holdCountdown || profile?.settings?.sosCountdownSeconds || 3}s to activate`}
                    </p>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button onClick={toggleBodyguard} disabled={isBodyguardLoading} className={`h-14 rounded-xl flex items-center justify-center gap-2 font-medium transition-all ${isBodyguardLoading ? 'opacity-70' : ''} ${bodyguardActive ? 'bg-gradient-to-r from-warning to-orange-500 shadow-[0_0_20px_var(--c-warning-glow)] text-white' : 'bg-surface-2 border border-border text-white hover:bg-surface-3'}`}>
                        {isBodyguardLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <Shield size={20} />} Bodyguard{bodyguardActive ? ' ON' : ''}
                    </button>
                    <button onClick={handleSafe} disabled={isSafeLoading} className={`h-14 rounded-xl bg-safe text-white flex items-center justify-center gap-2 font-medium shadow-safe active:scale-95 transition-transform hover:opacity-90 ${isSafeLoading ? 'opacity-70' : ''}`}>
                         {isSafeLoading ? <div className="w-5 h-5 border-2 border-white/30 border-t-white rounded-full animate-spin" /> : <ShieldCheck size={20} />} I'm Safe
                    </button>
                </div>

                <div className="grid grid-cols-2 gap-4">
                    <button onClick={shareLocation} disabled={isLocationLoading} className={`bg-surface border border-border rounded-[20px] p-4 flex flex-col gap-3 items-start transition-colors ${isLocationLoading ? 'opacity-70' : 'hover:bg-surface-2'}`}>
                        <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center text-primary">
                            {isLocationLoading ? <div className="w-5 h-5 border-2 border-primary/30 border-t-primary rounded-full animate-spin" /> : <MapPin size={20} />}
                        </div>
                        <div>
                            <h3 className="text-white font-semibold mb-0.5">Share Location</h3>
                            <p className="text-[11px] text-text-3">Send live location</p>
                        </div>
                    </button>

                    <button onClick={() => navigate('/safe-zones')} className="bg-surface border border-border rounded-[20px] p-4 flex flex-col gap-3 items-start transition-colors hover:bg-surface-2 hover:border-blue-500/40 active:scale-95">
                        <div className="w-10 h-10 rounded-full bg-surface-3 flex items-center justify-center text-primary">
                            <ShieldCheck size={20} />
                        </div>
                        <div>
                            <h3 className="text-white font-semibold mb-0.5">Safe Zones</h3>
                            <p className="text-[11px] text-text-3">Police & hospitals</p>
                        </div>
                    </button>
                </div>

                {/* Shake-to-SOS Toggle — only if device supports it */}
                {permissionState !== 'unsupported' && (
                    <div className="bg-surface border border-border rounded-[20px] p-4 shadow-card flex items-center justify-between">
                        <div 
                            className="flex items-center gap-3 cursor-pointer group"
                            onClick={() => {
                                if (!shakeToSosEnabled) {
                                    toast('Shake-to-SOS is currently disabled. Turn on the switch to activate it.', { icon: 'ℹ️' });
                                    return;
                                }
                                if (typeof (window as any).simulateShake === 'function') {
                                    (window as any).simulateShake();
                                }
                            }}
                            title={shakeToSosEnabled ? "Tap to test shake trigger" : "Turn on switch to enable"}
                        >
                            <div className="w-10 h-10 rounded-full bg-surface-2 group-hover:bg-primary/20 transition-colors flex items-center justify-center shrink-0">
                                <Smartphone size={20} className={shakeToSosEnabled ? "text-primary" : "text-text-3"} />
                            </div>
                            <div>
                                <div className="flex items-center gap-2">
                                    <p className="text-white font-semibold text-sm">Shake to SOS</p>
                                    <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${shakeToSosEnabled ? 'bg-emerald-500/15 text-emerald-400 border border-emerald-500/30' : 'bg-surface-3 text-text-3'}`}>
                                        {shakeToSosEnabled ? 'ACTIVE' : 'OFF'}
                                    </span>
                                </div>
                                <p className="text-[11px] text-text-3">Shake 3× rapidly to trigger SOS</p>
                            </div>
                        </div>
                        <button
                            onClick={async () => {
                                const nextState = !shakeToSosEnabled;
                                if (nextState) {
                                    // Turning ON
                                    if (permissionState === 'prompt' && typeof (DeviceMotionEvent as any)?.requestPermission === 'function') {
                                        try {
                                            const result = await (DeviceMotionEvent as any).requestPermission();
                                            if (result === 'granted') {
                                                useSosStore.getState().setPermissionState('granted');
                                                toggleShakeSos();
                                                toast.success('Shake-to-SOS activated! Shake 3× to test.', { icon: '📳' });
                                            } else {
                                                useSosStore.getState().setPermissionState('denied');
                                                toast.error('Motion sensor permission was denied');
                                            }
                                        } catch {
                                            useSosStore.getState().setPermissionState('denied');
                                            toast.error('Motion permission request failed');
                                        }
                                    } else {
                                        toggleShakeSos();
                                        toast.success('Shake-to-SOS activated! Shake 3× to test.', { icon: '📳' });
                                    }
                                } else {
                                    // Turning OFF
                                    toggleShakeSos();
                                    toast('Shake-to-SOS disabled', { icon: '⏸️' });
                                }
                            }}
                            disabled={permissionState === 'denied'}
                            className={`relative w-12 h-6 rounded-full transition-colors ${shakeToSosEnabled ? 'bg-primary' : 'bg-surface-3'} ${permissionState === 'denied' ? 'opacity-40 cursor-not-allowed' : ''}`}
                            title={permissionState === 'denied' ? 'Enable motion access in browser settings' : undefined}
                            aria-label="Toggle Shake to SOS"
                        >
                            <div className={`absolute top-1 left-1 w-4 h-4 bg-white rounded-full transition-transform ${shakeToSosEnabled ? 'translate-x-6' : ''}`} />
                        </button>
                    </div>
                )}

                <div>
                    <div className="flex items-center justify-between mb-4">
                        <h3 className="text-sm font-semibold text-text-2 flex items-center gap-2 uppercase tracking-wide">
                            <Phone size={16} /> Quick Dials
                        </h3>
                        <button onClick={() => setIsQuickDialOpen(true)} className="w-8 h-8 rounded-full bg-surface-2 flex items-center justify-center text-text-2 hover:text-white transition-colors border border-border hover:border-text-3">
                            +
                        </button>
                    </div>
                    <div className="flex gap-3 overflow-x-auto pb-4 snap-x hide-scrollbar">
                        <button onClick={() => window.location.href = 'tel:100'} className="min-w-[124px] h-[104px] rounded-[16px] bg-[rgba(255,34,34,0.1)] border border-danger/30 p-3 flex flex-col justify-between snap-start text-left hover:bg-[rgba(255,34,34,0.15)] transition-colors">
                            <span className="text-2xl">🚨</span>
                            <div>
                                <p className="text-white font-bold text-[15px]">Police</p>
                                <p className="text-xs text-text-3 font-mono opacity-80 mt-0.5">100</p>
                            </div>
                        </button>
                        <button onClick={() => window.location.href = 'tel:108'} className="min-w-[124px] h-[104px] rounded-[16px] bg-[rgba(52,152,219,0.1)] border border-info/30 p-3 flex flex-col justify-between snap-start text-left hover:bg-[rgba(52,152,219,0.15)] transition-colors">
                            <span className="text-2xl">🚑</span>
                            <div>
                                <p className="text-white font-bold text-[15px]">Ambulance</p>
                                <p className="text-xs text-text-3 font-mono opacity-80 mt-0.5">108</p>
                            </div>
                        </button>
                        <button onClick={() => window.location.href = 'tel:1091'} className="min-w-[124px] h-[104px] rounded-[16px] bg-[rgba(230,126,34,0.1)] border border-warning/30 p-3 flex flex-col justify-between snap-start text-left hover:bg-[rgba(230,126,34,0.15)] transition-colors">
                            <span className="text-2xl">📞</span>
                            <div>
                                <p className="text-white font-bold text-[15px]">Helpline</p>
                                <p className="text-xs text-text-3 font-mono opacity-80 mt-0.5">1091</p>
                            </div>
                        </button>

                        {quickDials.map(qd => (
                            <button 
                                key={qd.id} 
                                onPointerDown={() => handleQdDown(qd.id, qd.name)}
                                onPointerUp={(e) => handleQdClick(e, qd.phone)}
                                onPointerLeave={(e) => handleQdClick(e, qd.phone)}
                                onContextMenu={(e) => e.preventDefault()}
                                style={{ WebkitTouchCallout: 'none' }}
                                className="min-w-[124px] h-[104px] rounded-[16px] bg-surface-2 border border-border p-3 flex flex-col justify-between snap-start text-left hover:bg-surface-3 transition-colors touch-none"
                            >
                                <span className="text-2xl">{qd.emoji || '📞'}</span>
                                <div>
                                    <p className="text-white font-bold text-[15px] truncate">{qd.name}</p>
                                    <p className="text-xs text-text-3 font-mono opacity-80 mt-0.5 truncate">{qd.phone}</p>
                                </div>
                            </button>
                        ))}
                    </div>
                </div>
            </main>

            <NotificationPanel isOpen={isNotifOpen} onClose={() => setIsNotifOpen(false)} />
            <QuickDialModal isOpen={isQuickDialOpen} onClose={() => setIsQuickDialOpen(false)} onAdded={() => {}} />
        </div>
    );
}
