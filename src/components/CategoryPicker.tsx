import { useEffect, useMemo, useState } from 'react';
import { Search, X, Plus, Check, FolderTree } from 'lucide-react';
import db from '../db';
import type { Category } from '../types';
import { buildTree, pathLabel, type CategoryNode } from '../utils/categoryTree';
import CategoryTreeNode from './CategoryTreeNode';
import { toast } from '../hooks/useToast';

interface Props {
  categories: Category[];
  selectedIds: string[];
  onChange: (next: string[]) => void;
}

export default function CategoryPicker({ categories, selectedIds, onChange }: Props) {
  const tree = useMemo(() => buildTree(categories), [categories]);
  const [expanded, setExpanded] = useState<Set<string>>(() => {
    // Auto-expand the path to every selected node so they're visible on first render
    if (selectedIds.length === 0) return new Set();
    const byId = new Map(categories.map((c) => [c.id, c] as const));
    const ids = new Set<string>();
    for (const id of selectedIds) {
      let cur = byId.get(id);
      while (cur && cur.parentId) {
        ids.add(cur.parentId);
        cur = byId.get(cur.parentId);
      }
    }
    return ids;
  });
  const [query, setQuery] = useState('');
  const [adding, setAdding] = useState(false);
  const [newName, setNewName] = useState('');

  // Auto-expand on search
  useEffect(() => {
    if (!query.trim()) return;
    const all = new Set<string>();
    const walk = (n: CategoryNode) => { all.add(n.id); n.children.forEach(walk); };
    tree.forEach(walk);
    setExpanded(all);
  }, [query, tree]);

  const toggleExpand = (id: string) =>
    setExpanded((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });

  const selectedSet = useMemo(() => new Set(selectedIds), [selectedIds]);

  const togglePick = (id: string) => {
    if (selectedSet.has(id)) {
      onChange(selectedIds.filter((x) => x !== id));
    } else {
      onChange([...selectedIds, id]);
    }
  };

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

  const selectedDetailed = useMemo(() => {
    return categories.filter((c) => selectedSet.has(c.id));
  }, [categories, selectedSet]);

  const saveNewRoot = async () => {
    const trimmed = newName.trim();
    if (!trimmed) return;
    const now = Date.now();
    const id = `cat-${now}-${Math.random().toString(36).slice(2, 6)}`;
    await db.categories.add({
      id, name: trimmed, parentId: null, position: now,
      createdAt: now, updatedAt: now,
    });
    onChange([...selectedIds, id]);
    setNewName('');
    setAdding(false);
    toast.success({ title: 'Dodano kategorię', description: trimmed });
  };

  return (
    <div>
      {/* Selected pinned summary */}
      {selectedDetailed.length > 0 && (
        <div className="card card-tight card-accent mb-1">
          <div className="flex justify-between items-center mb-1">
            <strong className="text-sm color-accent">
              Wybrane kategorie ({selectedDetailed.length})
            </strong>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => onChange([])}>
              <X size={12} aria-hidden="true" /> Wyczyść
            </button>
          </div>
          <div className="flex gap-1 wrap">
            {selectedDetailed.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="badge badge-primary badge-action"
                onClick={() => togglePick(cat.id)}
                title={pathLabel(categories, cat.id)}
                aria-label={`Usuń wybór kategorii ${cat.name}`}
              >
                {pathLabel(categories, cat.id)}
                <X size={10} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="flex gap-1 wrap">
        <div className="search-input grow">
          <Search size={14} aria-hidden="true" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Szukaj kategorii…"
            aria-label="Filtruj kategorie"
          />
        </div>
        {!adding && (
          <button type="button" className="btn btn-secondary btn-sm" onClick={() => setAdding(true)}>
            <Plus size={14} aria-hidden="true" /> Nowa kategoria
          </button>
        )}
      </div>

      {adding && (
        <div className="flex gap-1 wrap inline-add-card">
          <input
            autoFocus
            value={newName}
            onChange={(e) => setNewName(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') void saveNewRoot();
              if (e.key === 'Escape') { setAdding(false); setNewName(''); }
            }}
            placeholder="Nazwa nowej kategorii głównej…"
            className="flex-1-min200"
          />
          <button type="button" className="btn btn-primary btn-sm" onClick={saveNewRoot}>
            <Check size={14} aria-hidden="true" /> Dodaj
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={() => { setAdding(false); setNewName(''); }}>
            <X size={14} aria-hidden="true" /> Anuluj
          </button>
        </div>
      )}

      <p className="text-faint text-xs mt-1 mb-px-6">
        Bardziej rozbudowanym zarządzaniem (zmiany nazw, usuwanie, podkategorie) zajmiesz się w zakładce „Kategorie".
      </p>

      {tree.length === 0 ? (
        <div className="empty-state empty-state-padded-sm">
          <FolderTree size={32} aria-hidden="true" />
          <p className="text-sm">Nie utworzono jeszcze kategorii. Dodaj pierwszą powyżej lub w zakładce „Kategorie".</p>
        </div>
      ) : filteredTree.length === 0 ? (
        <p className="text-muted text-sm">Brak kategorii dla „{query}".</p>
      ) : (
        <div className="list-scroll-vh-sm">
          {filteredTree.map((root) => (
            <CategoryTreeNode
              key={root.id}
              node={root}
              expanded={expanded}
              onToggleExpand={toggleExpand}
              rowClassName={(n) => selectedSet.has(n.id) ? 'selected' : ''}
              onSelect={(n) => togglePick(n.id)}
              renderLeading={(n) => (
                <input
                  type="checkbox"
                  className="icon-16"
                  checked={selectedSet.has(n.id)}
                  onChange={() => togglePick(n.id)}
                  onClick={(e) => e.stopPropagation()}
                  aria-label={`Wybierz ${n.name}`}
                />
              )}
            />
          ))}
        </div>
      )}
    </div>
  );
}
