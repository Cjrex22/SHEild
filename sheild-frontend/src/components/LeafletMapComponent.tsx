// LeafletMapComponent — High performance pitch-black safety map.
// Includes user pulsing pin, guard circle members, nearby verified police & hospital zones.
// Automatically centers and opens popup on the nearest station when a layer is clicked.

import { useEffect, useRef } from 'react';
import { MapContainer, TileLayer, Marker, Popup, useMap } from 'react-leaflet';
import 'leaflet/dist/leaflet.css';
import L from 'leaflet';
import { Crosshair, Plus, Minus, Navigation, Phone } from 'lucide-react';
import type { PlaceResult } from '../lib/safeZonesData';

// Fix Leaflet default icon lookup
delete (L.Icon.Default.prototype as any)._getIconUrl;
L.Icon.Default.mergeOptions({
    iconRetinaUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon-2x.png',
    iconUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-icon.png',
    shadowUrl: 'https://cdnjs.cloudflare.com/ajax/libs/leaflet/1.7.1/images/marker-shadow.png',
});

// User radar pulsing marker
const pulsingIcon = L.divIcon({
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
            background: rgba(255, 59, 48, 0.45);
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
    popupAnchor: [0, -14]
});

// Member marker
const createMemberIcon = (isSos: boolean, name: string) => L.divIcon({
    className: 'custom-member-icon',
    html: `
      <div style="display: flex; flex-direction: column; align-items: center;">
        <div style="
            background: ${isSos ? '#EF4444' : '#141416'};
            color: #FFFFFF;
            padding: 3px 9px;
            border-radius: 9999px;
            font-size: 11px;
            font-weight: 700;
            white-space: nowrap;
            box-shadow: 0 4px 14px rgba(0,0,0,0.8);
            border: 1px solid ${isSos ? 'rgba(255,255,255,0.6)' : 'rgba(255,255,255,0.18)'};
            margin-bottom: 4px;
        ">
            ${isSos ? '🚨 ' : ''}${name}
        </div>
        <div style="
            width: 14px;
            height: 14px;
            border-radius: 50%;
            background: ${isSos ? '#EF4444' : '#3B82F6'};
            border: 2px solid #FFFFFF;
            box-shadow: 0 0 12px ${isSos ? 'rgba(239,68,68,0.9)' : 'rgba(59,130,246,0.8)'};
        "></div>
      </div>
    `,
    iconSize: [80, 44],
    iconAnchor: [40, 40],
    popupAnchor: [0, -40]
});

// Safe Zone markers with highlighted nearest state
function createZoneIcon(category: 'police' | 'hospital' | 'helpline', isSelected: boolean = false) {
    const isPolice = category === 'police';
    const bg = isPolice ? '#1D4ED8' : category === 'hospital' ? '#059669' : '#DC2626';
    const border = isSelected ? '#FFFFFF' : (isPolice ? '#60A5FA' : category === 'hospital' ? '#34D399' : '#F87171');
    const emoji = isPolice ? '🚓' : category === 'hospital' ? '🏥' : '📞';
    const size = isSelected ? 42 : 32;
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
            font-size: ${isSelected ? '20px' : '15px'}; 
            box-shadow: ${isSelected ? '0 0 24px rgba(255,255,255,0.9), 0 6px 20px rgba(0,0,0,0.9)' : '0 4px 14px rgba(0,0,0,0.8)'};
            transition: all 0.3s ease;
          ">${emoji}</div>
        `,
        iconSize: [size, size],
        iconAnchor: [anchor, anchor],
        popupAnchor: [0, -anchor - 6],
    });
}

// Invalidator to guarantee immediate tile render on navigation
function MapInvalidator() {
    const map = useMap();
    useEffect(() => {
        const resize = () => {
            map.invalidateSize();
        };
        resize();
        const t1 = setTimeout(resize, 80);
        const t2 = setTimeout(resize, 250);
        const t3 = setTimeout(resize, 700);
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

function RecenterController({ center, zoom, triggerFocus }: { center: [number, number]; zoom: number; triggerFocus: number }) {
    const map = useMap();
    
    useEffect(() => {
        if (center && center[0] && center[1]) {
            map.flyTo(center, zoom, { animate: true, duration: 1.2 });
        }
    }, [triggerFocus, center, zoom, map]);

    return null;
}

function FloatingControls({ onRecenter }: { onRecenter: () => void }) {
    const map = useMap();

    return (
        <div className="absolute right-4 bottom-8 z-[500] flex flex-col gap-2 pointer-events-auto">
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

interface LeafletMapProps {
    center: [number, number];
    zoom: number;
    myLocation: { lat: number; lng: number } | null;
    activeLocations?: any[];
    safeZones?: PlaceResult[];
    triggerFocus: number;
    selectedZoneId?: string | null;
    onLocateMe?: () => void;
}

export default function LeafletMapComponent({ 
    center, 
    zoom, 
    myLocation, 
    activeLocations = [], 
    safeZones = [],
    triggerFocus,
    selectedZoneId,
    onLocateMe 
}: LeafletMapProps) {
    const popupRef = useRef<any>(null);
    const markerRefs = useRef<Record<string, any>>({});

    // Automatically open popup of selected zone or user location
    useEffect(() => {
        if (selectedZoneId && markerRefs.current[selectedZoneId]) {
            const timer = setTimeout(() => {
                markerRefs.current[selectedZoneId]?.openPopup();
            }, 600);
            return () => clearTimeout(timer);
        } else if (!selectedZoneId && popupRef.current && myLocation) {
            popupRef.current.openPopup();
        }
    }, [selectedZoneId, triggerFocus, myLocation]);

    return (
        <MapContainer 
            center={center} 
            zoom={zoom} 
            className="h-full w-full z-0 font-sans" 
            zoomControl={false}
        >
            <TileLayer
                attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
                url="https://tile.openstreetmap.org/{z}/{x}/{y}.png"
                maxZoom={19}
                className="map-tiles-pitch-black"
            />
            
            {/* User Location */}
            {myLocation && (
                <Marker position={[myLocation.lat, myLocation.lng]} icon={pulsingIcon} ref={popupRef}>
                    <Popup autoPan={false}>
                        <div className="font-bold text-center text-xs text-white">
                            📍 You are here
                        </div>
                    </Popup>
                </Marker>
            )}

            {/* Guard Circle Active Members */}
            {activeLocations.map((loc: any) => (
                <Marker 
                    key={loc.id} 
                    position={[loc.lat, loc.lng]} 
                    icon={createMemberIcon(loc.isSos, loc.name || 'Member')}
                    ref={(el: any) => { if (el) markerRefs.current[loc.id] = el; }}
                >
                    <Popup autoPan={false}>
                        <div className="p-1 text-xs">
                            <b className="text-sm text-white">{loc.name || 'Member'}</b><br />
                            <span className={loc.isSos ? 'text-red-400 font-bold' : 'text-zinc-400'}>
                                {loc.isSos ? '🚨 SOS Alert Active!' : 'Live Location Tracking'}
                            </span>
                        </div>
                    </Popup>
                </Marker>
            ))}

            {/* Nearby Verified Safe Zones (Police & Hospitals) */}
            {safeZones.map(zone => {
                const isPolice = zone.category === 'police';
                const isSelected = selectedZoneId === zone.id;
                return (
                    <Marker
                        key={zone.id}
                        position={[zone.lat, zone.lng]}
                        icon={createZoneIcon(zone.category, isSelected)}
                        ref={(el: any) => { if (el) markerRefs.current[zone.id] = el; }}
                    >
                        <Popup autoPan={false}>
                            <div className="p-2 min-w-[210px] text-xs">
                                <div className="flex items-center gap-1.5 mb-1.5">
                                    <span className="text-base">{isPolice ? '🚓' : '🏥'}</span>
                                    <div>
                                        <b className="text-[13px] text-white font-bold block leading-snug">{zone.name}</b>
                                        <span className="text-[10px] text-emerald-400 font-semibold">
                                            {zone.distanceKm > 0 ? `${zone.distanceKm} km away (Nearest)` : 'Safe Zone'} • 24/7 Verified
                                        </span>
                                    </div>
                                </div>
                                {zone.address && (
                                    <p className="text-[11px] text-zinc-300 mb-2 line-clamp-2 leading-relaxed">
                                        {zone.address}
                                    </p>
                                )}
                                <div className="flex items-center gap-2 mt-2 pt-2 border-t border-white/10">
                                    {zone.phone && (
                                        <a
                                            href={`tel:${zone.phone.replace(/\s/g, '')}`}
                                            className="flex-1 py-2 px-3 bg-red-600 hover:bg-red-500 active:scale-95 rounded-xl font-bold text-xs flex items-center justify-center gap-1.5 transition-all shadow-md border border-red-400/40"
                                            style={{ color: '#FFFFFF', textDecoration: 'none' }}
                                        >
                                            <Phone size={13} className="text-white fill-current" />
                                            <span style={{ color: '#FFFFFF' }} className="font-bold">Call</span>
                                        </a>
                                    )}
                                    {zone.googleMapsUri && (
                                        <a
                                            href={zone.googleMapsUri}
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
            <RecenterController center={center} zoom={zoom} triggerFocus={triggerFocus} />
            <FloatingControls onRecenter={onLocateMe || (() => {})} />

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
                    color: #FFFFFF !important;
                    border: 1px solid rgba(255, 255, 255, 0.12) !important;
                    border-radius: 14px !important;
                    box-shadow: 0 10px 36px rgba(0,0,0,0.9) !important;
                }
                .leaflet-container a, .leaflet-popup-content a {
                    color: #FFFFFF !important;
                    text-decoration: none !important;
                }
                .leaflet-popup-content {
                    margin: 8px 12px !important;
                    line-height: 1.4 !important;
                }
                .custom-pulsing-icon, .custom-member-icon, .sz-marker { 
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
    );
}
