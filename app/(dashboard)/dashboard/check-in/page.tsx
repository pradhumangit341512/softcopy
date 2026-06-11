'use client';

import { useCallback, useEffect, useState } from 'react';
import { MapPin, CheckCircle2, LocateFixed } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { FeatureLocked } from '@/components/common/FeatureLocked';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';

interface CheckInStatus {
  geoEnabled: boolean;
  mode: string;
  today: string;
  checkedIn: { status: string; source: string; checkInAt: string | null; withinGeofence: boolean | null } | null;
}

/** Member self check-in. Captures location one-shot; the server validates the
 * geofence and marks attendance. */
export default function CheckInPage() {
  const { user, isLoading: authLoading } = useAuth();
  const canPayroll = useFeature('feature.payroll');

  const [status, setStatus] = useState<CheckInStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  const fetchStatus = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch('/api/payroll/check-in', { credentials: 'include', cache: 'no-store' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to load');
      setStatus(j);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !user?.id || !canPayroll) return;
    fetchStatus();
  }, [authLoading, user?.id, canPayroll, fetchStatus]);

  function checkIn() {
    setError(null);
    setSuccess(null);
    if (typeof navigator === 'undefined' || !navigator.geolocation) {
      setError('Location is not supported on this device/browser.');
      return;
    }
    // Geolocation only works on a secure origin (HTTPS or localhost). Opening
    // the app over a plain http://<ip> link (common on phones during testing)
    // makes the browser reject location with a misleading "permission denied".
    if (typeof window !== 'undefined' && !window.isSecureContext) {
      setError('Location needs a secure (https://) connection. Open the app via its https address — a plain http link blocks location on most phones.');
      return;
    }
    setBusy(true);
    navigator.geolocation.getCurrentPosition(
      async (pos) => {
        try {
          const { latitude, longitude, accuracy } = pos.coords;
          const res = await fetch('/api/payroll/check-in', {
            method: 'POST',
            credentials: 'include',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ lat: latitude, lng: longitude, accuracy }),
          });
          const j = await res.json();
          if (!res.ok) {
            setError(j.error || 'Check-in failed.');
          } else {
            setSuccess(
              j.alreadyMarked
                ? 'You are already marked for today.'
                : `Checked in${j.office ? ` near ${j.office}` : ''}. Have a great day!`
            );
            await fetchStatus();
          }
        } catch {
          setError('Check-in failed. Please try again.');
        } finally {
          setBusy(false);
        }
      },
      (err) => {
        setBusy(false);
        setError(
          err.code === err.PERMISSION_DENIED
            ? 'Location permission denied. Tap the lock/location icon in your browser’s address bar and allow location, then try again.'
            : err.code === err.TIMEOUT
            ? 'Getting your location timed out. Move to an open area and try again.'
            : 'Could not get your location. Move to an open area and try again.'
        );
      },
      { enableHighAccuracy: true, timeout: 15000, maximumAge: 0 }
    );
  }

  if (authLoading) return <div className="py-16"><Loader size="lg" message="Loading..." /></div>;
  if (!canPayroll) return <FeatureLocked feature="feature.payroll" />;

  const checkedIn = status?.checkedIn;
  const disabled = !status?.geoEnabled || status?.mode === 'manual';

  return (
    <div className="py-6 sm:py-10 max-w-md mx-auto px-4">
      <div className="text-center mb-6">
        <div className="w-14 h-14 rounded-2xl bg-blue-50 flex items-center justify-center mx-auto mb-3">
          <MapPin size={26} className="text-blue-600" />
        </div>
        <h1 className="text-xl sm:text-2xl font-bold text-gray-900">Check in</h1>
        <p className="text-gray-500 text-sm mt-0.5">Mark your attendance for today</p>
      </div>

      {error && <Alert type="error" message={error} onClose={() => setError(null)} />}
      {success && <Alert type="success" message={success} onClose={() => setSuccess(null)} />}

      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-6 mt-4">
        {loading ? (
          <Loader message="Loading..." />
        ) : disabled ? (
          <p className="text-sm text-gray-500 text-center">
            {status?.mode === 'manual'
              ? 'Your attendance is marked by your admin.'
              : 'Geo check-in is not enabled for your company yet.'}
          </p>
        ) : checkedIn ? (
          <div className="text-center space-y-2">
            <CheckCircle2 size={40} className="text-green-500 mx-auto" />
            <p className="text-sm font-semibold text-gray-900">You&apos;re checked in for today</p>
            {checkedIn.checkInAt && (
              <p className="text-xs text-gray-500">
                at {new Date(checkedIn.checkInAt).toLocaleTimeString('en-IN', { hour: '2-digit', minute: '2-digit' })}
                {checkedIn.source === 'geo' && checkedIn.withinGeofence === false ? ' · off-site' : ''}
              </p>
            )}
          </div>
        ) : (
          <div className="space-y-4">
            <p className="text-sm text-gray-600 text-center">
              {status?.mode === 'field'
                ? 'Tap to check in from your current location.'
                : 'Tap to check in. You must be at your office location.'}
            </p>
            <button
              type="button"
              onClick={checkIn}
              disabled={busy}
              className="w-full flex items-center justify-center gap-2 px-4 py-3 text-sm font-semibold text-white
                bg-blue-600 hover:bg-blue-700 rounded-xl transition-colors disabled:opacity-60 disabled:cursor-not-allowed"
            >
              <LocateFixed size={18} className={busy ? 'animate-pulse' : ''} />
              {busy ? 'Getting your location…' : 'Check in now'}
            </button>
            <p className="text-[11px] text-gray-400 text-center">
              Your location is used once, only to confirm this check-in.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
