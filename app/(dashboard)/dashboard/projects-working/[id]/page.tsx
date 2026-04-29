'use client';

/**
 * Project detail — F17 polish
 *
 * Shows a project with its towers + units. Inline "Add Tower" and "Add Unit"
 * dialogs let admins extend the hierarchy without leaving the page.
 *
 * The big add wizard (F22) is for creating brand-new projects. From this
 * page we use slim per-row prompts because the user already has the
 * project context and rarely needs more than 4 fields per unit.
 */

import { use, useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { ArrowLeft, Plus, Building2, Trash2, Pencil, Check, X } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { FeatureLocked } from '@/components/common/FeatureLocked';
import { useConfirm } from '@/components/common/ConfirmDialog';
import type { Project, Tower, Unit } from '@/lib/types';

type FullProject = Project & { towers?: (Tower & { units?: Unit[] })[] };

const UNIT_STATUSES = ['Vacant', 'SelfOccupied', 'Rented', 'ForSale', 'Sold'] as const;

export default function ProjectDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const { id } = use(params);
  const { isLoading: authLoading } = useAuth();
  const enabled = useFeature('feature.projects_working');
  const confirm = useConfirm();

  const [project, setProject] = useState<FullProject | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add-tower form
  const [showAddTower, setShowAddTower] = useState(false);
  const [newTowerName, setNewTowerName] = useState('');

  // Add-unit form: keyed by towerId so each tower has its own draft state
  const [unitDraftFor, setUnitDraftFor] = useState<string | null>(null);
  const [unitDraft, setUnitDraft] = useState({
    floor: '',
    unitNo: '',
    typology: '',
    size: '',
    status: 'Vacant',
    ownerName: '',
    ownerPhone: '',
  });

  // Inline edit state — at most one tower or unit is being edited at a time
  // (overwriting one editor opens the other). Stored as id strings so the
  // children can match without prop-drilling editing flags through.
  const [editingTowerId, setEditingTowerId] = useState<string | null>(null);
  const [editingTowerName, setEditingTowerName] = useState('');
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnit, setEditingUnit] = useState({
    floor: '',
    unitNo: '',
    typology: '',
    size: '',
    status: 'Vacant',
    ownerName: '',
    ownerPhone: '',
  });

  const fetchProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, { credentials: 'include' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to fetch project');
      setProject(j);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch project');
    } finally {
      setLoading(false);
    }
  }, [id]);

  useEffect(() => {
    if (authLoading || !enabled) return;
    fetchProject();
  }, [authLoading, enabled, fetchProject]);

  async function handleAddTower() {
    const trimmed = newTowerName.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/projects/${id}/towers`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Failed to add tower');
      }
      setNewTowerName('');
      setShowAddTower(false);
      fetchProject();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add tower');
    }
  }

  async function handleAddUnit(towerId: string) {
    if (!unitDraft.unitNo.trim()) return;
    try {
      const res = await fetch(`/api/projects/${id}/towers/${towerId}/units`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          floor: Number(unitDraft.floor) || 0,
          unitNo: unitDraft.unitNo.trim(),
          typology: unitDraft.typology || null,
          size: unitDraft.size || null,
          status: unitDraft.status,
          ownerName: unitDraft.ownerName || null,
          ownerPhones: unitDraft.ownerPhone ? [unitDraft.ownerPhone.trim()] : [],
        }),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Failed to add unit');
      }
      setUnitDraft({
        floor: '', unitNo: '', typology: '', size: '',
        status: 'Vacant', ownerName: '', ownerPhone: '',
      });
      setUnitDraftFor(null);
      fetchProject();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to add unit');
    }
  }

  function startEditTower(tower: Tower) {
    setEditingUnitId(null);
    setEditingTowerId(tower.id);
    setEditingTowerName(tower.name);
  }

  async function handleSaveTower(towerId: string) {
    const trimmed = editingTowerName.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/projects/${id}/towers/${towerId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed to rename tower (HTTP ${res.status})`);
      }
      setEditingTowerId(null);
      fetchProject();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to rename tower');
    }
  }

  async function handleDeleteTower(towerId: string, towerName: string) {
    const ok = await confirm({
      title: `Delete tower “${towerName}”?`,
      message: 'All units inside this tower will be hidden from the team. The data is preserved in the database for recovery.',
      tone: 'danger',
      confirmText: 'Delete tower',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/projects/${id}/towers/${towerId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to delete tower');
      }
      fetchProject();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete tower');
    }
  }

  function startEditUnit(unit: Unit) {
    setEditingTowerId(null);
    setEditingUnitId(unit.id);
    setEditingUnit({
      floor: String(unit.floor ?? ''),
      unitNo: unit.unitNo ?? '',
      typology: unit.typology ?? '',
      size: unit.size ?? '',
      status: unit.status ?? 'Vacant',
      ownerName: unit.ownerName ?? '',
      ownerPhone: (unit.ownerPhones?.[0]) ?? '',
    });
  }

  async function handleSaveUnit(towerId: string, unitId: string) {
    if (!editingUnit.unitNo.trim()) return;
    try {
      const res = await fetch(`/api/projects/${id}/towers/${towerId}/units/${unitId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          floor: Number(editingUnit.floor) || 0,
          unitNo: editingUnit.unitNo.trim(),
          typology: editingUnit.typology || null,
          size: editingUnit.size || null,
          status: editingUnit.status,
          ownerName: editingUnit.ownerName || null,
          ownerPhones: editingUnit.ownerPhone ? [editingUnit.ownerPhone.trim()] : [],
        }),
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || `Failed to update unit (HTTP ${res.status})`);
      }
      setEditingUnitId(null);
      fetchProject();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to update unit');
    }
  }

  async function handleDeleteUnit(towerId: string, unitId: string, unitNo: string) {
    const ok = await confirm({
      title: `Delete unit ${unitNo}?`,
      message: 'The unit will be hidden from this tower\'s list. Recoverable from the database, not from the UI.',
      tone: 'danger',
      confirmText: 'Delete unit',
    });
    if (!ok) return;
    try {
      const res = await fetch(`/api/projects/${id}/towers/${towerId}/units/${unitId}`, {
        method: 'DELETE',
        credentials: 'include',
      });
      if (!res.ok) {
        const j = await res.json().catch(() => ({}));
        throw new Error(j.error || 'Failed to delete unit');
      }
      fetchProject();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to delete unit');
    }
  }

  async function handleDeleteProject() {
    const ok = await confirm({
      title: 'Delete this project?',
      message: 'All towers and units inside will be hidden from the team. This is reversible from the database, but not from the app UI.',
      tone: 'danger',
      confirmText: 'Delete project',
    });
    if (!ok) return;
    const res = await fetch(`/api/projects/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      window.location.href = '/dashboard/projects-working';
    } else {
      const j = await res.json();
      setError(j.error || 'Delete failed');
    }
  }

  if (authLoading) return <Loader />;
  if (!enabled) return <FeatureLocked feature="feature.projects_working" />;

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">
      <div className="flex items-center gap-2">
        <Link
          href="/dashboard/projects-working"
          className="inline-flex items-center gap-1 text-sm text-gray-500 hover:text-gray-700"
        >
          <ArrowLeft size={14} /> Back to projects
        </Link>
      </div>

      {error && <Alert type="error" message={error} />}

      {loading || !project ? (
        <Loader message="Loading project…" />
      ) : (
        <>
          <div className="flex flex-col sm:flex-row sm:items-end sm:justify-between gap-3">
            <div>
              <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold text-gray-900">{project.name}</h1>
              <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
                {project.propertyType} ·{' '}
                {project.constructionStatus === 'ReadyToMove' ? 'Ready To Move' : 'Under Construction'}
                {(project.location || project.sector || project.city) && (
                  <>
                    {' · '}
                    {[project.location, project.sector, project.city].filter(Boolean).join(' · ')}
                  </>
                )}
              </p>
            </div>
            <button
              type="button"
              onClick={handleDeleteProject}
              className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-xl"
            >
              <Trash2 size={14} /> Delete project
            </button>
          </div>

          {/* Towers */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Building2 size={14} className="text-gray-400" />
                Towers ({project.towers?.length ?? 0})
              </h2>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowAddTower((v) => !v)}
                icon={<Plus size={14} />}
              >
                Add Tower
              </Button>
            </header>

            {showAddTower && (
              <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1">
                  <Input
                    label="Tower Name"
                    placeholder="e.g. Tower B"
                    value={newTowerName}
                    onChange={(e) => setNewTowerName(e.target.value)}
                  />
                </div>
                <Button type="button" onClick={handleAddTower} disabled={!newTowerName.trim()}>
                  Save
                </Button>
                <Button type="button" variant="outline" onClick={() => { setShowAddTower(false); setNewTowerName(''); }}>
                  Cancel
                </Button>
              </div>
            )}

            <ul className="divide-y divide-gray-100">
              {(project.towers ?? []).length === 0 && (
                <li className="px-4 py-8 text-center text-sm text-gray-400">
                  No towers yet. Click “Add Tower” to start.
                </li>
              )}
              {(project.towers ?? []).map((t) => (
                <li key={t.id} className="px-4 py-4">
                  <div className="flex items-center justify-between gap-2 mb-2 flex-wrap">
                    {editingTowerId === t.id ? (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <input
                          type="text"
                          value={editingTowerName}
                          onChange={(e) => setEditingTowerName(e.target.value)}
                          autoFocus
                          className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-blue-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                        />
                        <button
                          type="button"
                          onClick={() => handleSaveTower(t.id)}
                          disabled={!editingTowerName.trim()}
                          aria-label="Save tower name"
                          className="w-7 h-7 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center disabled:opacity-50"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTowerId(null)}
                          aria-label="Cancel tower rename"
                          className="w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 flex items-center justify-center"
                        >
                          <X size={14} />
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-2 flex-1 min-w-0">
                        <p className="font-semibold text-gray-900 truncate">{t.name}</p>
                        <button
                          type="button"
                          onClick={() => startEditTower(t)}
                          aria-label={`Rename tower ${t.name}`}
                          title="Rename"
                          className="w-7 h-7 rounded-lg border border-blue-100 bg-blue-50 text-blue-500 hover:bg-blue-100 flex items-center justify-center"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTower(t.id, t.name)}
                          aria-label={`Delete tower ${t.name}`}
                          title="Delete tower"
                          className="w-7 h-7 rounded-lg border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                    <span className="text-xs text-gray-400 shrink-0">
                      {t.units?.length ?? 0} unit{(t.units?.length ?? 0) === 1 ? '' : 's'}
                    </span>
                  </div>

                  {/* Units mini-table — Actions column reveals inline edit
                      and delete buttons. Row collapses into a full-width
                      edit panel below the table when the user clicks edit. */}
                  {(t.units?.length ?? 0) > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full text-xs min-w-[680px]">
                        <thead className="bg-gray-50 text-gray-500 uppercase tracking-wider">
                          <tr>
                            <th className="px-2 py-1.5 text-left">Floor</th>
                            <th className="px-2 py-1.5 text-left">Unit No</th>
                            <th className="px-2 py-1.5 text-left">Typology</th>
                            <th className="px-2 py-1.5 text-left">Size</th>
                            <th className="px-2 py-1.5 text-left">Status</th>
                            <th className="px-2 py-1.5 text-left">Owner</th>
                            <th className="px-2 py-1.5 text-center w-20">Actions</th>
                          </tr>
                        </thead>
                        <tbody className="divide-y divide-gray-100">
                          {(t.units ?? []).map((u) => (
                            <tr
                              key={u.id}
                              className={
                                editingUnitId === u.id
                                  ? 'bg-blue-50/50'
                                  : 'hover:bg-gray-50'
                              }
                            >
                              <td className="px-2 py-1.5 text-gray-700">{u.floor}</td>
                              <td className="px-2 py-1.5 font-medium text-gray-900">{u.unitNo}</td>
                              <td className="px-2 py-1.5 text-gray-700">{u.typology ?? '—'}</td>
                              <td className="px-2 py-1.5 text-gray-700">{u.size ?? '—'}</td>
                              <td className="px-2 py-1.5">
                                <span className="inline-flex px-2 py-0.5 rounded-full text-[10px] font-semibold bg-gray-100 text-gray-700">
                                  {u.status}
                                </span>
                              </td>
                              <td className="px-2 py-1.5 text-gray-700">{u.ownerName ?? '—'}</td>
                              <td className="px-2 py-1.5">
                                <div className="flex items-center justify-center gap-1">
                                  <button
                                    type="button"
                                    onClick={() => startEditUnit(u)}
                                    aria-label={`Edit unit ${u.unitNo}`}
                                    title="Edit unit"
                                    className="w-6 h-6 rounded border border-blue-100 bg-blue-50 text-blue-500 hover:bg-blue-100 flex items-center justify-center"
                                  >
                                    <Pencil size={11} />
                                  </button>
                                  <button
                                    type="button"
                                    onClick={() => handleDeleteUnit(t.id, u.id, u.unitNo)}
                                    aria-label={`Delete unit ${u.unitNo}`}
                                    title="Delete unit"
                                    className="w-6 h-6 rounded border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center"
                                  >
                                    <Trash2 size={11} />
                                  </button>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {/* Inline edit panel — appears when the user clicks the
                      pencil on a unit. Same shape as the add-unit form below
                      so users learn one layout. */}
                  {editingUnitId && (t.units ?? []).some((u) => u.id === editingUnitId) && (
                    <div className="mt-3 p-3 border border-blue-200 bg-blue-50/30 rounded-xl space-y-2">
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-blue-700">
                        Editing unit
                      </p>
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Input label="Floor" type="number" placeholder="12"
                          value={editingUnit.floor}
                          onChange={(e) => setEditingUnit({ ...editingUnit, floor: e.target.value })} />
                        <Input label="Unit No *" placeholder="B-1204"
                          value={editingUnit.unitNo}
                          onChange={(e) => setEditingUnit({ ...editingUnit, unitNo: e.target.value })} />
                        <Input label="Typology" placeholder="3BHK"
                          value={editingUnit.typology}
                          onChange={(e) => setEditingUnit({ ...editingUnit, typology: e.target.value })} />
                        <Input label="Size" placeholder="1850 sqft"
                          value={editingUnit.size}
                          onChange={(e) => setEditingUnit({ ...editingUnit, size: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                          <select
                            value={editingUnit.status}
                            onChange={(e) => setEditingUnit({ ...editingUnit, status: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {UNIT_STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <Input label="Owner" placeholder="Rajesh Kumar"
                          value={editingUnit.ownerName}
                          onChange={(e) => setEditingUnit({ ...editingUnit, ownerName: e.target.value })} />
                        <Input label="Owner Phone" placeholder="+91 …"
                          value={editingUnit.ownerPhone}
                          onChange={(e) => setEditingUnit({ ...editingUnit, ownerPhone: e.target.value })} />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={() => setEditingUnitId(null)}>
                          Cancel
                        </Button>
                        <Button
                          type="button"
                          onClick={() => handleSaveUnit(t.id, editingUnitId)}
                          disabled={!editingUnit.unitNo.trim()}
                        >
                          Save changes
                        </Button>
                      </div>
                    </div>
                  )}

                  {unitDraftFor === t.id ? (
                    <div className="mt-3 p-3 border border-gray-200 rounded-xl space-y-2">
                      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                        <Input label="Floor" type="number" placeholder="12"
                          value={unitDraft.floor} onChange={(e) => setUnitDraft({ ...unitDraft, floor: e.target.value })} />
                        <Input label="Unit No *" placeholder="B-1204"
                          value={unitDraft.unitNo} onChange={(e) => setUnitDraft({ ...unitDraft, unitNo: e.target.value })} />
                        <Input label="Typology" placeholder="3BHK"
                          value={unitDraft.typology} onChange={(e) => setUnitDraft({ ...unitDraft, typology: e.target.value })} />
                        <Input label="Size" placeholder="1850 sqft"
                          value={unitDraft.size} onChange={(e) => setUnitDraft({ ...unitDraft, size: e.target.value })} />
                      </div>
                      <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
                        <div>
                          <label className="block text-sm font-medium text-gray-700 mb-1">Status</label>
                          <select
                            value={unitDraft.status}
                            onChange={(e) => setUnitDraft({ ...unitDraft, status: e.target.value })}
                            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                          >
                            {UNIT_STATUSES.map((s) => (
                              <option key={s} value={s}>{s}</option>
                            ))}
                          </select>
                        </div>
                        <Input label="Owner" placeholder="Rajesh Kumar"
                          value={unitDraft.ownerName} onChange={(e) => setUnitDraft({ ...unitDraft, ownerName: e.target.value })} />
                        <Input label="Owner Phone" placeholder="+91 …"
                          value={unitDraft.ownerPhone} onChange={(e) => setUnitDraft({ ...unitDraft, ownerPhone: e.target.value })} />
                      </div>
                      <div className="flex justify-end gap-2 pt-1">
                        <Button type="button" variant="outline" onClick={() => setUnitDraftFor(null)}>Cancel</Button>
                        <Button type="button" onClick={() => handleAddUnit(t.id)} disabled={!unitDraft.unitNo.trim()}>
                          Save unit
                        </Button>
                      </div>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setUnitDraftFor(t.id)}
                      className="mt-3 inline-flex items-center gap-1.5 text-xs font-medium text-blue-600 hover:text-blue-700"
                    >
                      <Plus size={12} /> Add unit to {t.name}
                    </button>
                  )}
                </li>
              ))}
            </ul>
          </section>
        </>
      )}
    </div>
  );
}
