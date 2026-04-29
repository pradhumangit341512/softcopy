'use client';

/**
 * Learn & Grow — F20
 *
 * Folder + file resource library. Files are URL-based — paste a link to
 * any document (Drive / Notion / S3 / website). File-upload integration
 * is a follow-up (Vercel Blob or S3 presigned URLs); the schema is ready
 * for it but the UI sticks to URL input today to keep scope focused.
 *
 * Two-pane layout: folder list on the left, selected folder's files on
 * the right. Mobile collapses to single column with selected folder
 * shown above an inline files panel.
 */

import { useCallback, useEffect, useState } from 'react';
import { Plus, Folder, FileText, Trash2, ExternalLink, X, BookOpen, Pencil, Check } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';
import { useFeature } from '@/hooks/useFeature';
import { Loader } from '@/components/common/Loader';
import { Alert } from '@/components/common/Alert';
import { Button } from '@/components/common/Button';
import { Input } from '@/components/common/Input';
import { FeatureLocked } from '@/components/common/FeatureLocked';
import { useConfirm } from '@/components/common/ConfirmDialog';

interface LearnFile {
  id: string;
  name: string;
  url: string;
  kind: string;
  notes?: string | null;
  createdAt: string;
}
interface LearnFolderListItem {
  id: string;
  name: string;
  fileCount: number;
  createdAt: string;
}
interface LearnFolderDetail {
  id: string;
  name: string;
  files: LearnFile[];
}

const FILE_KINDS = ['link', 'pdf', 'video', 'image', 'doc'] as const;

export default function LearnGrowPage() {
  const { isLoading: authLoading } = useAuth();
  const enabled = useFeature('feature.learn_grow');
  const confirm = useConfirm();

  const [folders, setFolders] = useState<LearnFolderListItem[]>([]);
  const [activeFolderId, setActiveFolderId] = useState<string | null>(null);
  const [activeFolder, setActiveFolder] = useState<LearnFolderDetail | null>(null);
  const [loadingList, setLoadingList] = useState(true);
  const [loadingFolder, setLoadingFolder] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showAddFolder, setShowAddFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState('');
  const [showAddFile, setShowAddFile] = useState(false);

  // Inline rename for the active folder header.
  const [renamingFolder, setRenamingFolder] = useState(false);
  const [folderRenameDraft, setFolderRenameDraft] = useState('');

  // Inline edit for one file row at a time. Storing the id keeps the
  // child rows decoupled from prop drilling — they just check id-equality.
  const [editingFileId, setEditingFileId] = useState<string | null>(null);
  const [fileEditDraft, setFileEditDraft] = useState({
    name: '',
    url: '',
    kind: 'link' as typeof FILE_KINDS[number],
    notes: '',
  });

  const fetchFolders = useCallback(async () => {
    setLoadingList(true);
    setError(null);
    try {
      const res = await fetch('/api/learn/folders', { credentials: 'include' });
      // Defensive parse: a Next.js error page can return HTML, which would
      // throw inside .json() and mask the real status code.
      const j = await res.json().catch(() => ({} as { error?: string; detail?: string; folders?: unknown }));
      if (!res.ok) {
        const detail = (j as { detail?: string }).detail;
        throw new Error(
          [(j as { error?: string }).error, detail].filter(Boolean).join(' — ') ||
            `Failed to load folders (HTTP ${res.status})`
        );
      }
      setFolders(((j as { folders?: LearnFolderListItem[] }).folders) ?? []);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load folders');
    } finally {
      setLoadingList(false);
    }
  }, []);

  const fetchFolderDetail = useCallback(async (id: string) => {
    setLoadingFolder(true);
    setError(null);
    try {
      const res = await fetch(`/api/learn/folders/${id}`, { credentials: 'include' });
      const j = await res.json().catch(() => ({} as { error?: string; detail?: string }));
      if (!res.ok) {
        const detail = (j as { detail?: string }).detail;
        throw new Error(
          [(j as { error?: string }).error, detail].filter(Boolean).join(' — ') ||
            `Failed to load folder (HTTP ${res.status})`
        );
      }
      setActiveFolder(j as LearnFolderDetail);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to load folder');
    } finally {
      setLoadingFolder(false);
    }
  }, []);

  useEffect(() => {
    if (authLoading || !enabled) return;
    fetchFolders();
  }, [authLoading, enabled, fetchFolders]);

  useEffect(() => {
    if (!activeFolderId) {
      setActiveFolder(null);
      return;
    }
    fetchFolderDetail(activeFolderId);
  }, [activeFolderId, fetchFolderDetail]);

  async function handleCreateFolder() {
    if (!newFolderName.trim()) return;
    try {
      const res = await fetch('/api/learn/folders', {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: newFolderName.trim() }),
      });
      const j = await res.json();
      if (!res.ok) throw new Error(j.error || 'Failed to create folder');
      setNewFolderName('');
      setShowAddFolder(false);
      fetchFolders();
      // Select the new folder so the user can add files immediately.
      setActiveFolderId(j.id);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Failed to create folder');
    }
  }

  async function handleDeleteFolder(id: string) {
    const ok = await confirm({
      title: 'Delete this folder?',
      message: 'All files inside the folder will be removed too. The links themselves stay valid; you just won\'t see them here anymore.',
      tone: 'danger',
      confirmText: 'Delete folder',
    });
    if (!ok) return;
    const res = await fetch(`/api/learn/folders/${id}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      if (activeFolderId === id) setActiveFolderId(null);
      fetchFolders();
    } else {
      const j = await res.json();
      setError(j.error || 'Delete failed');
    }
  }

  function startRenameFolder() {
    if (!activeFolder) return;
    // Closing any file edit prevents two editors being open at once.
    setEditingFileId(null);
    setFolderRenameDraft(activeFolder.name);
    setRenamingFolder(true);
  }

  async function handleRenameFolder() {
    if (!activeFolderId) return;
    const trimmed = folderRenameDraft.trim();
    if (!trimmed) return;
    try {
      const res = await fetch(`/api/learn/folders/${activeFolderId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ name: trimmed }),
      });
      const j = await res.json().catch(() => ({} as { error?: string; detail?: string }));
      if (!res.ok) {
        const detail = (j as { detail?: string }).detail;
        throw new Error(
          [(j as { error?: string }).error, detail].filter(Boolean).join(' — ') ||
            `Rename failed (HTTP ${res.status})`
        );
      }
      setRenamingFolder(false);
      // Refresh both panes — the sidebar list shows the new name in the
      // selected folder card; the detail header shows it in bold.
      fetchFolderDetail(activeFolderId);
      fetchFolders();
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Rename failed');
    }
  }

  function startEditFile(f: LearnFile) {
    setRenamingFolder(false);
    setEditingFileId(f.id);
    setFileEditDraft({
      name: f.name,
      url: f.url,
      kind: (FILE_KINDS as ReadonlyArray<string>).includes(f.kind)
        ? (f.kind as typeof FILE_KINDS[number])
        : 'link',
      notes: f.notes ?? '',
    });
  }

  async function handleSaveFileEdit() {
    if (!editingFileId) return;
    const name = fileEditDraft.name.trim();
    const url = fileEditDraft.url.trim();
    if (!name || !url) return;
    try {
      const res = await fetch(`/api/learn/files/${editingFileId}`, {
        method: 'PUT',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name,
          url,
          kind: fileEditDraft.kind,
          notes: fileEditDraft.notes || null,
        }),
      });
      const j = await res.json().catch(() => ({} as { error?: string; detail?: string }));
      if (!res.ok) {
        const detail = (j as { detail?: string }).detail;
        throw new Error(
          [(j as { error?: string }).error, detail].filter(Boolean).join(' — ') ||
            `Save failed (HTTP ${res.status})`
        );
      }
      setEditingFileId(null);
      if (activeFolderId) fetchFolderDetail(activeFolderId);
    } catch (e: unknown) {
      setError(e instanceof Error ? e.message : 'Save failed');
    }
  }

  async function handleDeleteFile(fileId: string) {
    const ok = await confirm({
      title: 'Remove this file?',
      message: 'The link will be hidden from the team. The original document at the URL is unaffected.',
      tone: 'danger',
      confirmText: 'Remove',
    });
    if (!ok) return;
    const res = await fetch(`/api/learn/files/${fileId}`, { method: 'DELETE', credentials: 'include' });
    if (res.ok) {
      if (activeFolderId) fetchFolderDetail(activeFolderId);
      fetchFolders(); // refresh count
    } else {
      const j = await res.json();
      setError(j.error || 'Delete failed');
    }
  }

  if (authLoading) return <Loader />;
  if (!enabled) return <FeatureLocked feature="feature.learn_grow" />;

  return (
    <div className="py-4 sm:py-6 lg:py-8 space-y-4 sm:space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
        <div>
          <h1 className="text-xl sm:text-2xl lg:text-3xl font-bold font-display text-gray-900 tracking-tight flex items-center gap-2">
            <BookOpen size={20} className="text-violet-500" />
            Learn &amp; Grow
          </h1>
          <p className="text-gray-500 text-xs sm:text-sm mt-0.5">
            Shared resource library for the team. Paste links to PDFs, videos, docs.
          </p>
        </div>
        <Button type="button" onClick={() => setShowAddFolder((v) => !v)} icon={<Plus size={15} />}>
          New Folder
        </Button>
      </div>

      {error && <Alert type="error" message={error} />}

      {showAddFolder && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-3 sm:p-4 flex flex-col sm:flex-row gap-2 sm:items-end">
          <div className="flex-1">
            <Input
              label="Folder Name"
              placeholder="e.g. Onboarding Decks"
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
            />
          </div>
          <Button type="button" onClick={handleCreateFolder} disabled={!newFolderName.trim()}>
            Save
          </Button>
          <Button type="button" variant="outline" onClick={() => { setShowAddFolder(false); setNewFolderName(''); }}>
            Cancel
          </Button>
        </div>
      )}

      <div className="grid grid-cols-1 lg:grid-cols-[280px_1fr] gap-4">
        {/* Folder list */}
        <aside className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <header className="px-4 py-3 border-b border-gray-100">
            <h2 className="text-sm font-semibold text-gray-700">Folders</h2>
          </header>
          {loadingList ? (
            <div className="p-6"><Loader message="Loading…" /></div>
          ) : folders.length === 0 ? (
            <p className="p-6 text-center text-xs text-gray-400">No folders yet.</p>
          ) : (
            <ul className="divide-y divide-gray-100 max-h-[60vh] overflow-y-auto">
              {folders.map((f) => {
                const isActive = activeFolderId === f.id;
                return (
                  <li key={f.id}>
                    <button
                      type="button"
                      onClick={() => setActiveFolderId(f.id)}
                      className={
                        isActive
                          ? 'w-full text-left px-4 py-3 bg-blue-50 border-l-4 border-blue-600'
                          : 'w-full text-left px-4 py-3 hover:bg-gray-50 border-l-4 border-transparent'
                      }
                    >
                      <div className="flex items-center gap-2">
                        <Folder size={14} className={isActive ? 'text-blue-600' : 'text-gray-400'} />
                        <span className={isActive ? 'font-semibold text-gray-900' : 'text-gray-700'}>
                          {f.name}
                        </span>
                      </div>
                      <p className="text-[11px] text-gray-400 mt-0.5">
                        {f.fileCount} file{f.fileCount === 1 ? '' : 's'}
                      </p>
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
        </aside>

        {/* Folder detail / files */}
        <section className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden min-h-[300px]">
          {!activeFolderId ? (
            <div className="flex items-center justify-center h-full p-12 text-center text-sm text-gray-400">
              <div>
                <Folder size={28} className="mx-auto text-gray-300 mb-2" />
                <p>Select a folder from the left to see its files.</p>
                <p className="mt-1">Or click <strong>New Folder</strong> to create one.</p>
              </div>
            </div>
          ) : loadingFolder || !activeFolder ? (
            <div className="p-12"><Loader message="Loading folder…" /></div>
          ) : (
            <>
              <header className="px-4 py-3 border-b border-gray-100 flex items-center justify-between gap-2 flex-wrap">
                {renamingFolder ? (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <input
                      type="text"
                      value={folderRenameDraft}
                      onChange={(e) => setFolderRenameDraft(e.target.value)}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') { e.preventDefault(); handleRenameFolder(); }
                        if (e.key === 'Escape') { e.preventDefault(); setRenamingFolder(false); }
                      }}
                      autoFocus
                      className="flex-1 min-w-0 px-2.5 py-1.5 text-sm border border-blue-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                    />
                    <button
                      type="button"
                      onClick={handleRenameFolder}
                      disabled={!folderRenameDraft.trim()}
                      aria-label="Save folder name"
                      className="w-7 h-7 rounded-lg border border-emerald-200 bg-emerald-50 text-emerald-600 hover:bg-emerald-100 flex items-center justify-center disabled:opacity-50"
                    >
                      <Check size={14} />
                    </button>
                    <button
                      type="button"
                      onClick={() => setRenamingFolder(false)}
                      aria-label="Cancel rename"
                      className="w-7 h-7 rounded-lg border border-gray-200 bg-white text-gray-500 hover:bg-gray-50 flex items-center justify-center"
                    >
                      <X size={14} />
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-2 flex-1 min-w-0">
                    <h2 className="text-sm font-semibold text-gray-700 truncate">{activeFolder.name}</h2>
                    <button
                      type="button"
                      onClick={startRenameFolder}
                      title="Rename folder"
                      aria-label="Rename folder"
                      className="w-7 h-7 rounded-lg border border-blue-100 bg-blue-50 text-blue-500 hover:bg-blue-100 flex items-center justify-center"
                    >
                      <Pencil size={12} />
                    </button>
                  </div>
                )}
                <div className="flex gap-2">
                  <Button type="button" size="sm" onClick={() => setShowAddFile((v) => !v)} icon={<Plus size={12} />}>
                    Add File
                  </Button>
                  <button
                    type="button"
                    onClick={() => handleDeleteFolder(activeFolder.id)}
                    className="inline-flex items-center gap-1 px-2.5 py-1 text-xs font-medium text-red-600 bg-red-50 border border-red-100 hover:bg-red-100 rounded-lg"
                  >
                    <Trash2 size={12} /> Delete folder
                  </button>
                </div>
              </header>

              {showAddFile && (
                <AddFileInline
                  folderId={activeFolder.id}
                  onClose={() => setShowAddFile(false)}
                  onSaved={() => { setShowAddFile(false); fetchFolderDetail(activeFolder.id); fetchFolders(); }}
                />
              )}

              {activeFolder.files.length === 0 ? (
                <p className="p-12 text-center text-sm text-gray-400">No files yet in this folder.</p>
              ) : (
                <ul className="divide-y divide-gray-100">
                  {activeFolder.files.map((file) => {
                    const isEditing = editingFileId === file.id;
                    return (
                      <li
                        key={file.id}
                        className={
                          isEditing
                            ? 'px-4 py-3 bg-blue-50/40'
                            : 'px-4 py-3 flex items-start gap-3'
                        }
                      >
                        {isEditing ? (
                          // ── Inline edit panel ───────────────────────
                          <div className="space-y-2">
                            <p className="text-[11px] uppercase tracking-wider font-semibold text-blue-700">
                              Editing file
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              <Input
                                label="File Name *"
                                placeholder="e.g. Onboarding deck v3"
                                value={fileEditDraft.name}
                                onChange={(e) =>
                                  setFileEditDraft({ ...fileEditDraft, name: e.target.value })
                                }
                              />
                              <div>
                                <label className="block text-sm font-medium text-gray-700 mb-1">Kind</label>
                                <select
                                  value={fileEditDraft.kind}
                                  onChange={(e) =>
                                    setFileEditDraft({
                                      ...fileEditDraft,
                                      kind: e.target.value as typeof FILE_KINDS[number],
                                    })
                                  }
                                  className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
                                >
                                  {FILE_KINDS.map((k) => (
                                    <option key={k} value={k}>{k}</option>
                                  ))}
                                </select>
                              </div>
                            </div>
                            <Input
                              label="URL *"
                              type="url"
                              placeholder="https://…"
                              value={fileEditDraft.url}
                              onChange={(e) =>
                                setFileEditDraft({ ...fileEditDraft, url: e.target.value })
                              }
                            />
                            <Input
                              label="Notes"
                              placeholder="optional context"
                              value={fileEditDraft.notes}
                              onChange={(e) =>
                                setFileEditDraft({ ...fileEditDraft, notes: e.target.value })
                              }
                            />
                            <div className="flex justify-end gap-2 pt-1">
                              <Button
                                type="button"
                                variant="outline"
                                onClick={() => setEditingFileId(null)}
                              >
                                Cancel
                              </Button>
                              <Button
                                type="button"
                                onClick={handleSaveFileEdit}
                                disabled={!fileEditDraft.name.trim() || !fileEditDraft.url.trim()}
                              >
                                Save changes
                              </Button>
                            </div>
                          </div>
                        ) : (
                          // ── Read-only row ───────────────────────────
                          <>
                            <FileText size={16} className="text-gray-400 mt-0.5 shrink-0" />
                            <div className="flex-1 min-w-0">
                              <a
                                href={file.url}
                                target="_blank"
                                rel="noopener noreferrer"
                                className="font-medium text-gray-900 hover:text-blue-700 inline-flex items-center gap-1 break-all"
                              >
                                {file.name} <ExternalLink size={12} className="shrink-0 text-gray-400" />
                              </a>
                              <p className="text-[11px] uppercase tracking-wider text-gray-400 mt-0.5">
                                {file.kind}
                              </p>
                              {file.notes && (
                                <p className="text-xs text-gray-500 mt-1">{file.notes}</p>
                              )}
                            </div>
                            <div className="flex flex-col sm:flex-row items-end sm:items-center gap-1">
                              <button
                                type="button"
                                onClick={() => startEditFile(file)}
                                title="Edit file"
                                aria-label={`Edit ${file.name}`}
                                className="w-7 h-7 rounded-lg border border-blue-100 bg-blue-50 flex items-center justify-center text-blue-500 hover:bg-blue-100 hover:text-blue-700 transition-colors"
                              >
                                <Pencil size={14} />
                              </button>
                              <button
                                type="button"
                                onClick={() => handleDeleteFile(file.id)}
                                title="Remove file"
                                aria-label={`Remove ${file.name}`}
                                className="w-7 h-7 rounded-lg border border-red-100 bg-red-50 flex items-center justify-center text-red-400 hover:bg-red-100 hover:text-red-600 transition-colors"
                              >
                                <Trash2 size={14} />
                              </button>
                            </div>
                          </>
                        )}
                      </li>
                    );
                  })}
                </ul>
              )}
            </>
          )}
        </section>
      </div>
    </div>
  );
}

function AddFileInline({
  folderId,
  onClose,
  onSaved,
}: {
  folderId: string;
  onClose: () => void;
  onSaved: () => void;
}) {
  const [name, setName] = useState('');
  const [url, setUrl] = useState('');
  const [kind, setKind] = useState<typeof FILE_KINDS[number]>('link');
  const [notes, setNotes] = useState('');
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function save() {
    setSaving(true);
    setErr(null);
    try {
      const res = await fetch(`/api/learn/folders/${folderId}/files`, {
        method: 'POST',
        credentials: 'include',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          name: name.trim(),
          url: url.trim(),
          kind,
          notes: notes || null,
        }),
      });
      // Defensive parse — an HTML error page (e.g. dev-time crash) would
      // throw inside .json() and mask the real status code otherwise.
      const j = await res.json().catch(() => ({} as { error?: string; detail?: string }));
      if (!res.ok) {
        const detail = (j as { detail?: string }).detail;
        throw new Error(
          [(j as { error?: string }).error, detail].filter(Boolean).join(' — ') ||
            `Save failed (HTTP ${res.status})`
        );
      }
      onSaved();
    } catch (e: unknown) {
      setErr(e instanceof Error ? e.message : 'Save failed');
    } finally {
      setSaving(false);
    }
  }

  return (
    <div className="px-4 py-3 border-b border-gray-100 bg-gray-50 space-y-3">
      {err && <Alert type="error" message={err} />}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="File Name *" placeholder="e.g. Onboarding deck v3" value={name} onChange={(e) => setName(e.target.value)} />
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Kind</label>
          <select
            value={kind}
            onChange={(e) => setKind(e.target.value as typeof FILE_KINDS[number])}
            className="w-full px-3 py-2 text-sm border border-gray-300 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-blue-500"
          >
            {FILE_KINDS.map((k) => (
              <option key={k} value={k}>{k}</option>
            ))}
          </select>
        </div>
      </div>
      <Input label="URL *" type="url" placeholder="https://…" value={url} onChange={(e) => setUrl(e.target.value)} />
      <Input label="Notes" placeholder="optional context" value={notes} onChange={(e) => setNotes(e.target.value)} />
      <div className="flex justify-end gap-2">
        <Button type="button" variant="outline" onClick={onClose} icon={<X size={14} />}>Cancel</Button>
        <Button type="button" onClick={save} disabled={saving || !name.trim() || !url.trim()}>
          {saving ? 'Saving…' : 'Save file'}
        </Button>
      </div>
    </div>
  );
}
