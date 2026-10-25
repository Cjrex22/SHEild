// Safe Zones — 24/7 Police Stations, Emergency Hospitals & National Helplines.
// Powered by verified emergency response network + dynamic GPS distance calculations.

import { useState, useEffect, useMemo, useCallback, Suspense, lazy } from 'react';
import { useNavigate } from 'react-router-dom';
import {
    RefreshCw, List, Map as MapIcon, ArrowLeft, Clock, Phone, Navigation, ShieldCheck, ExternalLink, MapPin
} from 'lucide-react';
import { 
    type PlaceResult, 
    HELPLINES, 
    getSafeZonesWithDistances 
} from '../lib/safeZonesData';

const SafeZonesMap = lazy(() => import('../components/SafeZonesMap'));

type FilterType = 'ALL' | 'POLICE' | 'HOSPITAL' | 'HELPLINE';

const DEFAULT_COORDS = { lat: 28.4595, lng: 77.5020 }; // Greater Noida / NCR Area

// ─── Place Card ─────────────────────────────────────────────────────────────
function PlaceCard({ place }: { place: PlaceResult }) {
    const isPolice = place.category === 'police';
    const isHospital = place.category === 'hospital';
    const isHelpline = place.category === 'helpline';

    const handleCardClick = () => {
        if (isHelpline) {
            window.open(`https://www.google.com/search?q=${encodeURIComponent(place.name)}+India+Emergency`, '_blank');
        } else if (place.googleMapsUri) {
            window.open(place.googleMapsUri, '_blank');
        }
    };

    const handleCall = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (place.phone) {
            window.location.href = `tel:${place.phone.replace(/\s/g, '')}`;
        }
    };

    const handleNavigate = (e: React.MouseEvent) => {
        e.stopPropagation();
        if (place.googleMapsUri) {
            window.open(place.googleMapsUri, '_blank');
        } else {
            window.open(`https://www.google.com/maps/search/?api=1&query=${encodeURIComponent(place.name)}`, '_blank');
        }
    };

    return (
        <div
            onClick={handleCardClick}
            className="bg-surface rounded-2xl border border-white/10 overflow-hidden shadow-card hover:border-white/20 transition-all active:scale-[0.99] cursor-pointer"
        >
            <div className="p-4 flex items-start gap-3.5">
                <div className={`flex-shrink-0 w-11 h-11 rounded-2xl flex items-center justify-center text-xl border ${
                    isPolice ? 'bg-blue-500/15 border-blue-500/30' : 
                    isHospital ? 'bg-emerald-500/15 border-emerald-500/30' : 
                    'bg-red-500/15 border-red-500/30'
                }`}>
                    {isPolice ? '🚓' : isHospital ? '🏥' : '📞'}
                </div>

                <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 flex-wrap">
                        <h3 className="text-white font-bold text-[15px] leading-snug line-clamp-1">{place.name}</h3>
                        {place.isVerified && (
                            <span className="inline-flex items-center gap-0.5 text-[9px] uppercase tracking-wider font-extrabold bg-blue-500/20 text-blue-400 border border-blue-500/30 px-1.5 py-0.5 rounded-full">
                                <ShieldCheck size={10} /> 24/7 Verified
                            </span>
                        )}
                    </div>

                    {place.address && (
                        <p className="text-text-3 text-xs mt-1 line-clamp-1 leading-relaxed">{place.address}</p>
                    )}

                    <div className="flex items-center gap-3 mt-2 text-xs">
                        {!isHelpline && (
                            <span className="text-zinc-300 font-semibold flex items-center gap-1">
                                <MapPin size={12} className="text-primary" /> {place.distanceKm} km away
                            </span>
                        )}
                        <span className="flex items-center gap-1.5 text-xs text-emerald-400 font-medium">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-400 animate-pulse" />
                            Open 24/7
                        </span>
                    </div>
                </div>

                {/* Actions */}
                <div className="flex items-center gap-1.5 flex-shrink-0">
                    {place.phone && (
                        <button
                            onClick={handleCall}
                            aria-label={`Call ${place.name}`}
                            className="w-10 h-10 rounded-xl bg-red-600/20 hover:bg-red-600/30 border border-red-500/40 flex items-center justify-center text-red-400 hover:text-red-300 active:scale-90 transition-all shadow-sm"
                            title={`Call ${place.phone}`}
                        >
                            <Phone size={17} />
                        </button>
                    )}
                    {!isHelpline && (
                        <button
                            onClick={handleNavigate}
                            aria-label={`Directions to ${place.name}`}
                            className="w-10 h-10 rounded-xl bg-surface-2 hover:bg-surface-3 border border-white/10 flex items-center justify-center text-zinc-300 hover:text-white active:scale-90 transition-all"
                            title="Get Directions"
                        >
                            <Navigation size={17} />
                        </button>
                    )}
                </div>
            </div>
        </div>
    );
}

// ─── Main Safe Zones Page ──────────────────────────────────────────────────
export default function SafeZonesPage() {
    const navigate = useNavigate();

    // Initialize with verified stations immediately for zero wait time
    const initialZones = useMemo(() => getSafeZonesWithDistances(DEFAULT_COORDS.lat, DEFAULT_COORDS.lng), []);
    const [policeResults, setPoliceResults]     = useState<PlaceResult[]>(initialZones.police);
    const [hospitalResults, setHospitalResults] = useState<PlaceResult[]>(initialZones.hospitals);
    const [activeFilter, setActiveFilter]       = useState<FilterType>('ALL');
    const [viewMode, setViewMode]               = useState<'list' | 'map'>('list');
    const [loading, setLoading]                 = useState(false);
    const [userLocation, setUserLocation]       = useState<{ lat: number; lng: number } | null>(null);
    const [locationStatus, setLocationStatus]   = useState<'loading' | 'success' | 'denied'>('loading');
    const [refreshKey, setRefreshKey]           = useState(0);

    // Map focus state for nearest place navigation
    const [mapCenter, setMapCenter]             = useState<[number, number] | undefined>(undefined);
    const [mapZoom, setMapZoom]                 = useState<number | undefined>(undefined);
    const [selectedPlaceId, setSelectedPlaceId] = useState<string | null>(null);
    const [mapTriggerFocus, setMapTriggerFocus] = useState<number>(0);

    // Update places for a specific coordinate
    const applyLocation = useCallback((lat: number, lng: number) => {
        const { police, hospitals } = getSafeZonesWithDistances(lat, lng);
        setPoliceResults(police);
        setHospitalResults(hospitals);
    }, []);

    // ── Geolocation on mount ────────────────────────────────────────────
    useEffect(() => {
        if (!('geolocation' in navigator)) {
            setLocationStatus('denied');
            applyLocation(DEFAULT_COORDS.lat, DEFAULT_COORDS.lng);
            return;
        }

        setLocationStatus('loading');

        const onGeoSuccess = (pos: GeolocationPosition) => {
            const loc = { lat: pos.coords.latitude, lng: pos.coords.longitude };
            setUserLocation(loc);
            setLocationStatus('success');
            applyLocation(loc.lat, loc.lng);
            setLoading(false);
        };

        const onGeoError = () => {
            navigator.geolocation.getCurrentPosition(
                onGeoSuccess,
                () => {
                    // Fall back to NCR default so it's ALWAYS working
                    setLocationStatus('denied');
                    setUserLocation(DEFAULT_COORDS);
                    applyLocation(DEFAULT_COORDS.lat, DEFAULT_COORDS.lng);
                    setLoading(false);
                },
                { enableHighAccuracy: false, timeout: 6000, maximumAge: 60000 }
            );
        };

        navigator.geolocation.getCurrentPosition(
            onGeoSuccess,
            onGeoError,
            { enableHighAccuracy: true, timeout: 5000, maximumAge: 30000 }
        );
    }, [refreshKey, applyLocation]);

    const handleRetry = () => {
        setRefreshKey(k => k + 1);
    };

    const handleUseDefaultLocation = () => {
        setUserLocation(DEFAULT_COORDS);
        setLocationStatus('success');
        applyLocation(DEFAULT_COORDS.lat, DEFAULT_COORDS.lng);
    };

    // ── Computed Lists ──────────────────────────────────────────────────
    const allPlaces = useMemo(() => {
        const mapped: PlaceResult[] = [];
        if (activeFilter === 'ALL' || activeFilter === 'POLICE')   mapped.push(...policeResults);
        if (activeFilter === 'ALL' || activeFilter === 'HOSPITAL') mapped.push(...hospitalResults);
        if (activeFilter === 'ALL' || activeFilter === 'HELPLINE') mapped.push(...HELPLINES);
        
        if (activeFilter === 'ALL') {
            const places = mapped.filter(p => p.category !== 'helpline').sort((a, b) => a.distanceKm - b.distanceKm);
            const hl     = mapped.filter(p => p.category === 'helpline');
            return [...places, ...hl];
        }
        if (activeFilter === 'HELPLINE') return HELPLINES;
        return mapped.sort((a, b) => a.distanceKm - b.distanceKm);
    }, [policeResults, hospitalResults, activeFilter]);

    const counts = useMemo(() => ({
        ALL:      policeResults.length + hospitalResults.length + HELPLINES.length,
        POLICE:   policeResults.length,
        HOSPITAL: hospitalResults.length,
        HELPLINE: HELPLINES.length,
    }), [policeResults, hospitalResults]);

    const FILTERS: { key: FilterType; label: string; count: number }[] = [
        { key: 'ALL',      label: 'All',      count: counts.ALL },
        { key: 'POLICE',   label: 'Police',   count: counts.POLICE },
        { key: 'HOSPITAL', label: 'Hospital', count: counts.HOSPITAL },
        { key: 'HELPLINE', label: 'Helplines',count: counts.HELPLINE },
    ];

    // Places for map view (coordinates required)
    const mapPlaces = useMemo(() => {
        const places: PlaceResult[] = [];
        if (activeFilter === 'ALL' || activeFilter === 'POLICE')   places.push(...policeResults);
        if (activeFilter === 'ALL' || activeFilter === 'HOSPITAL') places.push(...hospitalResults);
        return places;
    }, [policeResults, hospitalResults, activeFilter]);

    const handleFilterClick = (key: FilterType) => {
        setActiveFilter(key);
        if (key === 'POLICE' && policeResults.length > 0) {
            const nearest = policeResults[0];
            setMapCenter([nearest.lat, nearest.lng]);
            setMapZoom(16);
            setSelectedPlaceId(nearest.id);
            setMapTriggerFocus(f => f + 1);
        } else if (key === 'HOSPITAL' && hospitalResults.length > 0) {
            const nearest = hospitalResults[0];
            setMapCenter([nearest.lat, nearest.lng]);
            setMapZoom(16);
            setSelectedPlaceId(nearest.id);
            setMapTriggerFocus(f => f + 1);
        } else {
            const coords = userLocation || DEFAULT_COORDS;
            setMapCenter([coords.lat, coords.lng]);
            setMapZoom(14);
            setSelectedPlaceId(null);
            setMapTriggerFocus(f => f + 1);
        }
    };

    return (
        <div className="min-h-screen bg-bg pb-[96px] text-white">
            {/* HEADER */}
            <div className="flex items-center justify-between px-4 py-3 bg-surface border-b border-white/10 sticky top-0 z-50 shadow-sm">
                <div className="flex items-center gap-2">
                    <button 
                        onClick={() => navigate(-1)} 
                        className="p-2 -ml-2 text-text-3 hover:text-white hover:bg-white/5 rounded-full transition-all"
                        aria-label="Go back"
                    >
                        <ArrowLeft size={24} />
                    </button>
                    <div>
                        <h1 
                            className="text-xl font-bold leading-tight text-white"
                            style={{ fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", "Noto Sans", Helvetica, Arial, sans-serif, "Apple Color Emoji", "Segoe UI Emoji"' }}
                        >
                            Safe Zones
                        </h1>
                        <p className="text-xs text-text-3 font-medium flex items-center gap-1 mt-0.5">
                            <Clock size={11} className="text-primary" />
                            {counts.ALL} 24/7 emergency safe zones active
                        </p>
                    </div>
                </div>

                <div className="flex items-center gap-2">
                    <div className="flex items-center bg-surface-2 rounded-xl p-0.5 border border-white/10">
                        <button 
                            onClick={() => setViewMode('list')} 
                            className={`p-2 transition-colors rounded-lg ${viewMode === 'list' ? 'bg-primary text-white' : 'text-text-3'}`}
                            title="List view"
                        >
                             <List size={18} />
                        </button>
                        <button 
                            onClick={() => setViewMode('map')} 
                            className={`p-2 transition-colors rounded-lg ${viewMode === 'map'  ? 'bg-primary text-white' : 'text-text-3'}`}
                            title="Map view"
                        >
                             <MapIcon size={18} />
                        </button>
                    </div>
                    <button 
                        onClick={handleRetry} 
                        disabled={loading} 
                        className="p-2 text-text-3 hover:text-white hover:bg-white/5 rounded-xl transition-all disabled:opacity-40"
                        title="Refresh"
                    >
                        <RefreshCw size={20} className={loading ? 'animate-spin' : ''} />
                    </button>
                </div>
            </div>

            {/* FILTER CHIPS */}
            <div className="overflow-x-auto no-scrollbar">
                <div className="px-4 py-3 flex gap-2 flex-shrink-0 min-w-max">
                    {FILTERS.map(f => (
                        <button
                            key={f.key}
                            onClick={() => handleFilterClick(f.key)}
                            className={`flex-shrink-0 rounded-full px-4 py-1.5 text-xs font-bold transition-all shadow-sm ${
                                activeFilter === f.key 
                                    ? 'bg-primary text-white shadow-sos' 
                                    : 'bg-surface text-text-2 border border-white/10 hover:border-white/20'
                            }`}
                        >
                            {f.label} ({f.count})
                        </button>
                    ))}
                </div>
            </div>

            {/* LOCATION ACCESS CARD (NON-BLOCKING) */}
            {locationStatus === 'denied' && (
                <div className="mx-4 mb-3 p-3.5 bg-surface rounded-2xl border border-amber-500/30 flex items-start gap-3 shadow-card">
                    <div className="w-8 h-8 rounded-full bg-amber-500/15 flex items-center justify-center text-amber-400 shrink-0 mt-0.5">
                        <MapPin size={16} />
                    </div>
                    <div className="flex-1">
                        <h4 className="text-white font-bold text-xs">Showing Greater Noida / NCR Safe Zones</h4>
                        <p className="text-[11px] text-text-3 mt-0.5 leading-relaxed">
                            GPS is disabled. Showing verified local stations. Tap below to use your live location.
                        </p>
                        <div className="flex items-center gap-2 mt-2.5">
                            <button
                                onClick={handleRetry}
                                className="px-3 py-1 bg-primary hover:bg-primary-hover active:scale-95 text-white rounded-full text-[11px] font-bold transition-all"
                            >
                                Enable GPS
                            </button>
                            <button
                                onClick={handleUseDefaultLocation}
                                className="px-3 py-1 bg-white/5 hover:bg-white/10 text-zinc-300 rounded-full text-[11px] font-medium transition-all"
                            >
                                Dismiss
                            </button>
                        </div>
                    </div>
                </div>
            )}

            {/* QUICK GOOGLE MAPS NAVIGATION CARDS */}
            <div className="px-4 mb-3 grid grid-cols-2 gap-2.5">
                <a
                    href="https://www.google.com/maps/search/?api=1&query=police+station+near+me"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 bg-surface border border-blue-500/25 hover:border-blue-500/50 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] group"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-blue-500/15 flex items-center justify-center text-base border border-blue-500/30">
                            🚓
                        </div>
                        <div>
                            <span className="text-xs font-bold text-white block">Nearby Police</span>
                            <span className="text-[10px] text-blue-400 font-medium">Google Maps</span>
                        </div>
                    </div>
                    <ExternalLink size={14} className="text-text-3 group-hover:text-blue-400 transition-colors" />
                </a>

                <a
                    href="https://www.google.com/maps/search/?api=1&query=hospital+emergency+near+me"
                    target="_blank"
                    rel="noreferrer"
                    className="p-3 bg-surface border border-emerald-500/25 hover:border-emerald-500/50 rounded-2xl flex items-center justify-between text-left transition-all active:scale-[0.98] group"
                >
                    <div className="flex items-center gap-2.5">
                        <div className="w-9 h-9 rounded-xl bg-emerald-500/15 flex items-center justify-center text-base border border-emerald-500/30">
                            🏥
                        </div>
                        <div>
                            <span className="text-xs font-bold text-white block">Nearby Hospital</span>
                            <span className="text-[10px] text-emerald-400 font-medium">Google Maps</span>
                        </div>
                    </div>
                    <ExternalLink size={14} className="text-text-3 group-hover:text-emerald-400 transition-colors" />
                </a>
            </div>

            {/* LIST VIEW */}
            {viewMode === 'list' && (
                <div className="px-4 space-y-2.5">
                    <div className="flex items-center justify-between text-[11px] uppercase tracking-wider text-text-3 font-bold px-1 mb-1">
                        <span>
                            {activeFilter === 'HELPLINE'
                                ? 'National Emergency Helplines (24/7 Toll-Free)'
                                : `${allPlaces.length} verified safe zones sorted by distance`}
                        </span>
                    </div>

                    {allPlaces.map(place => (
                        <PlaceCard key={place.id} place={place} />
                    ))}
                </div>
            )}

            {/* MAP VIEW */}
            {viewMode === 'map' && (
                <div className="h-[calc(100vh-210px)] relative mx-4 rounded-3xl overflow-hidden border border-white/10 shadow-card">
                    <Suspense fallback={
                        <div className="flex items-center justify-center h-full bg-bg text-text-3 font-mono text-xs gap-2">
                            <RefreshCw className="animate-spin text-primary" size={20} />
                            <span>Loading Safe Zones Map...</span>
                        </div>
                    }>
                        <SafeZonesMap
                            userLocation={userLocation}
                            places={mapPlaces}
                            center={mapCenter}
                            zoom={mapZoom}
                            selectedPlaceId={selectedPlaceId}
                            triggerFocus={mapTriggerFocus}
                        />
                    </Suspense>
                </div>
            )}
        </div>
    );
}
