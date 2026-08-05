'use client';

/**
 * Project detail — F17 / F17b
 *
 * Shows a project with its towers + units. Inline "Add Tower" and "Add Unit"
 * dialogs let admins extend the hierarchy without leaving the page.
 *
 * F17b enriches each unit with inventory attributes (asset type, listing type,
 * furnishing, interior status, area, per-sqft price, headline price) and adds
 * one-tap WhatsApp / Email sharing of any unit or the whole project. The add
 * and edit unit forms share one <UnitFormFields> so they can never drift.
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
import { UnitFormFields } from '@/components/projects/UnitFormFields';
import { UnitsList } from '@/components/projects/UnitsList';
import { ShareListingButtons } from '@/components/projects/ShareListingButtons';
import {
  EMPTY_UNIT_DRAFT,
  unitToDraft,
  unitDraftToBody,
  projectStatusLabel,
  isAvailableStatus,
  type UnitDraft,
} from '@/lib/unit-options';
import type { Project, Tower, Unit } from '@/lib/types';

type FullProject = Project & { towers?: (Tower & { units?: Unit[] })[] };

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
  const [matches, setMatches] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Add-tower form
  const [showAddTower, setShowAddTower] = useState(false);
  const [newTowerName, setNewTowerName] = useState('');

  // Add-unit form: keyed by towerId so each tower has its own draft state
  const [unitDraftFor, setUnitDraftFor] = useState<string | null>(null);
  const [unitDraft, setUnitDraft] = useState<UnitDraft>(EMPTY_UNIT_DRAFT);

  // Inline edit state — at most one tower or unit is being edited at a time
  // (opening one closes the other). Stored as id strings so the children can
  // match without prop-drilling editing flags through.
  const [editingTowerId, setEditingTowerId] = useState<string | null>(null);
  const [editingTowerName, setEditingTowerName] = useState('');
  const [editingUnitId, setEditingUnitId] = useState<string | null>(null);
  const [editingUnit, setEditingUnit] = useState<UnitDraft>(EMPTY_UNIT_DRAFT);

  const fetchProject = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const res = await fetch(`/api/projects/${id}`, { credentials: 'include' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to fetch project');
      setProject(j);
      // Lead matches — best-effort; never blocks the page.
      try {
        const mres = await fetch(`/api/projects/${id}/lead-matches`, { credentials: 'include' });
        if (mres.ok) setMatches((await mres.json()).matches ?? {});
      } catch { /* ignore */ }
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
        body: JSON.stringify(unitDraftToBody(unitDraft)),
      });
      if (!res.ok) {
        const j = await res.json();
        throw new Error(j.error || 'Failed to add unit');
      }
      setUnitDraft(EMPTY_UNIT_DRAFT);
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
      title: `Delete block “${towerName}”?`,
      message: 'All units inside this block will be hidden from the team. The data is preserved in the database for recovery.',
      tone: 'danger',
      confirmText: 'Delete block',
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
    setUnitDraftFor(null); // close any open "add unit" panel so only one editor shows
    setEditingUnitId(unit.id);
    setEditingUnit(unitToDraft(unit));
  }

  async function handleSaveUnit(towerId: string, unitId: string) {
    if (!editingUnit.unitNo.trim()) return;
    try {
      const res = await fetch(`/api/projects/${id}/towers/${towerId}/units/${unitId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(unitDraftToBody(editingUnit)),
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

  const locationLine = project
    ? [project.location, project.sector, project.city].filter(Boolean).join(', ')
    : '';

  /** Project-level share summary: name, type, location, and tower/unit counts. */
  function projectShareText(p: FullProject): string {
    const towerCount = p.towers?.length ?? 0;
    const unitCount = (p.towers ?? []).reduce((n, t) => n + (t.units?.length ?? 0), 0);
    return [
      `🏢 ${p.name}`,
      `${p.propertyType} · ${projectStatusLabel(p.constructionStatus)}`,
      locationLine ? `📍 ${locationLine}` : null,
      `${towerCount} block${towerCount === 1 ? '' : 's'} · ${unitCount} unit${unitCount === 1 ? '' : 's'}`,
    ].filter(Boolean).join('\n');
  }

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
                {project.propertyType} · {projectStatusLabel(project.constructionStatus)}
                {(project.location || project.sector || project.city) && (
                  <>
                    {' · '}
                    {[project.location, project.sector, project.city].filter(Boolean).join(' · ')}
                  </>
                )}
                {project.totalArea != null && (
                  <> {' · '}{project.totalArea.toLocaleString('en-IN')} {project.totalAreaUnit ?? ''}</>
                )}
              </p>
            </div>
            <div className="flex items-center gap-2 flex-wrap">
              <ShareListingButtons
                size="md"
                text={projectShareText(project)}
                subject={`Project: ${project.name}`}
              />
              <button
                type="button"
                onClick={handleDeleteProject}
                className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-medium text-red-600 bg-white border border-red-200 hover:bg-red-50 rounded-xl"
              >
                <Trash2 size={14} /> Delete project
              </button>
            </div>
          </div>

          {/* Towers */}
          <section className="bg-white rounded-2xl border border-gray-100 shadow-sm">
            <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between">
              <h2 className="text-sm font-semibold text-gray-700 flex items-center gap-2">
                <Building2 size={14} className="text-gray-400" />
                Blocks ({project.towers?.length ?? 0})
              </h2>
              <Button
                type="button"
                size="sm"
                onClick={() => setShowAddTower((v) => !v)}
                icon={<Plus size={14} />}
              >
                Add Block
              </Button>
            </header>

            {showAddTower && (
              <div className="px-4 py-3 border-b border-gray-100 flex flex-col sm:flex-row gap-2 sm:items-end">
                <div className="flex-1">
                  <Input
                    label="Block Name"
                    placeholder="e.g. Block B"
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
                  No blocks yet. Click “Add Block” to start.
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
                          aria-label="Save block name"
                          className="w-7 h-7 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center disabled:opacity-50"
                        >
                          <Check size={14} />
                        </button>
                        <button
                          type="button"
                          onClick={() => setEditingTowerId(null)}
                          aria-label="Cancel block rename"
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
                          aria-label={`Rename block ${t.name}`}
                          title="Rename"
                          className="w-7 h-7 rounded-lg border border-blue-100 bg-blue-50 text-blue-500 hover:bg-blue-100 flex items-center justify-center"
                        >
                          <Pencil size={12} />
                        </button>
                        <button
                          type="button"
                          onClick={() => handleDeleteTower(t.id, t.name)}
                          aria-label={`Delete block ${t.name}`}
                          title="Delete block"
                          className="w-7 h-7 rounded-lg border border-red-100 bg-red-50 text-red-500 hover:bg-red-100 flex items-center justify-center"
                        >
                          <Trash2 size={12} />
                        </button>
                      </div>
                    )}
                    <span className="text-xs text-gray-400 shrink-0">
                      {(() => {
                        const total = t.units?.length ?? 0;
                        if (total === 0) return 'No units';
                        const avail = (t.units ?? []).filter((u) => isAvailableStatus(u.status)).length;
                        return `${avail} of ${total} available`;
                      })()}
                    </span>
                  </div>

                  {/* Units — responsive table (lg+) / cards (below lg). Edit,
                      delete, and WhatsApp/Email share live in each row/card. */}
                  <UnitsList
                    units={t.units ?? []}
                    editingUnitId={editingUnitId}
                    shareCtx={{ projectName: project.name, towerName: t.name, location: locationLine }}
                    matches={matches}
                    onEdit={startEditUnit}
                    onDelete={(u) => handleDeleteUnit(t.id, u.id, u.unitNo)}
                  />

                  {/* Inline edit panel — appears when the pencil on a unit is
                      clicked. Same <UnitFormFields> as the add-unit form so
                      users learn one layout. */}
                  {editingUnitId && (t.units ?? []).some((u) => u.id === editingUnitId) && (
                    <div className="mt-3 p-3 border border-blue-200 bg-blue-50/30 rounded-xl space-y-2">
                      <p className="text-[11px] uppercase tracking-wider font-semibold text-blue-700">
                        Editing unit
                      </p>
                      <UnitFormFields value={editingUnit} onChange={setEditingUnit} />
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
                      <UnitFormFields value={unitDraft} onChange={setUnitDraft} />
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
                      onClick={() => { setEditingUnitId(null); setUnitDraft(EMPTY_UNIT_DRAFT); setUnitDraftFor(t.id); }}
                      className="mt-3 w-full sm:w-auto inline-flex items-center justify-center gap-1.5 px-3 py-2 text-xs font-semibold text-blue-600 bg-blue-50/60 border border-dashed border-blue-200 hover:bg-blue-50 hover:border-blue-300 rounded-xl transition-colors"
                    >
                      <Plus size={13} /> Add unit to {t.name}
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
