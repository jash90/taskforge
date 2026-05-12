import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FolderTree, Plus, Pencil, Trash2, FolderPlus, Check, X,
  ChevronsDown, ChevronsUp, Search, Download, Upload,
} from 'lucide-react';
import db from '../db';
import type { Category } from '../types';
import {
  buildTree, descendantIds, type CategoryNode,
} from '../utils/categoryTree';
import CategoryTreeNode from './CategoryTreeNode';
import ConfirmDialog from './ConfirmDialog';
import { toast } from '../hooks/useToast';
import {
  exportCategoriesToJSON, importCategoriesFromJSON, downloadFile,
} from '../utils/export';

interface DeletePreview {
  node: CategoryNode;
  descendantCount: number;
  affectedTaskCount: number;
}

interface ImportPreview {
  file: File;
  categories: Category[];
}

export default function CategoryManager() {
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);

  const tree = useMemo(() => buildTree(categories || []), [categories]);
  const [expanded, setExpanded] = useState<Set<string>>(new Set());
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editingName, setEditingName] = useState('');
  const [addParentId, setAddParentId] = useState<string | null | undefined>(undefined);
  const [newName, setNewName] = useState('');
  const [query, setQuery] = useState('');
  const [confirmDelete, setConfirmDelete] = useState<DeletePreview | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  // Auto-expand all when matching a search query
  useEffect(() => {
    if (!query.trim()) return;
    const all = new Set<string>();
    const walk = (n: CategoryNode) => { all.add(n.id); n.children.forEach(walk); };
    tree.forEach(walk);
    setExpanded(all);
  }, [query, tree]);

  // Task usage count per category id
  const usage = useMemo(() => {
    const m = new Map<string, number>();
    for (const t of tasks || []) {
      for (const id of t.categories || []) {
        m.set(id, (m.get(id) ?? 0) + 1);
      }
    }
    return m;
  }, [tasks]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const expandAll = () => {
    const all = new Set<string>();
    const walk = (n: CategoryNode) => { all.add(n.id); n.children.forEach(walk); };
    tree.forEach(walk);
    setExpanded(all);
  };

  const collapseAll = () => setExpanded(new Set());

  const startEdit = (n: CategoryNode) => {
    setEditingId(n.id);
    setEditingName(n.name);
  };

  const saveEdit = async () => {
    if (!editingId) return;
    const trimmed = editingName.trim();
    if (!trimmed) { toast.error({ title: 'Nazwa nie może być pusta' }); return; }
    await db.categories.update(editingId, { name: trimmed, updatedAt: Date.now() });
    setEditingId(null);
    setEditingName('');
  };

  const cancelEdit = () => {
    setEditingId(null);
    setEditingName('');
  };

  const startAdd = (parentId: string | null) => {
    setAddParentId(parentId);
    setNewName('');
    if (parentId) {
      setExpanded((prev) => new Set(prev).add(parentId));
    }
  };

  const saveAdd = async () => {
    const trimmed = newName.trim();
    if (!trimmed) { toast.error({ title: 'Nazwa nie może być pusta' }); return; }
    if (addParentId === undefined) return;
    const now = Date.now();
    const id = `cat-${now}-${Math.random().toString(36).slice(2, 6)}`;
    await db.categories.add({
      id,
      name: trimmed,
      parentId: addParentId,
      position: now,
      createdAt: now,
      updatedAt: now,
    });
    setAddParentId(undefined);
    setNewName('');
    toast.success({ title: 'Dodano kategorię', description: trimmed });
  };

  const cancelAdd = () => {
    setAddParentId(undefined);
    setNewName('');
  };

  const requestDelete = (n: CategoryNode) => {
    const descIds = descendantIds(n);
    const affectedIds = new Set([n.id, ...descIds]);
    let affectedTaskCount = 0;
    for (const t of tasks || []) {
      if ((t.categories || []).some((id) => affectedIds.has(id))) affectedTaskCount += 1;
    }
    setConfirmDelete({ node: n, descendantCount: descIds.length, affectedTaskCount });
  };

  const handleExport = () => {
    if (!categories || categories.length === 0) {
      toast.info({ title: 'Brak kategorii do eksportu' });
      return;
    }
    const json = exportCategoriesToJSON(categories);
    downloadFile(json, `taskforge_kategorie_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    toast.success({ title: 'Eksport gotowy', description: `${categories.length} kategorii` });
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = importCategoriesFromJSON(text);
      setImportPreview({ file, categories: parsed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error({ title: 'Nie udało się odczytać pliku', description: msg });
    }
  };

  const performImport = async () => {
    if (!importPreview) return;
    try {
      for (const c of importPreview.categories) {
        await db.categories.put(c);
      }
      toast.success({ title: 'Zaimportowano kategorie', description: `${importPreview.categories.length} kategorii` });
    } catch (err) {
      toast.error({ title: 'Nie udało się zaimportować', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setImportPreview(null);
      if (importRef.current) importRef.current.value = '';
    }
  };

  const performDelete = async () => {
    if (!confirmDelete) return;
    const { node } = confirmDelete;
    const ids = [node.id, ...descendantIds(node)];
    await db.categories.bulkDelete(ids);
    // Detach from tasks
    const idSet = new Set(ids);
    const affectedTasks = (tasks || []).filter((t) => (t.categories || []).some((c) => idSet.has(c)));
    for (const t of affectedTasks) {
      await db.tasks.update(t.id, { categories: (t.categories || []).filter((c) => !idSet.has(c)) });
    }
    toast.success({
      title: 'Usunięto kategorię',
      description: `${node.name}${ids.length > 1 ? ` + ${ids.length - 1} podkategorii` : ''}`,
    });
    setConfirmDelete(null);
  };

  // Filter tree by query (matches name, recursively keeping parents)
  const filteredTree = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return tree;
    const matchNode = (n: CategoryNode): CategoryNode | null => {
      const filteredChildren = n.children.map(matchNode).filter((x): x is CategoryNode => x !== null);
      const selfMatches = n.name.toLowerCase().includes(q);
      if (selfMatches || filteredChildren.length > 0) {
        return { ...n, children: filteredChildren };
      }
      return null;
    };
    return tree.map(matchNode).filter((x): x is CategoryNode => x !== null);
  }, [tree, query]);

  const totalCategories = categories?.length ?? 0;
  const totalUsedTasks = useMemo(() => {
    if (!tasks) return 0;
    return tasks.filter((t) => (t.categories?.length ?? 0) > 0).length;
  }, [tasks]);

  return (
    <div>
      <div className="card mb-2">
        <div className="form-row mb-0">
          <div className="form-group mb-0 grow">
            <label htmlFor="cat-search" className="sr-only">Szukaj</label>
            <div className="search-input">
              <Search size={14} aria-hidden="true" />
              <input
                id="cat-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj kategorii…"
              />
            </div>
          </div>
          <button type="button" className="btn btn-secondary btn-sm" onClick={expandAll}>
            <ChevronsDown size={14} aria-hidden="true" /> Rozwiń wszystko
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={collapseAll}>
            <ChevronsUp size={14} aria-hidden="true" /> Zwiń wszystko
          </button>
          <input
            ref={importRef}
            type="file"
            accept=".json,application/json"
            className="hidden"
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleImportFile(f); }}
          />
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => importRef.current?.click()}>
            <Upload size={14} aria-hidden="true" /> Importuj
          </button>
          <button type="button" className="btn btn-secondary btn-sm" onClick={handleExport}>
            <Download size={14} aria-hidden="true" /> Eksportuj
          </button>
          <button type="button" className="btn btn-primary btn-sm" onClick={() => startAdd(null)}>
            <Plus size={14} aria-hidden="true" /> Nowa kategoria główna
          </button>
        </div>
        <div className="text-sm text-muted mt-1">
          {totalCategories} {totalCategories === 1 ? 'kategoria' : (totalCategories % 10 >= 2 && totalCategories % 10 <= 4 && (totalCategories % 100 < 12 || totalCategories % 100 > 14)) ? 'kategorie' : 'kategorii'}
          {' · '}
          {totalUsedTasks} {totalUsedTasks === 1 ? 'zadanie przypisane' : (totalUsedTasks % 10 >= 2 && totalUsedTasks % 10 <= 4 && (totalUsedTasks % 100 < 12 || totalUsedTasks % 100 > 14)) ? 'zadania przypisane' : 'zadań przypisanych'}
        </div>
      </div>

      {/* Inline new-root form */}
      {addParentId === null && (
        <div className="card card-accent-emphasized mb-2">
          <div className="flex items-center gap-1 wrap">
            <FolderPlus size={16} className="color-accent" aria-hidden="true" />
            <strong className="text-sm">Nowa kategoria główna</strong>
          </div>
          <div className="flex gap-1 wrap mt-1">
            <input
              autoFocus
              value={newName}
              onChange={(e) => setNewName(e.target.value)}
              onKeyDown={(e) => { if (e.key === 'Enter') void saveAdd(); if (e.key === 'Escape') cancelAdd(); }}
              placeholder="np. Mechanika, Algebra, Lektury obowiązkowe…"
              className="flex-1-min220"
            />
            <button type="button" className="btn btn-primary" onClick={saveAdd}>
              <Check size={14} aria-hidden="true" /> Dodaj
            </button>
            <button type="button" className="btn btn-ghost" onClick={cancelAdd}>
              <X size={14} aria-hidden="true" /> Anuluj
            </button>
          </div>
        </div>
      )}

      {/* Tree or empty */}
      {categories === undefined ? (
        <div className="task-list" aria-busy="true">
          {[0, 1].map((i) => <div key={i} className="skeleton skeleton-card" />)}
        </div>
      ) : filteredTree.length === 0 ? (
        <div className="empty-state card">
          <FolderTree size={48} aria-hidden="true" />
          <h3>{query ? 'Brak wyników' : 'Brak kategorii'}</h3>
          <p>
            {query
              ? `Żadna kategoria nie pasuje do „${query}".`
              : 'Twórz własną hierarchię kategorii — np. Mechanika › Kinematyka › Ruch jednostajny — i przypisuj je do zadań.'}
          </p>
          {!query && (
            <button type="button" className="btn btn-primary" onClick={() => startAdd(null)}>
              <Plus size={16} aria-hidden="true" /> Pierwsza kategoria
            </button>
          )}
        </div>
      ) : (
        <div className="card">
          {filteredTree.map((root) => (
            <CategoryTreeNode
              key={root.id}
              node={root}
              expanded={expanded}
              onToggleExpand={toggleExpand}
              renderTrailing={(n) => {
                const count = usage.get(n.id) ?? 0;
                if (editingId === n.id) {
                  return (
                    <div className="flex gap-1 flex-1">
                      <input
                        autoFocus
                        value={editingName}
                        onChange={(e) => setEditingName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void saveEdit(); if (e.key === 'Escape') cancelEdit(); }}
                        className="flex-1"
                      />
                      <button type="button" className="btn btn-primary btn-sm" onClick={saveEdit}>
                        <Check size={14} aria-hidden="true" />
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={cancelEdit}>
                        <X size={14} aria-hidden="true" />
                      </button>
                    </div>
                  );
                }
                return (
                  <div className="category-row-actions">
                    {count > 0 && (
                      <span className="text-faint text-xs mr-px-6">
                        {count} {count === 1 ? 'zadanie' : (count % 10 >= 2 && count % 10 <= 4 && (count % 100 < 12 || count % 100 > 14)) ? 'zadania' : 'zadań'}
                      </span>
                    )}
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => startAdd(n.id)}
                      aria-label={`Dodaj podkategorię do ${n.name}`}
                      title="Dodaj podkategorię"
                    >
                      <FolderPlus size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => startEdit(n)}
                      aria-label={`Zmień nazwę ${n.name}`}
                      title="Zmień nazwę"
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon color-danger"
                      onClick={() => requestDelete(n)}
                      aria-label={`Usuń ${n.name}`}
                      title="Usuń"
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                );
              }}
              renderAfterRow={(n) =>
                addParentId === n.id ? (
                  <div
                    className="subcategory-form"
                    data-depth={Math.min(n.depth + 1, 8)}
                  >
                    <div className="flex gap-1 wrap">
                      <input
                        autoFocus
                        value={newName}
                        onChange={(e) => setNewName(e.target.value)}
                        onKeyDown={(e) => { if (e.key === 'Enter') void saveAdd(); if (e.key === 'Escape') cancelAdd(); }}
                        placeholder={`Podkategoria w „${n.name}"…`}
                        className="flex-1-min200"
                      />
                      <button type="button" className="btn btn-primary btn-sm" onClick={saveAdd}>
                        <Check size={14} aria-hidden="true" /> Dodaj
                      </button>
                      <button type="button" className="btn btn-ghost btn-sm" onClick={cancelAdd}>
                        <X size={14} aria-hidden="true" /> Anuluj
                      </button>
                    </div>
                  </div>
                ) : null
              }
            />
          ))}
        </div>
      )}

      <ConfirmDialog
        open={!!importPreview}
        title="Zaimportować kategorie?"
        description={importPreview
          ? `Plik „${importPreview.file.name}" zawiera ${importPreview.categories.length} kategorii (z zagnieżdżeniami). Istniejące kategorie o tym samym ID zostaną nadpisane.`
          : ''}
        confirmLabel="Importuj"
        cancelLabel="Anuluj"
        onConfirm={() => { void performImport(); }}
        onCancel={() => { setImportPreview(null); if (importRef.current) importRef.current.value = ''; }}
      />

      <ConfirmDialog
        open={!!confirmDelete}
        title="Usunąć kategorię?"
        description={confirmDelete
          ? `„${confirmDelete.node.name}"${confirmDelete.descendantCount > 0 ? ` wraz z ${confirmDelete.descendantCount} podkategoriami` : ''} zostanie usunięta.${confirmDelete.affectedTaskCount > 0 ? ` Powiązanie z ${confirmDelete.affectedTaskCount} zadaniami zostanie usunięte (same zadania pozostaną).` : ''}`
          : ''}
        confirmLabel="Usuń"
        destructive
        onConfirm={performDelete}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}

