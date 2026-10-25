import { useEffect, useState, useMemo, Suspense, lazy } from 'react';
import { useAuthStore } from '../stores/authStore';
import { db } from '../lib/firebase';
import { collection, onSnapshot } from 'firebase/firestore';
import toast from 'react-hot-toast';
import { MapPin, Target, Loader2 } from 'lucide-react';
import { getSafeZonesWithDistances, haversineKm, type PlaceResult } from '../lib/safeZonesData';

// Dynamically import Leaflet map component to prevent SSR/canvas issues
const LeafletMapComponent = lazy(() => import('../components/LeafletMapComponent'));

type MapLayerFilter = 'ALL' | 'POLICE' | 'HOSPITAL' | 'CIRCLE';

const DEFAULT_COORDS = { lat: 28.4595, lng: 77.5020 }; // Greater Noida / Bennett University / NCR

export default function MapPage() {
    const { profile } = useAuthStore();
    const [activeLocations, setActiveLocations] = useState<any[]>([]);
    const [myLocation, setMyLocation] = useState<{ lat: number, lng: number } | null>(DEFAULT_COORDS);
    const [hasRealGps, setHasRealGps] = useState(false);
    const [status, setStatus] = useState<'loading' | 'success' | 'ready'>('loading');
    const [triggerFocus, setTriggerFocus] = useState(0);
    const [layerFilter, setLayerFilter] = useState<MapLayerFilter>('ALL');

    // Dynamic camera target and active focused marker
    const [targetCenter, setTargetCenter] = useState<[number, number]>([DEFAULT_COORDS.lat, DEFAULT_COORDS.lng]);
    const [targetZoom, setTargetZoom] = useState<number>(13);
    const [selectedZoneId, setSelectedZoneId] = useState<string | null>(null);

    // Load verified safe zones around coordinates (pre-sorted by distance)
    const safeZonesData = useMemo(() => {
        const coords = myLocation || DEFAULT_COORDS;
        return getSafeZonesWithDistances(coords.lat, coords.lng);
    }, [myLocation]);

    const filteredSafeZones = useMemo(() => {
        if (layerFilter === 'CIRCLE') return [];
        const list: PlaceResult[] = [];
        if (layerFilter === 'ALL' || layerFilter === 'POLICE')   list.push(...safeZonesData.police);
        if (layerFilter === 'ALL' || layerFilter === 'HOSPITAL') list.push(...safeZonesData.hospitals);
        return list;
    }, [safeZonesData, layerFilter]);

    const filteredCircleLocations = useMemo(() => {
        if (layerFilter === 'POLICE' || layerFilter === 'HOSPITAL') return [];
        return activeLocations;
    }, [activeLocations, layerFilter]);

    const requestLocation = () => {
        setStatus('loading');
        if (!navigator.geolocation) {
            setStatus('ready');
            return;
        }

        navigator.geolocation.getCurrentPosition(
            pos => {
                const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                setMyLocation(loc);
                setHasRealGps(true);
                setStatus('success');
                setTargetCenter([loc.lat, loc.lng]);
                setTargetZoom(15);
                setSelectedZoneId(null);
                setTriggerFocus(prev => prev + 1);
            },
            () => {
                setStatus('ready');
            },
            { enableHighAccuracy: true, timeout: 6000, maximumAge: 30000 }
        );
    };

    const handleLocateMe = () => {
        setSelectedZoneId(null);
        setLayerFilter('ALL');

        // Instant flyTo if location is already known
        if (myLocation) {
            setTargetCenter([myLocation.lat, myLocation.lng]);
            setTargetZoom(16);
            setTriggerFocus(prev => prev + 1);
            toast.success('Centered on your location', { id: 'loc-center' });
        }

        // Query fresh GPS coordinates in parallel
        if (navigator.geolocation) {
            setStatus('loading');
            navigator.geolocation.getCurrentPosition(
                pos => {
                    const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
                    setMyLocation(loc);
                    setHasRealGps(true);
                    setStatus('success');
                    setTargetCenter([loc.lat, loc.lng]);
                    setTargetZoom(16);
                    setTriggerFocus(prev => prev + 1);
                },
                () => {
                    setStatus('ready');
                },
                { enableHighAccuracy: true, timeout: 5000, maximumAge: 10000 }
            );
        }
    };

    useEffect(() => {
        requestLocation();
    }, []);

    useEffect(() => {
        if (!profile?.uid) return;
        const unsub = onSnapshot(collection(db, 'activeLocations'), (snap) => {
            const locs = snap.docs.map(doc => ({ id: doc.id, ...doc.data() }));
            setActiveLocations(locs);
        });
        return unsub;
    }, [profile?.uid]);

    // Handle tapping a layer filter chip: filter AND smoothly fly to the nearest place in that sector
    const handleLayerClick = (key: MapLayerFilter) => {
        setLayerFilter(key);

        if (key === 'POLICE') {
            const nearest = safeZonesData.police[0];
            if (nearest) {
                setTargetCenter([nearest.lat, nearest.lng]);
                setTargetZoom(16);
                setSelectedZoneId(nearest.id);
                setTriggerFocus(prev => prev + 1);
                toast.success(`Nearest: ${nearest.name} (${nearest.distanceKm} km away)`, { id: 'nearest-pol' });
            }
        } else if (key === 'HOSPITAL') {
            const nearest = safeZonesData.hospitals[0];
            if (nearest) {
                setTargetCenter([nearest.lat, nearest.lng]);
                setTargetZoom(16);
                setSelectedZoneId(nearest.id);
                setTriggerFocus(prev => prev + 1);
                toast.success(`Nearest: ${nearest.name} (${nearest.distanceKm} km away)`, { id: 'nearest-hosp' });
            }
        } else if (key === 'CIRCLE') {
            if (activeLocations.length > 0) {
                const userLoc = myLocation || DEFAULT_COORDS;
                const sorted = [...activeLocations].sort((a, b) => {
                    const distA = haversineKm(userLoc.lat, userLoc.lng, a.lat, a.lng);
                    const distB = haversineKm(userLoc.lat, userLoc.lng, b.lat, b.lng);
                    return distA - distB;
                });
                const nearest = sorted[0];
                setTargetCenter([nearest.lat, nearest.lng]);
                setTargetZoom(16);
                setSelectedZoneId(nearest.id);
                setTriggerFocus(prev => prev + 1);
                toast.success(`Nearest Member: ${nearest.name || 'Member'}`, { id: 'nearest-circ' });
            } else {
                setSelectedZoneId(null);
                toast('No circle members currently sharing location', { icon: '👥', id: 'no-circle' });
            }
        } else {
            // 'ALL' — reset view to user's location
            const coords = myLocation || DEFAULT_COORDS;
            setTargetCenter([coords.lat, coords.lng]);
            setTargetZoom(hasRealGps ? 15 : 13);
            setSelectedZoneId(null);
            setTriggerFocus(prev => prev + 1);
        }
    };

    return (
        <div className="h-[calc(100vh-64px)] w-full relative bg-bg overflow-hidden">
            {/* Top Header Controls Overlay */}
            <header className="absolute top-4 left-4 right-4 z-[400] flex flex-col gap-2.5 pointer-events-none">
                <div className="flex items-center justify-between">
                    <div className="bg-surface/90 backdrop-blur-md px-3.5 py-2 rounded-2xl shadow-card border border-white/10 pointer-events-auto flex items-center gap-2">
                        <MapPin className="text-primary" size={17} />
                        <div>
                            <span className="text-white font-bold text-xs tracking-tight block">Live Safety Map</span>
                            <span className="text-[10px] text-zinc-400 font-medium">
                                {hasRealGps ? '📍 GPS Position Active' : '📍 NCR / Greater Noida Area'}
                            </span>
                        </div>
                    </div>

                    <div className="flex items-center gap-2 pointer-events-auto">
                        {status === 'loading' && (
                            <div className="bg-surface/90 backdrop-blur-md px-3 py-1.5 rounded-xl border border-white/10 shadow-card flex items-center gap-1.5 text-xs text-text-3">
                                <Loader2 size={13} className="animate-spin text-primary" />
                                <span className="text-[11px]">Locating...</span>
                            </div>
                        )}
                        <button 
                            onClick={handleLocateMe}
                            className="w-10 h-10 bg-surface/90 backdrop-blur-md rounded-2xl shadow-card border border-white/10 flex items-center justify-center text-text-2 hover:text-white transition-all active:scale-95"
                            aria-label="Locate me"
                            title="Locate me"
                        >
                            <Target size={18} className={status === 'loading' ? 'animate-spin text-primary' : 'text-primary'} />
                        </button>
                    </div>
                </div>

                {/* Layer Toggle Chips */}
                <div className="flex items-center gap-1.5 overflow-x-auto no-scrollbar pointer-events-auto">
                    {[
                        { key: 'ALL',      label: 'All Zones' },
                        { key: 'POLICE',   label: `🚓 Police (${safeZonesData.police.length})` },
                        { key: 'HOSPITAL', label: `🏥 Hospitals (${safeZonesData.hospitals.length})` },
                        { key: 'CIRCLE',   label: `👥 Circle (${activeLocations.length})` },
                    ].map(tab => (
                        <button
                            key={tab.key}
                            onClick={() => handleLayerClick(tab.key as MapLayerFilter)}
                            className={`px-3 py-1 rounded-full text-[11px] font-bold whitespace-nowrap backdrop-blur-md border transition-all active:scale-95 ${
                                layerFilter === tab.key
                                    ? 'bg-primary text-white border-primary shadow-sos'
                                    : 'bg-surface/85 text-zinc-300 border-white/10 hover:border-white/20'
                            }`}
                        >
                            {tab.label}
                        </button>
                    ))}
                </div>
            </header>

            {/* Non-blocking Map Container */}
            <Suspense fallback={
                <div className="h-full w-full bg-bg flex items-center justify-center text-text-3 font-mono text-xs gap-2">
                    <Loader2 size={18} className="animate-spin text-primary" />
                    <span>Loading Pitch-Black Safety Map...</span>
                </div>
            }>
                <LeafletMapComponent 
                    center={targetCenter} 
                    zoom={targetZoom} 
                    myLocation={myLocation} 
                    activeLocations={filteredCircleLocations}
                    safeZones={filteredSafeZones}
                    triggerFocus={triggerFocus}
                    selectedZoneId={selectedZoneId}
                    onLocateMe={handleLocateMe}
                />
            </Suspense>
        </div>
    );
}
