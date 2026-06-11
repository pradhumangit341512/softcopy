/**
 * Geo helpers for HR check-in (Enterprise HR plan, P2).
 *
 * All distance math is server-side — the browser only supplies raw lat/lng/
 * accuracy, and the server decides whether a check-in is within a geofence.
 * Never trust the client to enforce the office boundary.
 */

export interface OfficeLocation {
  name: string;
  lat: number;
  lng: number;
  radiusMeters: number;
}

const EARTH_RADIUS_M = 6_371_000;
const toRad = (deg: number) => (deg * Math.PI) / 180;

/** Great-circle distance between two lat/lng points, in metres (Haversine). */
export function haversineMeters(lat1: number, lng1: number, lat2: number, lng2: number): number {
  const dLat = toRad(lat2 - lat1);
  const dLng = toRad(lng2 - lng1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLng / 2) ** 2;
  return 2 * EARTH_RADIUS_M * Math.asin(Math.min(1, Math.sqrt(a)));
}

export interface NearestOffice {
  office: OfficeLocation | null;
  distance: number;       // metres to the nearest office (Infinity if none)
  within: boolean;        // inside that office's radius?
}

/** Find the closest office to a point and whether the point is inside its radius. */
export function nearestOffice(
  lat: number,
  lng: number,
  offices: readonly OfficeLocation[]
): NearestOffice {
  let best: NearestOffice = { office: null, distance: Infinity, within: false };
  for (const o of offices) {
    const distance = haversineMeters(lat, lng, o.lat, o.lng);
    if (distance < best.distance) {
      best = { office: o, distance, within: distance <= o.radiusMeters };
    }
  }
  return best;
}

/** Basic sanity check on a coordinate pair. */
export function isValidLatLng(lat: unknown, lng: unknown): lat is number {
  return (
    typeof lat === 'number' && typeof lng === 'number' &&
    Number.isFinite(lat) && Number.isFinite(lng) &&
    lat >= -90 && lat <= 90 && lng >= -180 && lng <= 180
  );
}
