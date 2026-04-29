'use client';

/**
 * AddProjectWizard — F22
 *
 * 2-step modal wizard for creating a project hierarchy.
 *
 *   Step 1 — Project shell  : name, type, construction status, city,
 *                             location, sector. Required to create.
 *   Step 2 — Optional units  : add a first tower with a flat list of units.
 *                              Each unit captures floor, unit no, typology,
 *                              size, status, owner basics. Skippable —
 *                              brokers often want to capture the project
 *                              shell first and back-fill units later.
 *
 * Wires three sequential calls when fully filled:
 *   POST /api/projects                        → projectId
 *   POST /api/projects/[id]/towers            → towerId
 *   N × POST /api/projects/[id]/towers/[t]/units
 *
 * Server-side gate is on every call (feature.projects_working).
 */

import { useState, type FormEvent } from 'react';
import { Plus, X, ArrowLeft, ArrowRight, Check, Trash2 } from 'lucide-react';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { Alert } from '@/components/common/Alert';

interface UnitDraft {
  floor: string;
  unitNo: string;
  typology: string;
  size: string;
  status: string;
  ownerName: string;
  ownerPhone: string;
  remarks: string;
}

const EMPTY_UNIT: UnitDraft = {
  floor: '',
  unitNo: '',
  typology: '',
  size: '',
  status: 'Vacant',
  ownerName: '',
  ownerPhone: '',
  remarks: '',
};

const UNIT_STATUSES = ['Vacant', 'SelfOccupied', 'Rented', 'ForSale', 'Sold'] as const;

interface Props {
  onClose: () => void;
  onCreated: () => void;
}

export function AddProjectWizard({ onClose, onCreated }: Props) {
  const [step, setStep] = useState<1 | 2>(1);

  // Step 1
  const [name, setName] = useState('');
  const [propertyType, setPropertyType] = useState<'Residential' | 'Commercial'>('Residential');
  const [constructionStatus, setConstructionStatus] = useState<'ReadyToMove' | 'UnderConstruction'>('ReadyToMove');
  const [city, setCity] = useState('');
  const [location, setLocation] = useState('');
  const [sector, setSector] = useState('');

  // Step 2
  const [towerName, setTowerName] = useState('');
  const [units, setUnits] = useState<UnitDraft[]>([]);

  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  function addUnit() {
    setUnits((u) => [...u, { ...EMPTY_UNIT }]);
  }
  function updateUnit(idx: number, patch: Partial<UnitDraft>) {
    setUnits((u) => u.map((row, i) => (i === idx ? { ...row, ...patch } : row)));
  }
  function removeUnit(idx: number) {
    setUnits((u) => u.filter((_, i) => i !== idx));
  }

  function goNext(e: FormEvent) {
    e.preventDefault();
    if (!name.trim()) {
      setError('Project name is required.');
      return;
    }
    setError(null);
    setStep(2);
  }

  async function submitAll() {
    setSubmitting(true);
    setError(null);
    try {
      // 1) project shell
      const projectRes = await fetch('/api/projects', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          propertyType,
          constructionStatus,
          city: city || null,
          location: location || null,
          sector: sector || null,
        }),
      });
      // Defensive: if the server returned an HTML error page (e.g. a Next.js
      // crash before the route handler fired), .json() throws. Catch it so
      // we surface a stable string instead of a parse error.
      const project = await projectRes.json().catch(() => ({} as { error?: string; detail?: string }));
      if (!projectRes.ok) {
        const detail = (project as { detail?: string }).detail;
        throw new Error(
          [(project as { error?: string }).error, detail].filter(Boolean).join(' — ') ||
            `Project create failed (HTTP ${projectRes.status})`
        );
      }

      // 2) optional tower + units
      const trimmedTower = towerName.trim();
      const validUnits = units.filter((u) => u.unitNo.trim());

      if (trimmedTower || validUnits.length > 0) {
        const towerNameToUse = trimmedTower || 'Tower 1';
        const towerRes = await fetch(`/api/projects/${project.id}/towers`, {
          method: 'POST',
          credentials: 'include',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ name: towerNameToUse }),
        });
        const tower = await towerRes.json().catch(() => ({} as { error?: string }));
        if (!towerRes.ok) {
          throw new Error((tower as { error?: string }).error || `Tower create failed (HTTP ${towerRes.status})`);
        }

        for (const u of validUnits) {
          const unitRes = await fetch(
            `/api/projects/${project.id}/towers/${tower.id}/units`,
            {
              method: 'POST',
              credentials: 'include',
              headers: { 'Content-Type': 'application/json' },
              body: JSON.stringify({
                floor: Number(u.floor) || 0,
                unitNo: u.unitNo.trim(),
                typology: u.typology || null,
                size: u.size || null,
                status: u.status,
                ownerName: u.ownerName || null,
                ownerPhones: u.ownerPhone ? [u.ownerPhone.trim()] : [],
                remarks: u.remarks || null,
              }),
            }
          );
          if (!unitRes.ok) {
            const j = await unitRes.json();
            // best-effort: surface the first failed unit but keep the
            // already-saved rows in the database. The user can re-edit.
            throw new Error(`Unit ${u.unitNo}: ${j.error || 'create failed'}`);
          }
        }
      }

      onCreated();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-3xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {step === 1 ? 'New Project — Step 1 of 2' : 'New Project — Step 2 of 2'}
          </h2>
          <button
            type="button"
            onClick={onClose}
            aria-label="Close"
            className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400"
          >
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {error && <Alert type="error" message={error} />}

          {step === 1 && (
            <form onSubmit={goNext} className="space-y-4" id="project-step-1">
              <Input
                label="Project Name *"
                placeholder="e.g. DLF Cyber City"
                value={name}
                onChange={(e) => setName(e.target.value)}
                required
              />
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Property Type *</label>
                  <select
                    value={propertyType}
                    onChange={(e) => setPropertyType(e.target.value as typeof propertyType)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="Residential">Residential</option>
                    <option value="Commercial">Commercial</option>
                  </select>
                </div>
                <div>
                  <label className="block text-sm font-medium text-gray-700 mb-1">Construction Status *</label>
                  <select
                    value={constructionStatus}
                    onChange={(e) => setConstructionStatus(e.target.value as typeof constructionStatus)}
                    className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                  >
                    <option value="ReadyToMove">Ready To Move</option>
                    <option value="UnderConstruction">Under Construction</option>
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
                <Input label="City" placeholder="e.g. Gurgaon" value={city} onChange={(e) => setCity(e.target.value)} />
                <Input label="Location / Locality" placeholder="e.g. Golf Course Road" value={location} onChange={(e) => setLocation(e.target.value)} />
                <Input label="Sector" placeholder="e.g. Sector 24" value={sector} onChange={(e) => setSector(e.target.value)} />
              </div>
            </form>
          )}

          {step === 2 && (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Optional — add a first tower and any units you have on hand. You can leave this
                blank and back-fill from the project page later.
              </p>

              <Input
                label="Tower Name (defaults to “Tower 1”)"
                placeholder="e.g. Tower B"
                value={towerName}
                onChange={(e) => setTowerName(e.target.value)}
              />

              <div className="space-y-3">
                {units.map((u, idx) => (
                  <div key={idx} className="border border-gray-200 rounded-xl p-3 space-y-2 relative">
                    <button
                      type="button"
                      onClick={() => removeUnit(idx)}
                      aria-label={`Remove unit ${idx + 1}`}
                      className="absolute top-2 right-2 w-7 h-7 rounded-lg border border-red-200 bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center"
                    >
                      <Trash2 size={14} />
                    </button>
                    <p className="text-xs text-gray-400 uppercase tracking-wider font-semibold">
                      Unit {idx + 1}
                    </p>
                    <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                      <Input label="Floor" type="number" placeholder="12" value={u.floor} onChange={(e) => updateUnit(idx, { floor: e.target.value })} />
                      <Input label="Unit No *" placeholder="B-1204" value={u.unitNo} onChange={(e) => updateUnit(idx, { unitNo: e.target.value })} />
                      <Input label="Typology" placeholder="3BHK" value={u.typology} onChange={(e) => updateUnit(idx, { typology: e.target.value })} />
                      <Input label="Size" placeholder="1850 sqft" value={u.size} onChange={(e) => updateUnit(idx, { size: e.target.value })} />
                    </div>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                      <div>
                        <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                        <select
                          value={u.status}
                          onChange={(e) => updateUnit(idx, { status: e.target.value })}
                          className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        >
                          {UNIT_STATUSES.map((s) => (
                            <option key={s} value={s}>{s}</option>
                          ))}
                        </select>
                      </div>
                      <Input label="Owner" placeholder="Rajesh Kumar" value={u.ownerName} onChange={(e) => updateUnit(idx, { ownerName: e.target.value })} />
                      <Input label="Owner Phone" placeholder="+91 …" value={u.ownerPhone} onChange={(e) => updateUnit(idx, { ownerPhone: e.target.value })} />
                    </div>
                    <Input label="Remarks" placeholder="any notes…" value={u.remarks} onChange={(e) => updateUnit(idx, { remarks: e.target.value })} />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addUnit}
                  className="inline-flex items-center gap-1.5 text-sm font-medium text-blue-600 hover:text-blue-700"
                >
                  <Plus size={14} /> Add Unit
                </button>
              </div>
            </div>
          )}
        </div>

        <div className="flex justify-between gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          {step === 2 ? (
            <Button type="button" variant="outline" onClick={() => setStep(1)} icon={<ArrowLeft size={16} />}>
              Back
            </Button>
          ) : (
            <span />
          )}
          <div className="flex justify-end gap-2">
            <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
            {step === 1 ? (
              <Button type="submit" form="project-step-1">
                Next <ArrowRight size={16} className="ml-1" />
              </Button>
            ) : (
              <Button type="button" disabled={submitting} onClick={submitAll}>
                {submitting ? 'Saving…' : (
                  <>
                    <Check size={16} className="mr-1" /> Create Project
                  </>
                )}
              </Button>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
