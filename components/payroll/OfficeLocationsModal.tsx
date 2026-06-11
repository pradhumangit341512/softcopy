'use client';

import { useEffect, useState, type ReactNode } from 'react';
import { MapPin, Plus, Trash2 } from 'lucide-react';
import { Modal } from '@/components/common/Modal';
import { Alert } from '@/components/common/Alert';
import { OfficeMapPicker } from './OfficeMapPicker';

interface Office { name: string; lat: number; lng: number; radiusMeters: number }

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onSaved?: () => void;
}

const blankOffice = (): Office => ({ name: '', lat: 0, lng: 0, radiusMeters: 200 });

/** Admin configures geo check-in: enable toggle + office geofences. */
export function OfficeLocationsModal({ isOpen, onClose, onSaved }: Props) {
  const [enabled, setEnabled] = useState(false);
  const [offices, setOffices] = useState<Office[]>([]);
  const [loading, setLoading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) return;
    setError(null);
    setLoading(true);
    fetch('/api/payroll/settings', { credentials: 'include', cache: 'no-store' })
      .then(async (r) => {
        const j = await r.json();
        if (!r.ok) throw new Error(j.error || 'Failed to load');
        return j as { geoCheckInEnabled: boolean; officeLocations: Office[] };
      })
      .then((j) => { setEnabled(j.geoCheckInEnabled); setOffices(j.officeLocations ?? []); })
      .catch((e: unknown) => setError(e instanceof Error ? e.message : String(e)))
      .finally(() => setLoading(false));
  }, [isOpen]);

  function update(i: number, patch: Partial<Office>) {
    setOffices((prev) => prev.map((o, idx) => (idx === i ? { ...o, ...patch } : o)));
  }

  async function submit() {
    setSubmitting(true);
    setError(null);
    try {
      const cleaned = offices
        .map((o) => ({ ...o, name: o.name.trim() }))
        .filter((o) => o.name.length > 0);
      const res = await fetch('/api/payroll/settings', {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ geoCheckInEnabled: enabled, officeLocations: cleaned }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to save');
      onSaved?.();
      onClose();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setSubmitting(false);
    }
  }

  const inp = 'border border-gray-300 rounded-lg px-2 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-blue-500';

  return (
    <Modal
      isOpen={isOpen}
      title="Geo check-in settings"
      onClose={onClose}
      onSubmit={submitting || loading ? undefined : submit}
      submitText={submitting ? 'Saving...' : 'Save settings'}
      size="lg"
    >
      <div className="space-y-4">
        {error && <Alert type="error" message={error} />}

        <label className="flex items-center gap-2 text-sm font-medium text-gray-800">
          <input type="checkbox" checked={enabled} onChange={(e) => setEnabled(e.target.checked)} className="w-4 h-4 rounded border-gray-300 text-blue-600" />
          Enable location-based check-in for the team
        </label>

        <div className="space-y-2">
          <div className="flex items-center justify-between">
            <p className="text-sm font-semibold text-gray-700 flex items-center gap-1.5"><MapPin size={15} className="text-blue-500" /> Office locations</p>
            <button type="button" onClick={() => setOffices((p) => [...p, blankOffice()])} className="flex items-center gap-1 text-xs font-medium text-blue-600 hover:text-blue-800">
              <Plus size={13} /> Add office
            </button>
          </div>

          {offices.length === 0 ? (
            <div className="rounded-xl border border-dashed border-gray-200 bg-gray-50/50 px-4 py-6 text-center">
              <MapPin size={20} className="mx-auto text-gray-300" />
              <p className="mt-1.5 text-xs text-gray-500">No offices yet.</p>
              <p className="text-[11px] text-gray-400">Add one, then tap “Use my location” on the map while standing at the office.</p>
            </div>
          ) : (
            <div className="space-y-3">
              {offices.map((o, i) => (
                <div key={i} className="rounded-xl border border-gray-200 bg-gray-50/60 p-3">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <span className="text-xs font-semibold text-gray-500">Office {i + 1}</span>
                    <button type="button" onClick={() => setOffices((p) => p.filter((_, idx) => idx !== i))} title="Remove office" className="w-6 h-6 rounded-md border border-red-100 flex items-center justify-center text-red-400 hover:bg-red-50 transition-colors">
                      <Trash2 size={13} />
                    </button>
                  </div>
                  <div className="mb-2">
                    <OfficeMapPicker
                      lat={o.lat}
                      lng={o.lng}
                      radiusMeters={o.radiusMeters}
                      onChange={(lat, lng) => update(i, { lat, lng })}
                    />
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-12 gap-2">
                    <Field label="Name" className="col-span-2 sm:col-span-5">
                      <input className={`${inp} w-full`} placeholder="e.g. Head Office" value={o.name} onChange={(e) => update(i, { name: e.target.value })} />
                    </Field>
                    <Field label="Latitude" className="col-span-1 sm:col-span-3">
                      <input className={`${inp} w-full`} type="number" step="0.000001" inputMode="decimal" placeholder="28.6139" value={o.lat || ''} onChange={(e) => update(i, { lat: Number(e.target.value) })} />
                    </Field>
                    <Field label="Longitude" className="col-span-1 sm:col-span-3">
                      <input className={`${inp} w-full`} type="number" step="0.000001" inputMode="decimal" placeholder="77.2090" value={o.lng || ''} onChange={(e) => update(i, { lng: Number(e.target.value) })} />
                    </Field>
                    <Field label="Radius (m)" className="col-span-2 sm:col-span-1">
                      <input className={`${inp} w-full`} type="number" min={10} max={5000} value={o.radiusMeters} onChange={(e) => update(i, { radiusMeters: Math.max(10, Math.min(5000, Number(e.target.value) || 200)) })} title="Radius (metres)" />
                    </Field>
                  </div>
                </div>
              ))}
            </div>
          )}
          <p className="text-[11px] text-gray-400">
            Radius is the allowed distance (metres) from the office. 150–300 m works well — too tight causes false “out of range”.
          </p>
        </div>
      </div>
    </Modal>
  );
}

/** Compact labelled field wrapper for the office grid. */
function Field({ label, className, children }: { label: string; className?: string; children: ReactNode }) {
  return (
    <label className={`flex flex-col gap-1 ${className ?? ''}`}>
      <span className="text-[10px] font-medium uppercase tracking-wide text-gray-400">{label}</span>
      {children}
    </label>
  );
}
