// SafeZonesMap — Modern Leaflet map for the Safe Zones page.
// Features pitch-black tiles, verified place pins, user pulsing radar, map resize invalidation,
// and automatic focus on nearest location.

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Crosshair, Plus, Minus, Navigation, Phone } from 'lucide-react';
import type { PlaceResult } from '../lib/safeZonesData';

// Fix default Leaflet icon paths
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// User location pulsing radar dot
const userPulsingIcon = L.divIcon({
    className: 'custom-pulsing-icon',
    html: `
      <div style="
        width: 28px; 
        height: 28px; 
        display: flex;
        align-items: center;
        justify-content: center;
        position: relative;
      ">
        <div style="
            position: absolute;
            width: 28px;
            height: 28px;
            border-radius: 50%;
            background: rgba(255, 59, 48, 0.4);
            animation: pulse-ring 2s cubic-bezier(0.215, 0.61, 0.355, 1) infinite;
        "></div>
        <div style="
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: #FF3B30;
            border: 2.5px solid #FFFFFF;
            box-shadow: 0 0 14px rgba(255, 59, 48, 1);
            position: relative;
            z-index: 2;
        "></div>
      </div>
    `,
    iconSize: [28, 28],
    iconAnchor: [14, 14],
    popupAnchor: [0, -14],
});

// Custom place badges with verified styling and nearest state
function createPlaceIcon(category: 'police' | 'hospital' | 'helpline', isSelected: boolean = false) {
    const isPolice = category === 'police';
    const bg = isPolice ? '#1D4ED8' : category === 'hospital' ? '#059669' : '#DC2626';
    const border = isSelected ? '#FFFFFF' : (isPolice ? '#60A5FA' : category === 'hospital' ? '#34D399' : '#F87171');
    const emoji = isPolice ? '🚓' : category === 'hospital' ? '🏥' : '📞';
    const size = isSelected ? 42 : 36;
    const anchor = size / 2;

    return L.divIcon({
        className: `sz-marker ${isSelected ? 'sz-marker-selected' : ''}`,
        html: `
          <div style="
            width: ${size}px; 
            height: ${size}px;
            background: ${bg};
            border: ${isSelected ? '3px solid #FFFFFF' : `2px solid ${border}`};
            border-radius: 50%;
            display: flex; 
            align-items: center; 
            justify-content: center;
            font-size: ${isSelected ? '20px' : '17px'}; 
            box-shadow: ${isSelected ? '0 0 24px rgba(255,255,255,0.9), 0 6px 20px rgba(0,0,0,0.9)' : '0 4px 16px rgba(0,0,0,0.85)'};
            transition: all 0.3s ease;
          ">${emoji}</div>
        `,
        iconSize: [size, size],
        iconAnchor: [anchor, anchor],
        popupAnchor: [0, -anchor - 6],
    });
}

// Invalidate container size to prevent grey/broken tiles on mount
function MapInvalidator() {
    const map = useMap();
    useEffect(() => {
        const resize = () => {
            map.invalidateSize();
        };
        resize();
        const t1 = setTimeout(resize, 80);
        const t2 = setTimeout(resize, 250);
        const t3 = setTimeout(resize, 600);
        window.addEventListener('resize', resize);
        return () => {
            clearTimeout(t1);
            clearTimeout(t2);
            clearTimeout(t3);
            window.removeEventListener('resize', resize);
        };
    }, [map]);
    return null;
}

// Controller for flyTo recentering
function SafeZonesRecenter({ center, zoom = 14, triggerFocus }: { center: [number, number]; zoom?: number; triggerFocus: number }) {
    const map = useMap();
    useEffect(() => {
        if (center && center[0] && center[1]) {
            map.flyTo(center, zoom, { animate: true, duration: 1.1 });
        }
    }, [center, zoom, triggerFocus, map]);
    return null;
}

// Custom Zoom Controls
function MapControls({ onRecenter }: { onRecenter: () => void }) {
    const map = useMap();

    return (
        <div className="absolute right-4 bottom-6 z-[500] flex flex-col gap-2 pointer-events-auto">
            <button
                onClick={onRecenter}
                className="w-11 h-11 rounded-2xl bg-surface/90 backdrop-blur-md border border-white/10 text-white flex items-center justify-center shadow-card hover:bg-surface-2 active:scale-95 transition-all"
                title="Center on my location"
                aria-label="Center on my location"
            >
                <Crosshair size={20} className="text-primary" />
            </button>
            <div className="bg-surface/90 backdrop-blur-md border border-white/10 rounded-2xl shadow-card overflow-hidden flex flex-col">
                <button
                    onClick={() => map.zoomIn()}
                    className="w-11 h-11 text-white hover:bg-white/10 active:bg-white/20 flex items-center justify-center transition-colors border-b border-white/5"
                    aria-label="Zoom in"
                >
                    <Plus size={18} />
                </button>
                <button
                    onClick={() => map.zoomOut()}
                    className="w-11 h-11 text-white hover:bg-white/10 active:bg-white/20 flex items-center justify-center transition-colors"
                    aria-label="Zoom out"
                >
                    <Minus size={18} />
                </button>
            </div>
        </div>
    );
}

interface SafeZonesMapProps {
    userLocation: { lat: number; lng: number } | null;
    places: PlaceResult[];
    center?: [number, number];
    zoom?: number;
    selectedPlaceId?: string | null;
    triggerFocus?: number;
}

export default function SafeZonesMap({ 
    userLocation, 
    places,
    center: propCenter,
    zoom: propZoom,
    selectedPlaceId,
    triggerFocus = 0
}: SafeZonesMapProps) {
    const userRef = useRef<any>(null);
    const markerRefs = useRef<Record<string, any>>({});
    const localTriggerFocusRef = useRef(triggerFocus);

    const defaultCoords: [number, number] = [28.4595, 77.5020];
    const mapCenter: [number, number] = propCenter || (userLocation
        ? [userLocation.lat, userLocation.lng]
        : defaultCoords);
    const mapZoom = propZoom || (userLocation ? 14 : 12);

    const handleRecenter = () => {
        localTriggerFocusRef.current += 1;
        if (userRef.current) {
            userRef.current.openPopup();
        }
    };

    // Auto open popup when a place is selected
    useEffect(() => {
        if (selectedPlaceId && markerRefs.current[selectedPlaceId]) {
            const timer = setTimeout(() => {
                markerRefs.current[selectedPlaceId]?.openPopup();
            }, 600);
            return () => clearTimeout(timer);
        } else if (!selectedPlaceId && userRef.current && userLocation) {
            userRef.current.openPopup();
        }
    }, [selectedPlaceId, triggerFocus, userLocation]);

    return (
        <div className="h-full w-full relative bg-bg">
            <MapContainer 
                center={mapCenter} 
                zoom={mapZoom} 
                className="h-full w-full z-0 font-sans" 
                zoomControl={false}
            >
                <TileLayer
                    attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                    url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                    maxZoom={19}
                    className="map-tiles-pitch-black"
                />

                {/* User location marker */}
                {userLocation && (
                    <Marker position={[userLocation.lat, userLocation.lng]} icon={userPulsingIcon} ref={userRef}>
                        <Popup autoPan={false}>
                            <div className="p-1 text-center font-bold text-xs text-white">
                                📍 You are here
                            </div>
                        </Popup>
                    </Marker>
                )}

                {/* Place markers */}
                {places.map(p => {
                    const isPolice = p.category === 'police';
                    const isSelected = selectedPlaceId === p.id;
                    return (
                        <Marker
                            key={p.id}
                            position={[p.lat, p.lng]}
                            icon={createPlaceIcon(p.category, isSelected)}
                            ref={(el: any) => { if (el) markerRefs.current[p.id] = el; }}
                        >
                            <Popup autoPan={false}>
                                <div className="p-2 min-w-[210px] text-xs">
                                    <div className="flex items-center gap-1.5 mb-1.5">
                                        <span className="text-base">{isPolice ? '🚓' : '🏥'}</span>
                                        <div>
                                            <b className="text-[13px] text-white font-bold block leading-snug">{p.name}</b>
                                            <span className="text-[10px] text-emerald-400 font-semibold">
                                                {p.distanceKm > 0 ? `${p.distanceKm} km away (Nearest)` : 'Safe Zone'} • 24/7 Verified
                                            </span>
                                        </div>
                                    </div>
                                    {p.address && (
                                        <p className="text-[11px] text-zinc-300 mb-2 line-clamp-2 leading-relaxed">
                                            {p.address}
                                        </p>
                                    )}
                                    <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                                        {p.phone && (
                                            <a
                                                href={`tel:${p.phone.replace(/\s/g, '')}`}
                                                className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 active:scale-95 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md border border-red-400/40"
                                                style={{ color: '#FFFFFF', textDecoration: 'none' }}
                                            >
                                                <Phone size={13} className="text-white fill-current" />
                                                <span style={{ color: '#FFFFFF' }} className="font-bold">Call</span>
                                            </a>
                                        )}
                                        {p.googleMapsUri && (
                                            <a
                                                href={p.googleMapsUri}
                                                target="_blank"
                                                rel="noreferrer"
                                                className="flex-1 py-2 px-3 bg-white/10 hover:bg-white/20 border border-white/15 active:scale-95 rounded-xl font-semibold text-xs flex items-center justify-center gap-1.5 transition-all"
                                                style={{ color: '#FFFFFF', textDecoration: 'none' }}
                                            >
                                                <Navigation size={13} className="text-white" />
                                                <span style={{ color: '#FFFFFF' }} className="font-semibold">Directions</span>
                                            </a>
                                        )}
                                    </div>
                                </div>
                            </Popup>
                        </Marker>
                    );
                })}

                <MapInvalidator />
                <SafeZonesRecenter center={mapCenter} zoom={mapZoom} triggerFocus={triggerFocus || localTriggerFocusRef.current} />
                <MapControls onRecenter={handleRecenter} />

                <style>{`
                    .leaflet-container { 
                        background: #000000 !important; 
                        outline: none;
                    }
                    .map-tiles-pitch-black {
                        filter: invert(100%) hue-rotate(180deg) brightness(85%) contrast(120%) grayscale(95%);
                    }
                    .leaflet-popup-content-wrapper, .leaflet-popup-tip {
                        background: #121214 !important;
                        color: white !important;
                        border: 1px solid rgba(255, 255, 255, 0.12) !important;
                        border-radius: 14px !important;
                        box-shadow: 0 10px 36px rgba(0,0,0,0.9) !important;
                    }
                    .leaflet-container a, .leaflet-popup-content a {
                        color: #FFFFFF !important;
                        text-decoration: none !important;
                    }
                    .leaflet-popup-content {
                        margin: 10px 12px !important;
                    }
                    .custom-pulsing-icon, .sz-marker { 
                        background: transparent !important; 
                        border: none !important; 
                    }
                    .sz-marker-selected {
                        z-index: 1000 !important;
                    }
                    @keyframes pulse-ring {
                        0% { transform: scale(0.6); opacity: 0.9; }
                        50% { transform: scale(1.6); opacity: 0.3; }
                        100% { transform: scale(2.2); opacity: 0; }
                    }
                `}</style>
            </MapContainer>
        </div>
    );
}
