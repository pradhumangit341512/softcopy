'use client';

/**
 * Projects Working — F17 + F22
 *
 * Lists projects with a 4-quadrant tab filter (Commercial vs Residential ×
 * Ready vs Under-Construction). Each card shows tower + unit counts so a
 * salesperson can see scale at a glance. Add Project opens the F22 wizard.
 *
 * Server-side gate: feature.projects_working. The Add wizard itself is
 * gated by feature.project_wizard.
 */

import { useCallback, useEffect, useState } from 'react';
import Link from 'next/link';
import { Plus, FolderTree, Building2, Upload } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { TabStrip } from '@/components/common/TabStrip';
import { FeatureLocked } from '@/components/common/FeatureLocked';
import { AddProjectWizard } from '@/components/projects/AddProjectWizard';
import { ProjectsBulkImportModal } from '@/components/projects/ProjectsBulkImportModal';
import type { Project, Tower, Unit } from '@/lib/types';

type ProjectWithChildren = Project & { towers?: (Tower & { units?: Unit[] })[] };

const TAB_FILTERS: Record<string, { propertyType?: string; constructionStatus?: string }> = {
  'commercial':       { propertyType: 'Commercial' },
  'residential':      { propertyType: 'Residential' },
  'ready':            { constructionStatus: 'ReadyToMove' },
  'under':            { constructionStatus: 'UnderConstruction' },
};

export default function ProjectsWorkingPage() {
  const { isLoading: authLoading } = useAuth();
  const enabled = useFeature('feature.projects_working');
  const canUseWizard = useFeature('feature.project_wizard');
  const canBulkImport = useFeature('feature.bulk_projects');

  const [projects, setProjects] = useState<ProjectWithChildren[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [activeTab, setActiveTab] = useState<string>('');
  const [showWizard, setShowWizard] = useState(false);
  const [showImport, setShowImport] = useState(false);

  const fetchProjects = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      const filter = TAB_FILTERS[activeTab] ?? {};
      if (filter.propertyType) params.set('propertyType', filter.propertyType);
      if (filter.constructionStatus) params.set('constructionStatus', filter.constructionStatus);
      const res = await fetch(`/api/projects${params.toString() ? `?${params}` : ''}`, {
        credentials: 'include',
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to fetch projects');
      setProjects(j.projects ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch projects');
    } finally {
      setLoading(false);
    }
  }, [activeTab]);

  useEffect(() => {
    if (authLoading || !enabled) return;
    fetchProjects();
  }, [authLoading, enabled, fetchProjects]);

  if (authLoading) return <Loader />;
  if (!enabled) return <FeatureLocked feature="feature.projects_working" />;

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight flex items-center gap-2">
            <FolderTree size={20} className="text-violet-500" />
            Projects Working
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Project → Tower → Unit hierarchy. {projects.length} project{projects.length === 1 ? '' : 's'} loaded.
          </p>
        </div>

        <div className="flex items-center gap-2 flex-wrap">
          {canBulkImport && (
            <button
              type="button"
              onClick={() => setShowImport(true)}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5
                text-sm font-semibold text-gray-700 bg-white border border-gray-200
                hover:bg-gray-50 rounded-xl shadow-sm transition-colors"
            >
              <Upload size={15} />
              <span className="hidden sm:inline">Import</span>
            </button>
          )}
          {canUseWizard && (
            <button
              type="button"
              onClick={() => setShowWizard(true)}
              className="inline-flex items-center gap-1.5 px-3 sm:px-4 py-2 sm:py-2.5
                text-sm font-semibold text-white bg-blue-600 hover:bg-blue-700 rounded-xl shadow-sm transition-colors"
            >
              <Plus size={15} /> Add New Project
            </button>
          )}
        </div>
      </div>

      <TabStrip
        ariaLabel="Projects view"
        activeTab={activeTab}
        onSelect={setActiveTab}
        tabs={[
          { id: '',            label: 'All Projects' },
          { id: 'commercial',  label: 'Commercial' },
          { id: 'residential', label: 'Residential' },
          { id: 'ready',       label: 'Ready To Move' },
          { id: 'under',       label: 'Under Construction' },
        ]}
      />

      {error && <Alert type="error" message={error} />}

      {loading ? (
        <Loader message="Loading projects…" />
      ) : projects.length === 0 ? (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-12 text-center text-sm text-gray-400">
          <FolderTree size={28} className="mx-auto text-gray-300 mb-2" />
          {activeTab ? 'No projects match this filter.' : 'No projects yet — click “Add New Project”.'}
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {projects.map((p) => {
            const towerCount = p.towers?.length ?? 0;
            const unitCount = (p.towers ?? []).reduce(
              (acc, t) => acc + (t.units?.length ?? 0),
              0
            );
            return (
              <Link
                key={p.id}
                href={`/dashboard/projects-working/${p.id}`}
                className="block bg-white rounded-2xl border border-gray-100 shadow-sm p-4 hover:border-blue-300 hover:shadow-md transition"
              >
                <div className="flex items-center gap-2 mb-2">
                  <span className={
                    p.propertyType === 'Commercial'
                      ? 'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-amber-50 text-amber-700 border border-amber-200'
                      : 'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-emerald-50 text-emerald-700 border border-emerald-200'
                  }>
                    {p.propertyType}
                  </span>
                  <span className={
                    p.constructionStatus === 'ReadyToMove'
                      ? 'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-sky-50 text-sky-700 border border-sky-200'
                      : 'text-[10px] font-semibold uppercase tracking-wider px-2 py-0.5 rounded-full bg-violet-50 text-violet-700 border border-violet-200'
                  }>
                    {p.constructionStatus === 'ReadyToMove' ? 'Ready' : 'Under Construction'}
                  </span>
                </div>
                <h3 className="font-semibold text-gray-900 line-clamp-1">{p.name}</h3>
                {(p.location || p.sector || p.city) && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">
                    {[p.location, p.sector, p.city].filter(Boolean).join(' · ')}
                  </p>
                )}
                <div className="flex items-center gap-3 mt-3 pt-3 border-t border-gray-100 text-xs text-gray-600">
                  <span className="flex items-center gap-1">
                    <Building2 size={12} className="text-gray-400" /> {towerCount} tower{towerCount === 1 ? '' : 's'}
                  </span>
                  <span>·</span>
                  <span>{unitCount} unit{unitCount === 1 ? '' : 's'}</span>
                </div>
              </Link>
            );
          })}
        </div>
      )}

      {canUseWizard && showWizard && (
        <AddProjectWizard
          onClose={() => setShowWizard(false)}
          onCreated={() => { setShowWizard(false); fetchProjects(); }}
        />
      )}

      {canBulkImport && (
        <ProjectsBulkImportModal
          open={showImport}
          onClose={() => setShowImport(false)}
          onImported={() => fetchProjects()}
        />
      )}
    </div>
  );
}
