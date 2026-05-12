import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  FileText, Plus, Trash2, Download, CheckSquare, Eye, Search,
  Square, X, FileSpreadsheet, GraduationCap, FolderTree, Sparkles,
} from 'lucide-react';
import db from '../db';
import type { Task, Test } from '../types';
import { randomizeParameter, renderParameterized } from '../utils/parameters';
import { generateTestDocx, generateTestAnswerKeyDocx, downloadBlob, taskPoints } from '../utils/export';
import { buildTree, descendantIds, findNode, pathLabel } from '../utils/categoryTree';
import OverflowMenu from './OverflowMenu';
import ConfirmDialog from './ConfirmDialog';
import ProgramPointPicker from './ProgramPointPicker';
import CategoryPicker from './CategoryPicker';
import Pagination from './Pagination';
import { toast } from '../hooks/useToast';

const SAFE_FILENAME = (s: string) =>
  s.replace(/[^a-z0-9ąćęłńóśźż\s]/gi, '').replace(/\s+/g, '_').slice(0, 60) || 'test';

export default function TestGenerator() {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const tests = useLiveQuery(() => db.tests.toArray(), []);
  const programPoints = useLiveQuery(() => db.programPoints.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const [title, setTitle] = useState('');
  const [description, setDescription] = useState('');
  const [selectedTasks, setSelectedTasks] = useState<string[]>([]);
  const [pickerQuery, setPickerQuery] = useState('');
  const [filterPP, setFilterPP] = useState<Set<string>>(new Set());
  const [ppPickerOpen, setPpPickerOpen] = useState(false);
  const [filterCategoryIds, setFilterCategoryIds] = useState<string[]>([]);
  const [catPickerOpen, setCatPickerOpen] = useState(false);
  const [settings, setSettings] = useState({
    shuffleTasks: false,
    shuffleAnswers: false,
    timeLimitMinutes: 45,
    showPoints: true,
  });
  const [previewTest, setPreviewTest] = useState<Test | null>(null);
  const [randomizedPreview, setRandomizedPreview] = useState<Map<string, Task>>(new Map());
  const [confirmDelete, setConfirmDelete] = useState<Test | null>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('taskforge.tests.pageSize') : null;
    const parsed = stored ? parseInt(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : 25;
  });
  const taskListRef = useRef<HTMLDivElement>(null);

  // Map of programPoint id → number of tasks referencing it (for picker hints)
  const taskCountByPpId = useMemo(() => {
    const map = new Map<string, number>();
    for (const t of tasks || []) {
      for (const id of t.programPoints) {
        map.set(id, (map.get(id) ?? 0) + 1);
      }
    }
    return map;
  }, [tasks]);

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

  const filteredTasks = useMemo(() => {
    if (!tasks) return undefined;
    const q = pickerQuery.trim().toLowerCase();
    const ppFilterActive = filterPP.size > 0;
    const catFilterActive = expandedCategoryIds !== null;
    return tasks.filter((t) => {
      if (ppFilterActive && !t.programPoints.some((id) => filterPP.has(id))) return false;
      if (catFilterActive && !(t.categories || []).some((id) => expandedCategoryIds!.has(id))) return false;
      if (!q) return true;
      return (
        t.title.toLowerCase().includes(q) ||
        t.subject.toLowerCase().includes(q) ||
        t.tags.some((tag) => tag.toLowerCase().includes(q))
      );
    });
  }, [tasks, pickerQuery, filterPP, expandedCategoryIds]);

  const togglePpFilter = (id: string) => {
    setFilterPP((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id);
      else next.add(id);
      return next;
    });
  };

  const clearPpFilter = () => setFilterPP(new Set());

  const filterPPDetailed = useMemo(() => {
    if (filterPP.size === 0 || !programPoints) return [];
    return programPoints.filter((p) => filterPP.has(p.id));
  }, [programPoints, filterPP]);

  const filterCategoriesDetailed = useMemo(() => {
    if (filterCategoryIds.length === 0 || !categories) return [];
    const ids = new Set(filterCategoryIds);
    return categories.filter((c) => ids.has(c.id));
  }, [categories, filterCategoryIds]);

  const removeCategoryFilter = (id: string) =>
    setFilterCategoryIds((prev) => prev.filter((x) => x !== id));

  const totalFiltered = filteredTasks?.length ?? 0;

  // Reset to page 1 when filters or result count change
  useEffect(() => {
    setPage(1);
  }, [pickerQuery, filterPP, filterCategoryIds, totalFiltered]);

  // Persist preferred page size
  useEffect(() => {
    try { window.localStorage.setItem('taskforge.tests.pageSize', String(pageSize)); } catch { /* ignore */ }
  }, [pageSize]);

  const pagedTasks = useMemo(() => {
    if (!filteredTasks) return undefined;
    if (pageSize === 0) return filteredTasks;
    const start = (page - 1) * pageSize;
    return filteredTasks.slice(start, start + pageSize);
  }, [filteredTasks, page, pageSize]);

  const onChangePage = (next: number) => {
    setPage(next);
    taskListRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
  };

  const selectedTotalPoints = useMemo(() => {
    if (!tasks) return 0;
    const ids = new Set(selectedTasks);
    return tasks.filter((t) => ids.has(t.id))
      .reduce((sum, t) => sum + taskPoints(t), 0);
  }, [tasks, selectedTasks]);

  const toggleTask = (id: string) => {
    setSelectedTasks((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const generate = async () => {
    if (selectedTasks.length === 0) return;
    const test: Test = {
      id: `test-${Date.now()}`,
      title: title.trim() || 'Nowy test',
      description: description.trim(),
      tasks: selectedTasks,
      settings: {
        shuffleTasks: settings.shuffleTasks,
        shuffleAnswers: settings.shuffleAnswers,
        timeLimitMinutes: settings.timeLimitMinutes || null,
        showPoints: settings.showPoints,
      },
      generatedAt: Date.now(),
    };
    await db.tests.add(test);
    setTitle(''); setDescription(''); setSelectedTasks([]);
    toast.success({ title: 'Utworzono test', description: `${test.tasks.length} zadań · ${selectedTotalPoints} pkt` });
  };

  const deleteTest = async (test: Test) => {
    await db.tests.delete(test.id);
    toast.success({
      title: 'Test usunięty',
      description: test.title,
      action: { label: 'Cofnij', onPress: async () => { await db.tests.put(test); toast.info({ title: 'Przywrócono test' }); } },
    });
  };

  const exportTest = async (test: Test, withKey: boolean) => {
    const testTasks = (tasks || []).filter((t) => test.tasks.includes(t.id));
    const base = SAFE_FILENAME(test.title);
    try {
      if (withKey) {
        const blob = await generateTestAnswerKeyDocx(test.title, testTasks);
        downloadBlob(blob, `${base}_klucz.docx`);
        toast.success({ title: 'Pobrano klucz odpowiedzi', description: test.title });
      } else {
        const blob = await generateTestDocx(test.title, testTasks);
        downloadBlob(blob, `${base}_test.docx`);
        toast.success({ title: 'Pobrano test', description: test.title });
      }
    } catch (err) {
      toast.error({
        title: 'Nie udało się wyeksportować',
        description: err instanceof Error ? err.message : String(err),
      });
    }
  };

  const openPreview = (test: Test) => {
    setPreviewTest(test);
    const map = new Map<string, Task>();
    const testTasks = (tasks || []).filter((t) => test.tasks.includes(t.id));
    for (const t of testTasks) {
      const randomized = { ...t, parameters: t.parameters.map((p) => randomizeParameter(p)) };
      map.set(t.id, randomized);
    }
    setRandomizedPreview(map);
  };

  useEffect(() => {
    if (!previewTest) return;
    const onKey = (e: KeyboardEvent) => { if (e.key === 'Escape') setPreviewTest(null); };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [previewTest]);

  const previewTasks = previewTest
    ? (tasks || []).filter((t) => previewTest.tasks.includes(t.id)).map((t) => randomizedPreview.get(t.id) || t)
    : [];

  return (
    <div>
      <div className="grid-2">
        <div className="panel">
          <div className="panel-title">Nowy test</div>

          <div className="form-group">
            <label htmlFor="test-title">Tytuł testu</label>
            <input id="test-title" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="np. Sprawdzian z kinematyki" />
          </div>
          <div className="form-group">
            <label htmlFor="test-desc">Opis / Instrukcje</label>
            <textarea id="test-desc" value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="Czas pracy: 45 minut. Każde zadanie ma podaną liczbę punktów…" />
          </div>
          <div className="form-row">
            <label className="flex items-center gap-1 mb-0" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 'var(--text-sm)' }}>
              <input type="checkbox" checked={settings.shuffleTasks} onChange={(e) => setSettings({ ...settings, shuffleTasks: e.target.checked })} style={{ width: 16, height: 16 }} />
              Losowa kolejność zadań
            </label>
            <label className="flex items-center gap-1 mb-0" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 'var(--text-sm)' }}>
              <input type="checkbox" checked={settings.showPoints} onChange={(e) => setSettings({ ...settings, showPoints: e.target.checked })} style={{ width: 16, height: 16 }} />
              Pokazuj punkty
            </label>
            <div className="form-group mb-0">
              <label htmlFor="test-time">Czas (min)</label>
              <input id="test-time" type="number" inputMode="numeric" min={0} value={settings.timeLimitMinutes}
                onChange={(e) => setSettings({ ...settings, timeLimitMinutes: parseInt(e.target.value) || 0 })} />
            </div>
          </div>

          <div className="flex justify-between items-center mt-2 mb-1" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
            <strong className="text-sm">
              Wybrane: {selectedTasks.length} {selectedTotalPoints > 0 && <span className="badge badge-success" style={{ marginLeft: 6 }}>{selectedTotalPoints} pkt</span>}
            </strong>
            <div className="flex gap-1">
              {filteredTasks && filteredTasks.length > 0 && (
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => {
                    const ids = filteredTasks.map((t) => t.id);
                    const allAlready = ids.every((id) => selectedTasks.includes(id));
                    if (allAlready) {
                      setSelectedTasks((prev) => prev.filter((id) => !ids.includes(id)));
                    } else {
                      setSelectedTasks((prev) => Array.from(new Set([...prev, ...ids])));
                    }
                  }}
                >
                  <CheckSquare size={12} aria-hidden="true" />
                  Zaznacz wszystkie z filtra ({filteredTasks.length})
                </button>
              )}
              {selectedTasks.length > 0 && (
                <button type="button" className="btn btn-ghost btn-sm" onClick={() => setSelectedTasks([])}>
                  <X size={12} aria-hidden="true" /> Wyczyść
                </button>
              )}
            </div>
          </div>

          <div className="form-group" style={{ marginBottom: 'var(--space-3)' }}>
            <div className="flex gap-1 wrap">
              <div className="search-input grow">
                <Search size={14} aria-hidden="true" />
                <input
                  value={pickerQuery}
                  onChange={(e) => setPickerQuery(e.target.value)}
                  placeholder="Szukaj zadań…"
                  aria-label="Filtruj zadania po tytule, przedmiocie lub tagu"
                />
              </div>
              <button
                type="button"
                className={`btn ${filterPP.size > 0 ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setPpPickerOpen(true)}
                aria-haspopup="dialog"
              >
                <GraduationCap size={14} aria-hidden="true" />
                Podstawa programowa
                {filterPP.size > 0 && (
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.25)', color: 'var(--accent-fg)' }}>
                    {filterPP.size}
                  </span>
                )}
              </button>
              <button
                type="button"
                className={`btn ${filterCategoryIds.length > 0 ? 'btn-primary' : 'btn-secondary'}`}
                onClick={() => setCatPickerOpen(true)}
                aria-haspopup="dialog"
              >
                <FolderTree size={14} aria-hidden="true" />
                Kategorie
                {filterCategoryIds.length > 0 && (
                  <span className="badge" style={{ background: 'rgba(255,255,255,0.25)', color: 'var(--accent-fg)' }}>
                    {filterCategoryIds.length}
                  </span>
                )}
              </button>
            </div>
            {(filterPP.size > 0 || filterCategoryIds.length > 0) && (
              <div className="flex gap-1 wrap" style={{ marginTop: 'var(--space-3)', alignItems: 'center' }}>
                {filterPP.size > 0 && (
                  <>
                    <span className="text-xs text-muted">Podstawa:</span>
                    {filterPPDetailed.map((pp) => (
                      <button
                        key={pp.id}
                        type="button"
                        className="badge badge-primary"
                        style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', border: 'none' }}
                        onClick={() => togglePpFilter(pp.id)}
                        title={pp.description}
                        aria-label={`Usuń filtr ${pp.code}`}
                      >
                        {pp.code}
                        <X size={10} aria-hidden="true" />
                      </button>
                    ))}
                  </>
                )}
                {filterCategoryIds.length > 0 && (
                  <>
                    <span className="text-xs text-muted" style={{ marginLeft: filterPP.size > 0 ? 'var(--space-3)' : 0 }}>Kategorie:</span>
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
                  </>
                )}
                {(filterPP.size > 0 || filterCategoryIds.length > 0) && (
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => { clearPpFilter(); setFilterCategoryIds([]); }}
                  >
                    <X size={12} aria-hidden="true" /> Wyczyść wszystkie
                  </button>
                )}
              </div>
            )}
          </div>

          <div ref={taskListRef} className="task-list" style={{ maxHeight: 360, overflowY: 'auto' }}>
            {pagedTasks === undefined ? (
              [0, 1].map((i) => <div key={i} className="skeleton skeleton-card" />)
            ) : pagedTasks.length === 0 ? (
              <p className="text-muted text-sm">Brak zadań spełniających filtr.</p>
            ) : pagedTasks.map((t) => {
              const checked = selectedTasks.includes(t.id);
              const points = taskPoints(t);
              return (
                <label key={t.id} className={`list-row ${checked ? 'selected' : ''}`}>
                  {checked
                    ? <CheckSquare size={16} aria-hidden="true" style={{ color: 'var(--accent)' }} />
                    : <Square size={16} aria-hidden="true" />}
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span style={{ display: 'flex', alignItems: 'center', gap: 6, minWidth: 0 }}>
                      <strong className="text-sm" style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{t.title}</strong>
                      {t.aiGenerated && (
                        <span
                          className="badge"
                          style={{ background: 'var(--info-bg)', color: 'var(--info)', display: 'inline-flex', alignItems: 'center', gap: 3, flexShrink: 0 }}
                          title={t.aiModel ? `AI · ${t.aiModel}` : 'Wygenerowane przez AI'}
                        >
                          <Sparkles size={10} aria-hidden="true" /> AI
                        </span>
                      )}
                    </span>
                    <span className="text-faint text-xs">{t.subject} · {t.level} {t.class} · {points} pkt</span>
                  </span>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => toggleTask(t.id)}
                    className="sr-only"
                    aria-label={`Wybierz zadanie ${t.title}`}
                  />
                </label>
              );
            })}
          </div>

          {filteredTasks && filteredTasks.length > 0 && (
            <Pagination
              page={page}
              pageSize={pageSize}
              total={filteredTasks.length}
              pageSizeOptions={[10, 25, 50, 100, 0]}
              onPageChange={onChangePage}
              onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
              itemNouns={['zadanie', 'zadania', 'zadań']}
            />
          )}

          <button type="button" className="btn btn-primary mt-2" onClick={generate} disabled={selectedTasks.length === 0}>
            <Plus size={16} aria-hidden="true" /> Utwórz test
          </button>
        </div>

        <div className="panel">
          <div className="panel-title">Zapisane testy</div>
          <div className="task-list">
            {tests === undefined ? (
              [0, 1].map((i) => <div key={i} className="skeleton skeleton-card" />)
            ) : tests.length === 0 ? (
              <div className="empty-state" style={{ padding: 'var(--space-6)' }}>
                <FileText size={32} aria-hidden="true" />
                <p>Brak zapisanych testów. Wybierz zadania i kliknij „Utwórz test".</p>
              </div>
            ) : tests.map((test) => {
              const testTasks = (tasks || []).filter((t) => test.tasks.includes(t.id));
              const totalPoints = testTasks.reduce((sum, t) => sum + taskPoints(t), 0);
              return (
                <div key={test.id} className="card card-tight">
                  <div className="flex justify-between items-center" style={{ gap: 'var(--space-3)' }}>
                    <div style={{ minWidth: 0, flex: 1 }}>
                      <strong>{test.title}</strong>
                      <div className="text-muted text-sm">
                        {test.tasks.length} zadań · {totalPoints} pkt · {new Date(test.generatedAt).toLocaleDateString('pl-PL')}
                      </div>
                    </div>
                    <div className="flex gap-1">
                      <button type="button" className="btn btn-secondary btn-sm" onClick={() => openPreview(test)} aria-label={`Podgląd ${test.title}`}>
                        <Eye size={14} aria-hidden="true" />
                      </button>
                      <OverflowMenu
                        ariaLabel={`Więcej akcji dla ${test.title}`}
                        items={[
                          { id: 'export', label: 'Eksportuj test', icon: <Download size={14} aria-hidden="true" />, onSelect: () => exportTest(test, false) },
                          { id: 'key',    label: 'Eksportuj klucz', icon: <FileSpreadsheet size={14} aria-hidden="true" />, onSelect: () => exportTest(test, true) },
                          { id: 'del',    label: 'Usuń test',       icon: <Trash2 size={14} aria-hidden="true" />, variant: 'danger', divider: true, onSelect: () => setConfirmDelete(test) },
                        ]}
                      />
                    </div>
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>

      {catPickerOpen && (
        <div className="overlay" onMouseDown={() => setCatPickerOpen(false)} role="presentation">
          <div
            className="overlay-content"
            style={{ maxWidth: 720 }}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="cat-filter-title-tg"
          >
            <div className="flex justify-between items-center mb-2">
              <h2 id="cat-filter-title-tg" className="card-title mb-0">Filtruj zadania po kategoriach</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCatPickerOpen(false)}>
                <X size={14} aria-hidden="true" /> Zamknij
              </button>
            </div>
            <p className="text-muted text-sm mb-2">
              Wybór kategorii nadrzędnej dopasowuje też zadania przypisane do jej podkategorii. Test złożysz z zadań pasujących do co najmniej jednej z wybranych kategorii.
            </p>
            <CategoryPicker
              categories={categories || []}
              selectedIds={filterCategoryIds}
              onChange={setFilterCategoryIds}
            />
            <div className="flex gap-1 justify-end mt-2">
              <button type="button" className="btn btn-primary" onClick={() => setCatPickerOpen(false)}>
                Gotowe ({filterCategoryIds.length})
              </button>
            </div>
          </div>
        </div>
      )}

      {ppPickerOpen && (
        <div className="overlay" onMouseDown={() => setPpPickerOpen(false)} role="presentation">
          <div
            className="overlay-content"
            style={{ maxWidth: 880 }}
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="pp-picker-title"
          >
            <div className="flex justify-between items-center mb-2">
              <h2 id="pp-picker-title" className="card-title mb-0">Filtruj zadania po podstawie programowej</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPpPickerOpen(false)}>
                <X size={14} aria-hidden="true" /> Zamknij
              </button>
            </div>
            <p className="text-muted text-sm mb-2">
              Zaznacz punkty, których ma dotyczyć test. Pokażemy tylko zadania powiązane z którymkolwiek z wybranych punktów.
            </p>
            <ProgramPointPicker
              programPoints={programPoints || []}
              selectedIds={filterPP}
              onToggle={togglePpFilter}
              onClear={clearPpFilter}
              taskCountByPpId={taskCountByPpId}
            />
            <div className="flex gap-1 justify-end mt-2">
              <button type="button" className="btn btn-primary" onClick={() => setPpPickerOpen(false)}>
                Gotowe ({filterPP.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {previewTest && (
        <div className="overlay" onMouseDown={() => setPreviewTest(null)} role="presentation">
          <div className="overlay-content" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-labelledby="preview-title">
            <div className="flex justify-between items-center mb-2">
              <h2 id="preview-title" className="card-title mb-0">Podgląd: {previewTest.title}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPreviewTest(null)}>
                <X size={14} aria-hidden="true" /> Zamknij
              </button>
            </div>
            <p className="text-muted text-sm mb-2">Parametry zostały wylosowane na potrzeby podglądu.</p>
            <div className="task-list">
              {previewTasks.map((t, i) => (
                <div key={t.id} className="card card-tight">
                  <div className="flex justify-between items-center">
                    <strong>Zadanie {i + 1}</strong>
                    <span className="badge badge-success">{taskPoints(t)} pkt</span>
                  </div>
                  <div className="preview-box mt-1">
                    {renderParameterized(t.content, t.parameters)}
                    {t.taskType === 'closed' && t.choices && t.choices.length > 0 && (
                      <ol style={{ marginTop: 8, paddingLeft: 0, listStyle: 'none' }}>
                        {t.choices.map((c, ci) => (
                          <li key={c.id} style={{ marginTop: 2 }}>
                            <strong>{String.fromCharCode(97 + ci)})</strong> {renderParameterized(c.content, t.parameters)}
                          </li>
                        ))}
                      </ol>
                    )}
                  </div>
                </div>
              ))}
            </div>
          </div>
        </div>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Usunąć test?"
        description={confirmDelete ? `„${confirmDelete.title}" zostanie usunięty. Tę akcję można cofnąć z paska powiadomień.` : ''}
        confirmLabel="Usuń"
        destructive
        onConfirm={() => { if (confirmDelete) { void deleteTest(confirmDelete); setConfirmDelete(null); } }}
        onCancel={() => setConfirmDelete(null)}
      />
    </div>
  );
}
