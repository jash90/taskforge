import { useMemo, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Pencil, Trash2, Shuffle, Search, Tag, BookOpen, FileSpreadsheet,
  Filter, X, Download, CheckSquare, Square, Plus, FolderTree, Sparkles,
} from 'lucide-react';
import db from '../db';
import type { Task } from '../types';
import { renderParameterized } from '../utils/parameters';
import { copyAsWord, downloadFile } from '../utils/export';
import { buildTree, descendantIds, findNode, pathLabel } from '../utils/categoryTree';
import OverflowMenu from './OverflowMenu';
import ConfirmDialog from './ConfirmDialog';
import CategoryPicker from './CategoryPicker';
import { toast } from '../hooks/useToast';

interface Props {
  onEdit: (task: Task) => void;
  onRandomize: (task: Task) => void;
  onNew: () => void;
}

const SAFE_FILENAME = (s: string) =>
  s.replace(/[^a-z0-9ąćęłńóśźż\s]/gi, '').replace(/\s+/g, '_').slice(0, 60) || 'zadanie';

export default function TaskList({ onEdit, onRandomize, onNew }: Props) {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const [query, setQuery] = useState('');
  const [filterSubject, setFilterSubject] = useState('');
  const [filterLevel, setFilterLevel] = useState<'' | Task['level']>('');
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);
  const [categoryPickerOpen, setCategoryPickerOpen] = useState(false);
  const [selected, setSelected] = useState<Set<string>>(new Set());
  const [filterSheet, setFilterSheet] = useState(false);
  const [confirmOne, setConfirmOne] = useState<Task | null>(null);
  const [confirmBulk, setConfirmBulk] = useState(false);

  const subjects = useMemo(
    () => Array.from(new Set((tasks || []).map((t) => t.subject))).sort(),
    [tasks],
  );

  // When a parent category is selected, also match tasks tagged under any descendant.
  const expandedCategoryIds = useMemo(() => {
    if (filterCategoryIds.length === 0) return null;
    const tree = buildTree(categories || []);
    const out = new Set<string>(filterCategoryIds);
    for (const id of filterCategoryIds) {
      const node = findNode(tree, id);
      if (node) for (const d of descendantIds(node)) out.add(d);
    }
    return out;
  }, [filterCategoryIds, categories]);

  const filtered = useMemo(() => {
    if (!tasks) return undefined;
    const q = query.trim().toLowerCase();
    return tasks.filter((t) => {
      const matchesQuery = !q ||
        t.title.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q));
      const matchesSubject = !filterSubject || t.subject === filterSubject;
      const matchesLevel = !filterLevel || t.level === filterLevel;
      const matchesCategories = !expandedCategoryIds || (t.categories || []).some((id) => expandedCategoryIds.has(id));
      return matchesQuery && matchesSubject && matchesLevel && matchesCategories;
    });
  }, [tasks, query, filterSubject, filterLevel, expandedCategoryIds]);

  const filterCount = (filterSubject ? 1 : 0) + (filterLevel ? 1 : 0) + (filterCategoryIds.length > 0 ? 1 : 0);

  const clearFilters = () => {
    setQuery(''); setFilterSubject(''); setFilterLevel(''); setFilterCategoryIds([]);
  };

  const filterCategoriesDetailed = useMemo(() => {
    if (filterCategoryIds.length === 0 || !categories) return [];
    const ids = new Set(filterCategoryIds);
    return categories.filter((c) => ids.has(c.id));
  }, [filterCategoryIds, categories]);

  const removeCategoryFilter = (id: string) =>
    setFilterCategoryIds((prev) => prev.filter((x) => x !== id));

  const toggleSelect = (id: string) => {
    setSelected((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };

  const toggleSelectAll = () => {
    if (!filtered) return;
    if (selected.size === filtered.length && filtered.length > 0) setSelected(new Set());
    else setSelected(new Set(filtered.map((t) => t.id)));
  };

  const exportTaskWord = (task: Task) => {
    const html = copyAsWord(task);
    downloadFile(html, `${SAFE_FILENAME(task.title)}.doc.html`, 'text/html');
    toast.success({ title: 'Pobrano dokument', description: task.title });
  };

  const deleteTask = async (task: Task) => {
    await db.tasks.delete(task.id);
    setSelected((prev) => {
      const next = new Set(prev);
      next.delete(task.id);
      return next;
    });
    toast.success({
      title: 'Zadanie usunięte',
      description: task.title,
      action: {
        label: 'Cofnij',
        onPress: async () => {
          await db.tasks.put(task);
          toast.info({ title: 'Przywrócono zadanie', description: task.title });
        },
      },
    });
  };

  const bulkDelete = async () => {
    if (!tasks) return;
    const selectedTasks = tasks.filter((t) => selected.has(t.id));
    if (selectedTasks.length === 0) return;
    await db.tasks.bulkDelete(selectedTasks.map((t) => t.id));
    setSelected(new Set());
    toast.success({
      title: `Usunięto ${selectedTasks.length} zadań`,
      action: {
        label: 'Cofnij',
        onPress: async () => {
          await db.tasks.bulkPut(selectedTasks);
          toast.info({ title: 'Przywrócono zadania' });
        },
      },
    });
  };

  const bulkExport = () => {
    if (!tasks) return;
    const selectedTasks = tasks.filter((t) => selected.has(t.id));
    if (selectedTasks.length === 0) return;
    selectedTasks.forEach((t) => {
      const html = copyAsWord(t);
      downloadFile(html, `${SAFE_FILENAME(t.title)}.doc.html`, 'text/html');
    });
    toast.success({ title: `Wyeksportowano ${selectedTasks.length} zadań` });
  };

  const allChecked = filtered && filtered.length > 0 && selected.size === filtered.length;
  const someChecked = selected.size > 0 && !allChecked;

  return (
    <div>
      {/* Toolbar */}
      <div className="card mb-2">
        <div className="flex gap-1 wrap items-center">
          <div className="form-group mb-0" style={{ flex: '1 1 240px', minWidth: 200 }}>
            <label htmlFor="task-search" className="sr-only">Szukaj zadań</label>
            <div className="search-input">
              <Search size={14} aria-hidden="true" />
              <input
                id="task-search"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj po tytule, treści lub tagu…"
              />
            </div>
          </div>
          <div className="form-group mb-0 desktop-only" style={{ flex: '0 1 200px', minWidth: 160 }}>
            <label htmlFor="filter-subject" className="sr-only">Przedmiot</label>
            <select id="filter-subject" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
              <option value="">Wszystkie przedmioty</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group mb-0 desktop-only" style={{ flex: '0 1 200px', minWidth: 160 }}>
            <label htmlFor="filter-level" className="sr-only">Poziom</label>
            <select
              id="filter-level"
              value={filterLevel}
              onChange={(e) => setFilterLevel(e.target.value as Task['level'] | '')}
            >
              <option value="">Wszystkie poziomy</option>
              <option value="podstawowa">Szkoła podstawowa</option>
              <option value="liceum">Liceum</option>
              <option value="technikum">Technikum</option>
            </select>
          </div>
          <button
            type="button"
            className={`btn ${filterCategoryIds.length > 0 ? 'btn-primary' : 'btn-secondary'} desktop-only`}
            onClick={() => setCategoryPickerOpen(true)}
            aria-haspopup="dialog"
            style={{ flex: '0 0 auto' }}
          >
            <FolderTree size={14} aria-hidden="true" />
            Kategorie
            {filterCategoryIds.length > 0 && (
              <span className="badge" style={{ background: 'rgba(255,255,255,0.25)', color: 'var(--accent-fg)' }}>
                {filterCategoryIds.length}
              </span>
            )}
          </button>
          <button
            type="button"
            className="btn btn-secondary mobile-only"
            onClick={() => setFilterSheet(true)}
            style={{ flex: '0 0 auto' }}
          >
            <Filter size={14} aria-hidden="true" /> Filtry {filterCount > 0 && <span className="badge badge-primary">{filterCount}</span>}
          </button>
          {(filterCount > 0 || query) && (
            <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters} style={{ flex: '0 0 auto' }}>
              <X size={12} aria-hidden="true" /> Wyczyść
            </button>
          )}
        </div>
        {filterCategoryIds.length > 0 && (
          <div className="flex gap-1 wrap" style={{ marginTop: 'var(--space-3)', alignItems: 'center' }}>
            <span className="text-xs text-muted">Kategorie:</span>
            {filterCategoriesDetailed.map((cat) => (
              <button
                key={cat.id}
                type="button"
                className="badge badge-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', border: 'none' }}
                onClick={() => removeCategoryFilter(cat.id)}
                title={pathLabel(categories || [], cat.id)}
                aria-label={`Usuń filtr ${cat.name}`}
              >
                {pathLabel(categories || [], cat.id)}
                <X size={10} aria-hidden="true" />
              </button>
            ))}
          </div>
        )}
      </div>

      {/* Bulk action bar */}
      {selected.size > 0 && (
        <div className="card mb-2" style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', gap: 'var(--space-4)', padding: 'var(--space-3) var(--space-5)' }}>
          <span className="text-sm font-semibold">
            Wybrano <strong>{selected.size}</strong> {selected.size === 1 ? 'zadanie' : selected.size < 5 ? 'zadania' : 'zadań'}
          </span>
          <div className="flex gap-1">
            <button type="button" className="btn btn-secondary btn-sm" onClick={bulkExport}>
              <Download size={14} aria-hidden="true" /> Eksportuj wybrane
            </button>
            <button type="button" className="btn btn-danger-soft btn-sm" onClick={() => setConfirmBulk(true)}>
              <Trash2 size={14} aria-hidden="true" /> Usuń wybrane
            </button>
            <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelected(new Set())}>
              <X size={14} aria-hidden="true" /> Odznacz
            </button>
          </div>
        </div>
      )}

      {/* List */}
      {filtered === undefined ? (
        <div className="task-list" aria-busy="true">
          {[0, 1, 2].map((i) => <div key={i} className="skeleton skeleton-card" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <BookOpen size={48} aria-hidden="true" />
          <h3>{tasks && tasks.length === 0 ? 'Brak zadań w bazie' : 'Brak wyników'}</h3>
          <p>
            {tasks && tasks.length === 0
              ? 'Utwórz pierwsze zadanie. Wpisz treść z liczbami, a TaskForge wykryje parametry automatycznie.'
              : 'Spróbuj zmienić filtry lub wyczyścić wyszukiwanie.'}
          </p>
          {tasks && tasks.length === 0 && (
            <button type="button" className="btn btn-primary" onClick={onNew}>
              <Plus size={16} aria-hidden="true" /> Nowe zadanie
            </button>
          )}
        </div>
      ) : (
        <>
          <div className="flex items-center gap-1 mb-1" style={{ paddingLeft: 6 }}>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={toggleSelectAll}
              aria-label={allChecked ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}
            >
              {allChecked || someChecked ? <CheckSquare size={14} aria-hidden="true" /> : <Square size={14} aria-hidden="true" />}
              <span>{allChecked ? 'Odznacz wszystkie' : 'Zaznacz wszystkie'}</span>
            </button>
            <span className="text-faint text-xs">
              {filtered.length} {filtered.length === 1 ? 'zadanie' : filtered.length < 5 ? 'zadania' : 'zadań'}
            </span>
          </div>

          <div className="task-list">
            {filtered.map((task) => {
              const totalPoints = task.answerKey.reduce((s, a) => s + a.points, 0);
              const isSelected = selected.has(task.id);
              return (
                <article key={task.id} className={`task-item ${isSelected ? 'selected' : ''}`}>
                  <div style={{ display: 'flex', gap: 'var(--space-4)', minWidth: 0 }}>
                    <label className="task-checkbox" aria-label={`Zaznacz ${task.title}`}>
                      <input
                        type="checkbox"
                        checked={isSelected}
                        onChange={() => toggleSelect(task.id)}
                      />
                    </label>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <div className="flex items-center gap-1 wrap">
                        <strong>{task.title}</strong>
                        {task.aiGenerated && (
                          <span
                            className="badge"
                            style={{ background: 'var(--info-bg)', color: 'var(--info)', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                            title={task.aiModel ? `Wygenerowane przez ${task.aiModel}` : 'Wygenerowane przez AI'}
                          >
                            <Sparkles size={10} aria-hidden="true" /> AI
                          </span>
                        )}
                        <span className="badge badge-primary">{task.subject}</span>
                        <span className="badge badge-info">{task.level} · {task.class}</span>
                        {totalPoints > 0 && <span className="badge badge-success">{totalPoints} pkt</span>}
                      </div>
                      <div className="text-muted text-sm mt-1">
                        {renderParameterized(task.content, task.parameters).slice(0, 180)}
                        {task.content.length > 180 && '…'}
                      </div>
                      <div className="task-meta">
                        {task.tags.map((tag) => (
                          <span key={tag} className="tag"><Tag size={10} aria-hidden="true" /> {tag}</span>
                        ))}
                        {task.programPoints.length > 0 && (
                          <span className="text-sm text-faint">{task.programPoints.length} pkt podstawy</span>
                        )}
                      </div>
                    </div>
                  </div>
                  <div className="task-actions">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onEdit(task)}
                    >
                      <Pencil size={14} aria-hidden="true" /> Edytuj
                    </button>
                    <OverflowMenu
                      ariaLabel={`Więcej akcji dla ${task.title}`}
                      items={[
                        { id: 'rand',  label: 'Losuj warianty',     icon: <Shuffle size={14} aria-hidden="true" />,          onSelect: () => onRandomize(task) },
                        { id: 'word',  label: 'Eksportuj jako Word', icon: <FileSpreadsheet size={14} aria-hidden="true" />, onSelect: () => exportTaskWord(task) },
                        { id: 'del',   label: 'Usuń zadanie',       icon: <Trash2 size={14} aria-hidden="true" />,           onSelect: () => setConfirmOne(task), variant: 'danger', divider: true },
                      ]}
                    />
                  </div>
                </article>
              );
            })}
          </div>
        </>
      )}

      {filterSheet && (
        <>
          <div className="drawer-backdrop" onClick={() => setFilterSheet(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Filtry">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-header">
              <h3 className="card-title mb-0">Filtry</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setFilterSheet(false)}>Zamknij</button>
            </div>
            <div className="sheet-body">
              <div className="form-group">
                <label htmlFor="m-filter-subject">Przedmiot</label>
                <select id="m-filter-subject" value={filterSubject} onChange={(e) => setFilterSubject(e.target.value)}>
                  <option value="">Wszystkie</option>
                  {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
                </select>
              </div>
              <div className="form-group">
                <label htmlFor="m-filter-level">Poziom</label>
                <select
                  id="m-filter-level"
                  value={filterLevel}
                  onChange={(e) => setFilterLevel(e.target.value as Task['level'] | '')}
                >
                  <option value="">Wszystkie</option>
                  <option value="podstawowa">Szkoła podstawowa</option>
                  <option value="liceum">Liceum</option>
                  <option value="technikum">Technikum</option>
                </select>
              </div>
              <div className="form-group">
                <label>Kategorie</label>
                <button
                  type="button"
                  className={`btn ${filterCategoryIds.length > 0 ? 'btn-primary' : 'btn-secondary'}`}
                  onClick={() => { setFilterSheet(false); setCategoryPickerOpen(true); }}
                >
                  <FolderTree size={14} aria-hidden="true" />
                  Wybierz kategorie
                  {filterCategoryIds.length > 0 && (
                    <span className="badge" style={{ background: 'rgba(255,255,255,0.25)', color: 'var(--accent-fg)' }}>
                      {filterCategoryIds.length}
                    </span>
                  )}
                </button>
              </div>
              <div className="flex gap-1">
                <button type="button" className="btn btn-secondary" onClick={clearFilters}>
                  <X size={14} aria-hidden="true" /> Wyczyść
                </button>
                <button type="button" className="btn btn-primary" onClick={() => setFilterSheet(false)}>
                  Zastosuj
                </button>
              </div>
            </div>
          </div>
        </>
      )}

      {categoryPickerOpen && (
        <div className="overlay" onMouseDown={() => setCategoryPickerOpen(false)} role="presentation">
          <div
            className="overlay-content"
            style={{ maxWidth: 720 }}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cat-filter-title"
          >
            <div className="flex justify-between items-center mb-2">
              <h2 id="cat-filter-title" className="card-title mb-0">Filtruj zadania po kategoriach</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCategoryPickerOpen(false)}>
                <X size={14} aria-hidden="true" /> Zamknij
              </button>
            </div>
            <p className="text-muted text-sm mb-2">
              Wybór kategorii nadrzędnej dopasowuje też zadania przypisane do jej podkategorii.
            </p>
            <CategoryPicker
              categories={categories || []}
              selectedIds={filterCategoryIds}
              onChange={setFilterCategoryIds}
            />
            <div className="flex gap-1 justify-end mt-2">
              <button type="button" className="btn btn-primary" onClick={() => setCategoryPickerOpen(false)}>
                Gotowe ({filterCategoryIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmOne}
        title="Usunąć zadanie?"
        description={confirmOne ? `„${confirmOne.title}" zostanie trwale usunięte z bazy. Tę akcję można cofnąć z paska powiadomień.` : ''}
        confirmLabel="Usuń"
        destructive
        onConfirm={() => { if (confirmOne) { void deleteTask(confirmOne); setConfirmOne(null); } }}
        onCancel={() => setConfirmOne(null)}
      />

      <ConfirmDialog
        open={confirmBulk}
        title={`Usunąć ${selected.size} ${selected.size === 1 ? 'zadanie' : selected.size < 5 ? 'zadania' : 'zadań'}?`}
        description="Wszystkie zaznaczone zadania zostaną usunięte. Tę akcję można cofnąć z paska powiadomień."
        confirmLabel="Usuń"
        destructive
        onConfirm={() => { void bulkDelete(); setConfirmBulk(false); }}
        onCancel={() => setConfirmBulk(false)}
      />
    </div>
  );
}
