'use client';

/**
 * Reference Database — F21
 *
 * Curated list of public projects with brochure links. Distinct from F17
 * Projects Working (which are working assets on this company's books).
 * The page is intentionally simple — search, table, modal add/edit.
 */

import { useEffect, useState, useCallback } from 'react';
import { Plus, Search, X, Pencil, Trash2, ExternalLink, Database } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { FeatureLocked } from '@/components/common/FeatureLocked';
import { useConfirm } from '@/components/common/ConfirmDialog';

interface ReferenceProject {
  id: string;
  projectName: string;
  location?: string | null;
  typology?: string | null;
  sector?: string | null;
  price?: string | null;
  size?: string | null;
  propertyType?: string | null;
  constructionStatus?: string | null;
  pdfUrl?: string | null;
  remarks?: string | null;
}

const EMPTY_DRAFT: ReferenceProject = {
  id: '',
  projectName: '',
  location: '',
  typology: '',
  sector: '',
  price: '',
  size: '',
  propertyType: '',
  constructionStatus: '',
  pdfUrl: '',
  remarks: '',
};

export default function ReferenceDatabasePage() {
  const { isLoading: authLoading } = useAuth();
  const enabled = useFeature('feature.reference_db');
  const confirm = useConfirm();

  const [items, setItems] = useState<ReferenceProject[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [debouncedSearch, setDebouncedSearch] = useState('');
  const [editing, setEditing] = useState<ReferenceProject | null>(null);

  // Debounce search so we don't hammer the API on every keystroke.
  useEffect(() => {
    const t = setTimeout(() => setDebouncedSearch(search), 300);
    return () => clearTimeout(t);
  }, [search]);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = new URLSearchParams();
      if (debouncedSearch) params.set('search', debouncedSearch);
      const res = await fetch(`/api/reference-projects?${params}`, { credentials: 'include' });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to fetch');
      setItems(j.items ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to fetch');
    } finally {
      setLoading(false);
    }
  }, [debouncedSearch]);

  useEffect(() => {
    if (authLoading || !enabled) return;
    fetchItems();
  }, [authLoading, enabled, fetchItems]);

  async function handleDelete(id: string) {
    const ok = await confirm({
      title: 'Remove this reference entry?',
      message: 'The entry will be hidden from the catalogue.',
      tone: 'danger',
      confirmText: 'Remove',
    });
    if (!ok) return;
    const res = await fetch(`/api/reference-projects/${id}`, {
      method: 'DELETE',
      credentials: 'include',
    });
    if (res.ok) fetchItems();
    else {
      const j = await res.json();
      setError(j.error || 'Delete failed');
    }
  }

  if (authLoading) return <Loader />;
  if (!enabled) return <FeatureLocked feature="feature.reference_db" />;

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight flex items-center gap-2">
            <Database size={20} className="text-violet-500" />
            Reference Database
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Curated list of public projects with brochure links — handy for sharing externally.
          </p>
        </div>
        <Button type="button" onClick={() => setEditing({ ...EMPTY_DRAFT })} icon={<Plus size={15} />}>
          Add Entry
        </Button>
      </div>

      {error && <Alert type="error" message={error} />}

      {/* Search */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4">
        <div className="relative">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
          <input
            type="search"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Search project, location, sector…"
            className="w-full pl-9 pr-9 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          {search && (
            <button
              type="button"
              onClick={() => setSearch('')}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
            >
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
        {loading ? (
          <div className="py-12">
            <Loader message="Loading…" />
          </div>
        ) : items.length === 0 ? (
          <div className="py-12 text-center text-sm text-gray-400">
            {debouncedSearch ? 'No matching reference entries.' : 'No reference projects yet.'}
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm min-w-[900px]">
              <thead className="bg-gray-50 text-gray-600 uppercase text-xs tracking-wider">
                <tr>
                  <th className="px-4 py-3 text-left">Project</th>
                  <th className="px-4 py-3 text-left">Location · Sector</th>
                  <th className="px-4 py-3 text-left">Typology</th>
                  <th className="px-4 py-3 text-left">Size</th>
                  <th className="px-4 py-3 text-left">Price</th>
                  <th className="px-4 py-3 text-left">Type</th>
                  <th className="px-4 py-3 text-left">Construction</th>
                  <th className="px-4 py-3 text-left">PDF</th>
                  <th className="px-4 py-3 text-center w-24">Actions</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {items.map((it) => (
                  <tr key={it.id} className="hover:bg-gray-50">
                    <td className="px-4 py-3">
                      <p className="font-semibold text-gray-900">{it.projectName}</p>
                      {it.remarks && (
                        <p className="text-xs text-gray-500 mt-0.5 line-clamp-1">{it.remarks}</p>
                      )}
                    </td>
                    <td className="px-4 py-3 text-gray-700">
                      {[it.location, it.sector].filter(Boolean).join(' · ') || '—'}
                    </td>
                    <td className="px-4 py-3 text-gray-700">{it.typology ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{it.size ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-900 font-medium">{it.price ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{it.propertyType ?? '—'}</td>
                    <td className="px-4 py-3 text-gray-700">{it.constructionStatus ?? '—'}</td>
                    <td className="px-4 py-3">
                      {it.pdfUrl ? (
                        <a
                          href={it.pdfUrl}
                          target="_blank"
                          rel="noopener noreferrer"
                          className="inline-flex items-center gap-1 text-blue-600 hover:text-blue-800"
                        >
                          Open <ExternalLink size={12} />
                        </a>
                      ) : (
                        <span className="text-gray-400">—</span>
                      )}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center justify-center gap-1.5">
                        <Button size="sm" variant="outline" onClick={() => setEditing(it)} title="Edit">
                          <Pencil size={14} />
                        </Button>
                        <button
                          type="button"
                          onClick={() => handleDelete(it.id)}
                          title="Delete"
                          className="w-7 h-7 rounded-lg border border-red-100 bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                        >
                          <Trash2 size={14} />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {editing && (
        <RefProjectModal
          initial={editing}
          onClose={() => setEditing(null)}
          onSaved={() => { setEditing(null); fetchItems(); }}
        />
      )}
    </div>
  );
}

function RefProjectModal({
  initial,
  onClose,
  onSaved,
}: {
  initial: ReferenceProject;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [draft, setDraft] = useState<ReferenceProject>({ ...initial });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const isEdit = Boolean(initial.id);

  function update<K extends keyof ReferenceProject>(k: K, v: ReferenceProject[K]) {
    setDraft((d) => ({ ...d, [k]: v }));
  }

  async function handleSave() {
    setSaving(true);
    setError(null);
    try {
      const url = isEdit ? `/api/reference-projects/${initial.id}` : '/api/reference-projects';
      const method = isEdit ? 'PUT' : 'POST';
      const res = await fetch(url, {
        method,
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          projectName: draft.projectName.trim(),
          location: draft.location || null,
          typology: draft.typology || null,
          sector: draft.sector || null,
          price: draft.price || null,
          size: draft.size || null,
          propertyType: draft.propertyType || null,
          constructionStatus: draft.constructionStatus || null,
          pdfUrl: draft.pdfUrl || '',
          remarks: draft.remarks || null,
        }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Save failed');
      onSaved();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm flex items-center justify-center z-50 px-4">
      <div className="bg-white rounded-2xl shadow-2xl w-full max-w-2xl overflow-hidden max-h-[90vh] flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">
            {isEdit ? 'Edit Reference Project' : 'New Reference Project'}
          </h2>
          <button type="button" onClick={onClose} aria-label="Close" className="w-8 h-8 rounded-lg hover:bg-gray-100 flex items-center justify-center text-gray-400">
            <X size={18} />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3">
          {error && <Alert type="error" message={error} />}
          <Input
            label="Project Name *"
            placeholder="e.g. DLF Cyber City"
            value={draft.projectName}
            onChange={(e) => update('projectName', e.target.value)}
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Location" placeholder="e.g. Cyber Hub, Gurgaon" value={draft.location ?? ''} onChange={(e) => update('location', e.target.value)} />
            <Input label="Sector" placeholder="e.g. Sector 24" value={draft.sector ?? ''} onChange={(e) => update('sector', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input label="Typology" placeholder="e.g. 3BHK / Office" value={draft.typology ?? ''} onChange={(e) => update('typology', e.target.value)} />
            <Input label="Size" placeholder="e.g. 1850 sqft" value={draft.size ?? ''} onChange={(e) => update('size', e.target.value)} />
            <Input label="Price" placeholder="e.g. ₹2.4Cr" value={draft.price ?? ''} onChange={(e) => update('price', e.target.value)} />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="Property Type" placeholder="Residential / Commercial" value={draft.propertyType ?? ''} onChange={(e) => update('propertyType', e.target.value)} />
            <Input label="Construction" placeholder="ReadyToMove / UnderConstruction" value={draft.constructionStatus ?? ''} onChange={(e) => update('constructionStatus', e.target.value)} />
          </div>
          <Input
            label="PDF Brochure URL"
            type="url"
            placeholder="https://example.com/brochure.pdf"
            value={draft.pdfUrl ?? ''}
            onChange={(e) => update('pdfUrl', e.target.value)}
          />
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Remarks</label>
            <textarea
              value={draft.remarks ?? ''}
              onChange={(e) => update('remarks', e.target.value)}
              rows={3}
              placeholder="Anything noteworthy about this project…"
              className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500 resize-none"
            />
          </div>
        </div>

        <div className="flex justify-end gap-2 px-5 py-3 border-t border-gray-100 bg-gray-50">
          <Button type="button" variant="outline" onClick={onClose}>Cancel</Button>
          <Button type="button" onClick={handleSave} disabled={saving || !draft.projectName.trim()}>
            {saving ? 'Saving…' : isEdit ? 'Save changes' : 'Add entry'}
          </Button>
        </div>
      </div>
    </div>
  );
}
