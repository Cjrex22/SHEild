import { haversineKm } from './safeZonesData';

export const BENNETT_UNIVERSITY = {
    name: 'Bennett University, Greater Noida',
    lat: 28.4506,
    lng: 77.5842,
    radiusKm: 1.5,
};

/**
 * Normalizes reverse-geocoded location names to user-friendly recognized landmarks.
 * Replaces technical or historical cadastral/revenue village names (such as "Madhaiya Maincha")
 * with recognized campus names ("Bennett University, Greater Noida").
 */
export function formatLocationName(rawName?: string | null, lat?: number | null, lng?: number | null): string {
    if (!rawName && !lat && !lng) return 'Location unavailable';

    const clean = (rawName || '').trim();

    // 1. Direct coordinate proximity check for Bennett University (within 1.5 km)
    if (lat && lng && lat !== 0 && lng !== 0) {
        const distToBennett = haversineKm(lat, lng, BENNETT_UNIVERSITY.lat, BENNETT_UNIVERSITY.lng);
        if (distToBennett <= BENNETT_UNIVERSITY.radiusKm) {
            return BENNETT_UNIVERSITY.name;
        }
    }

    // 2. Name check for historical revenue village / cadastral names enclosing Bennett University
    const lower = clean.toLowerCase();
    if (
        lower.includes('madhaiya maincha') || 
        lower.includes('madhaiya') || 
        lower.includes('maincha') ||
        lower.includes('techzone ii') ||
        lower.includes('techzone 2') ||
        lower.includes('tech zone 2')
    ) {
        return BENNETT_UNIVERSITY.name;
    }

    // Return original cleaned location name
    return clean || 'Current Area';
}
