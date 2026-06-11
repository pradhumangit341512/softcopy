'use client';

/**
 * Interactive Google-Maps picker for an office geofence.
 *
 * The marker position is the source of truth for the office lat/lng. Three ways
 * to set it, all of which call onChange(lat, lng):
 *   - "Use my location"  → browser GPS (recenters the map on the pin)
 *   - click the map      → drops/moves the pin where you tapped
 *   - drag the pin       → fine-tune the exact spot
 * A translucent circle previews the check-in radius around the pin.
 *
 * Needs NEXT_PUBLIC_GOOGLE_MAPS_API_KEY. Geolocation needs a secure (https/
 * localhost) origin — handled with a clear message when it isn't.
 */

import { useEffect, useRef, useState } from 'react';
import { APIProvider, Map, Marker, useMap } from '@vis.gl/react-google-maps';
import { LocateFixed } from 'lucide-react';

interface Props {
  lat: number;
  lng: number;
  radiusMeters: number;
  onChange: (lat: number, lng: number) => void;
}

// New Delhi — only used to frame the map before a pin exists.
const DEFAULT_CENTER = { lat: 28.6139, lng: 77.209 };

function isValidCoord(lat: number, lng: number): boolean {
  return Number.isFinite(lat) && Number.isFinite(lng) && (lat !== 0 || lng !== 0);
}

/** Imperatively draws + updates the geofence circle around the pin. */
function RadiusCircle({ lat, lng, radius }: { lat: number; lng: number; radius: number }) {
  const map = useMap();
  const circleRef = useRef<google.maps.Circle | null>(null);

  useEffect(() => {
    if (!map) return;
    if (!circleRef.current) {
      circleRef.current = new google.maps.Circle({
        strokeColor: '#2563eb', strokeOpacity: 0.8, strokeWeight: 1,
        fillColor: '#3b82f6', fillOpacity: 0.15, clickable: false, map,
      });
    }
    circleRef.current.setCenter({ lat, lng });
    circleRef.current.setRadius(Math.max(10, radius || 0));
  }, [map, lat, lng, radius]);

  useEffect(() => () => { circleRef.current?.setMap(null); circleRef.current = null; }, []);
  return null;
}

/** "Use my location" overlay button — recenters the map on the captured point. */
function LocateButton({ onLocated }: { onLocated: (lat: number, lng: number) => void }) {
  const map = useMap();
  const [busy, setBusy] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  function locate() {
    setErr(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setErr('Location not supported on this device.');
      return;
    }
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setErr('Location needs https:// — open the app on a secure URL.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      (pos) => {
        const la = Number(pos.coords.latitude.toFixed(6));
        const ln = Number(pos.coords.longitude.toFixed(6));
        onLocated(la, ln);
        map?.panTo({ lat: la, lng: ln });
        map?.setZoom(17);
        setBusy(false);
      },
      (e) => {
        setErr(e.code === e.PERMISSION_DENIED ? 'Location permission denied.' : 'Could not get your location.');
        setBusy(false);
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  return (
    <div className="absolute top-2 right-2 flex flex-col items-end gap-1">
      <button
        type="button"
        onClick={locate}
        disabled={busy}
        className="flex items-center gap-1 px-2.5 py-1.5 text-[11px] font-semibold text-blue-700 bg-white/95 shadow-sm border border-gray-200 hover:bg-blue-50 rounded-md transition-colors disabled:opacity-60"
      >
        <LocateFixed size={12} className={busy ? 'animate-pulse' : ''} /> {busy ? 'Locating…' : 'Use my location'}
      </button>
      {err && <span className="px-2 py-1 text-[10px] text-red-600 bg-white/95 rounded shadow-sm max-w-[180px] text-right">{err}</span>}
    </div>
  );
}

export function OfficeMapPicker({ lat, lng, radiusMeters, onChange }: Props) {
  const apiKey = process.env.NEXT_PUBLIC_GOOGLE_MAPS_API_KEY;
  const hasPin = isValidCoord(lat, lng);

  if (!apiKey) {
    return (
      <div className="rounded-lg border border-dashed border-gray-200 bg-gray-50 px-3 py-4 text-center text-[11px] text-gray-400">
        Map unavailable — set NEXT_PUBLIC_GOOGLE_MAPS_API_KEY to enable the location picker.
      </div>
    );
  }

  return (
    <APIProvider apiKey={apiKey}>
      <div className="relative rounded-lg overflow-hidden border border-gray-200">
        <Map
          style={{ width: '100%', height: 200 }}
          defaultCenter={hasPin ? { lat, lng } : DEFAULT_CENTER}
          defaultZoom={hasPin ? 17 : 11}
          gestureHandling="greedy"
          disableDefaultUI
          zoomControl
          clickableIcons={false}
          onClick={(e) => {
            const ll = e.detail.latLng;
            if (ll) onChange(Number(ll.lat.toFixed(6)), Number(ll.lng.toFixed(6)));
          }}
        >
          {hasPin && (
            <Marker
              position={{ lat, lng }}
              draggable
              onDragEnd={(e) => {
                if (e.latLng) onChange(Number(e.latLng.lat().toFixed(6)), Number(e.latLng.lng().toFixed(6)));
              }}
            />
          )}
          {hasPin && <RadiusCircle lat={lat} lng={lng} radius={radiusMeters} />}
        </Map>
        <LocateButton onLocated={onChange} />
        {!hasPin && (
          <div className="pointer-events-none absolute inset-x-0 bottom-0 bg-gradient-to-t from-black/50 to-transparent px-3 py-2 text-[11px] font-medium text-white">
            Tap the map or “Use my location” to place this office.
          </div>
        )}
      </div>
    </APIProvider>
  );
}
