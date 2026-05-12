import { useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  GraduationCap, Search, Plus, Trash2, Save, X, LayoutGrid, List,
  Pencil, Download, Upload,
} from 'lucide-react';
import db from '../db';
import type { ProgramPoint } from '../types';
import ConfirmDialog from './ConfirmDialog';
import Pagination from './Pagination';
import { toast } from '../hooks/useToast';
import {
  exportProgramPointsToJSON,
  importProgramPointsFromJSON,
  downloadFile,
} from '../utils/export';

type DrawerMode =
  | { kind: 'closed' }
  | { kind: 'add' }
  | { kind: 'edit'; point: ProgramPoint };

interface ImportPreview {
  file: File;
  points: ProgramPoint[];
}

const emptyForm = {
  code: '',
  description: '',
  level: 'podstawowa' as ProgramPoint['level'],
  cls: '',
  subject: 'Fizyka',
  zakres: '',
  dzialNumer: '',
  dzialNazwa: '',
};

export default function ProgramBaseViewer() {
  const points = useLiveQuery(() => db.programPoints.toArray(), []);
  const [level, setLevel] = useState<ProgramPoint['level'] | ''>('');
  const [subject, setSubject] = useState('Fizyka');
  const [zakres, setZakres] = useState<'' | 'podstawowy' | 'rozszerzony'>('');
  const [cls, setCls] = useState('');
  const [query, setQuery] = useState('');
  const [drawer, setDrawer] = useState<DrawerMode>({ kind: 'closed' });
  const [groupByDzial, setGroupByDzial] = useState(true);
  const [confirmDelete, setConfirmDelete] = useState<ProgramPoint | null>(null);
  const [importPreview, setImportPreview] = useState<ImportPreview | null>(null);
  const importRef = useRef<HTMLInputElement>(null);

  const [page, setPage] = useState(1);
  const [pageSize, setPageSize] = useState<number>(() => {
    const stored = typeof window !== 'undefined' ? window.localStorage.getItem('taskforge.pp.pageSize') : null;
    const parsed = stored ? parseInt(stored) : NaN;
    return Number.isFinite(parsed) ? parsed : 100;
  });

  const [form, setForm] = useState(emptyForm);

  const subjects = useMemo(() => Array.from(new Set((points || []).map((p) => p.subject))).sort(), [points]);
  const classes = useMemo(() => Array.from(new Set((points || []).map((p) => p.class))).sort(), [points]);

  const filtered = useMemo(() => {
    if (!points) return undefined;
    const q = query.trim().toLowerCase();
    return points.filter((p) => {
      const matchesLevel = !level || p.level === level;
      const matchesSubject = !subject || p.subject === subject;
      const matchesZakres = !zakres || p.zakres === zakres;
      const matchesClass = !cls || p.class === cls;
      const matchesQuery = !q ||
        p.code.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.dzialNazwa || '').toLowerCase().includes(q);
      return matchesLevel && matchesSubject && matchesZakres && matchesClass && matchesQuery;
    });
  }, [points, level, subject, zakres, cls, query]);

  const totalFiltered = filtered?.length ?? 0;

  // Reset to page 1 when filters or result count change
  useEffect(() => {
    setPage(1);
  }, [level, subject, zakres, cls, query, totalFiltered]);

  // Persist preferred page size
  useEffect(() => {
    try { window.localStorage.setItem('taskforge.pp.pageSize', String(pageSize)); } catch { /* ignore */ }
  }, [pageSize]);

  const pagedSlice = useMemo(() => {
    if (!filtered) return [];
    if (pageSize === 0) return filtered;
    const start = (page - 1) * pageSize;
    return filtered.slice(start, start + pageSize);
  }, [filtered, page, pageSize]);

  const grouped = useMemo(() => {
    const acc: Record<string, ProgramPoint[]> = {};
    for (const p of pagedSlice) {
      const key = p.dzialNumer ? `${p.dzialNumer}. ${p.dzialNazwa || 'Inne'}` : 'Inne';
      (acc[key] ??= []).push(p);
    }
    return Object.entries(acc);
  }, [pagedSlice]);

  const filterCount = (level ? 1 : 0) + (zakres ? 1 : 0) + (cls ? 1 : 0);
  const hasFiltering = filterCount > 0 || query || subject !== 'Fizyka';

  const clearFilters = () => {
    setLevel(''); setZakres(''); setCls(''); setQuery(''); setSubject('Fizyka');
  };

  const openAdd = () => {
    setForm(emptyForm);
    setDrawer({ kind: 'add' });
  };

  const openEdit = (pp: ProgramPoint) => {
    setForm({
      code: pp.code,
      description: pp.description,
      level: pp.level,
      cls: pp.class,
      subject: pp.subject,
      zakres: pp.zakres ?? '',
      dzialNumer: pp.dzialNumer ?? '',
      dzialNazwa: pp.dzialNazwa ?? '',
    });
    setDrawer({ kind: 'edit', point: pp });
  };

  const closeDrawer = () => setDrawer({ kind: 'closed' });

  const savePoint = async () => {
    if (!form.code.trim() || !form.description.trim()) {
      toast.error({ title: 'Uzupełnij kod i opis' });
      return;
    }
    if (drawer.kind === 'edit') {
      const updated: ProgramPoint = {
        ...drawer.point,
        code: form.code.trim(),
        description: form.description.trim(),
        level: form.level,
        class: form.cls.trim(),
        subject: form.subject.trim() || 'Inne',
        zakres: form.zakres || undefined,
        dzialNumer: form.dzialNumer.trim() || undefined,
        dzialNazwa: form.dzialNazwa.trim() || undefined,
      };
      await db.programPoints.put(updated);
      toast.success({ title: 'Zapisano zmiany', description: updated.code });
    } else {
      await db.programPoints.add({
        id: `pp-${Date.now()}`,
        code: form.code.trim(),
        description: form.description.trim(),
        level: form.level,
        class: form.cls.trim(),
        subject: form.subject.trim() || 'Inne',
        zakres: form.zakres || undefined,
        dzialNumer: form.dzialNumer.trim() || undefined,
        dzialNazwa: form.dzialNazwa.trim() || undefined,
      });
      toast.success({ title: 'Dodano punkt podstawy', description: form.code.trim() });
    }
    closeDrawer();
  };

  const deletePoint = async (pp: ProgramPoint) => {
    await db.programPoints.delete(pp.id);
    toast.success({
      title: 'Usunięto punkt podstawy',
      description: pp.code,
      action: { label: 'Cofnij', onPress: async () => { await db.programPoints.put(pp); toast.info({ title: 'Przywrócono punkt' }); } },
    });
  };

  const handleExport = () => {
    if (!points || points.length === 0) {
      toast.info({ title: 'Brak punktów do eksportu' });
      return;
    }
    const subjectSlug = (subject || 'wszystkie').toLowerCase().replace(/\s+/g, '_');
    const json = exportProgramPointsToJSON(points);
    downloadFile(json, `taskforge_podstawa_${subjectSlug}_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    toast.success({ title: 'Eksport gotowy', description: `${points.length} punktów podstawy` });
  };

  const handleImportFile = async (file: File) => {
    try {
      const text = await file.text();
      const parsed = importProgramPointsFromJSON(text);
      setImportPreview({ file, points: parsed });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      toast.error({ title: 'Nie udało się odczytać pliku', description: msg });
    }
  };

  const performImport = async () => {
    if (!importPreview) return;
    try {
      for (const pp of importPreview.points) {
        await db.programPoints.put({
          ...pp,
          id: pp.id || `pp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}`,
        });
      }
      toast.success({ title: 'Zaimportowano podstawę', description: `${importPreview.points.length} punktów` });
    } catch (err) {
      toast.error({ title: 'Nie udało się zaimportować', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setImportPreview(null);
      if (importRef.current) importRef.current.value = '';
    }
  };

  return (
    <div>
      {/* Filter card */}
      <div className="card mb-2">
        <div className="form-row mb-0">
          <div className="form-group mb-0 grow">
            <label htmlFor="pp-search-main" className="sr-only">Szukaj</label>
            <div className="search-input">
              <Search size={14} aria-hidden="true" />
              <input
                id="pp-search-main"
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Szukaj po kodzie, treści lub dziale…"
              />
            </div>
          </div>
          <div className="form-group mb-0 flex-200">
            <label htmlFor="pp-subject" className="sr-only">Przedmiot</label>
            <select id="pp-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
              <option value="">Wszystkie przedmioty</option>
              {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group mb-0 flex-200">
            <label htmlFor="pp-level" className="sr-only">Poziom</label>
            <select id="pp-level" value={level} onChange={(e) => setLevel(e.target.value as ProgramPoint['level'] | '')}>
              <option value="">Wszystkie poziomy</option>
              <option value="podstawowa">Szkoła podstawowa</option>
              <option value="ponadpodstawowa">Liceum / technikum</option>
            </select>
          </div>
          <div className="form-group mb-0 flex-160">
            <label htmlFor="pp-class-filter" className="sr-only">Klasa</label>
            <select id="pp-class-filter" value={cls} onChange={(e) => setCls(e.target.value)}>
              <option value="">Wszystkie klasy</option>
              {classes.map((c) => <option key={c} value={c}>Klasa {c}</option>)}
            </select>
          </div>
          <div className="form-group mb-0 flex-160">
            <label htmlFor="pp-zakres" className="sr-only">Zakres</label>
            <select id="pp-zakres" value={zakres} onChange={(e) => setZakres(e.target.value as '' | 'podstawowy' | 'rozszerzony')}>
              <option value="">Wszystkie zakresy</option>
              <option value="podstawowy">Podstawowy</option>
              <option value="rozszerzony">Rozszerzony</option>
            </select>
          </div>
        </div>
        <div className="flex justify-between items-center mt-1 wrap gap-1">
          <span className="text-sm text-muted">
            {filtered === undefined ? 'Ładowanie…' : <>Znaleziono <strong>{filtered.length}</strong> punktów</>}
          </span>
          <div className="flex gap-1 wrap">
            {hasFiltering && (
              <button type="button" className="btn btn-ghost btn-sm" onClick={clearFilters}>
                <X size={12} aria-hidden="true" /> Wyczyść filtry
              </button>
            )}
            <button
              type="button"
              className="btn btn-secondary btn-sm"
              onClick={() => setGroupByDzial(!groupByDzial)}
              aria-pressed={groupByDzial}
            >
              {groupByDzial ? <LayoutGrid size={14} aria-hidden="true" /> : <List size={14} aria-hidden="true" />}
              {groupByDzial ? 'Grupowane' : 'Tabela'}
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
            <button type="button" className="btn btn-primary btn-sm" onClick={openAdd}>
              <Plus size={14} aria-hidden="true" /> Dodaj punkt
            </button>
          </div>
        </div>
      </div>

      {/* Content */}
      {filtered === undefined ? (
        <div className="task-list" aria-busy="true">
          {[0, 1].map((i) => <div key={i} className="skeleton skeleton-card" />)}
        </div>
      ) : filtered.length === 0 ? (
        <div className="empty-state card">
          <GraduationCap size={48} aria-hidden="true" />
          <h3>Brak punktów</h3>
          <p>Spróbuj zmienić filtry, lub kliknij „Dodaj punkt", aby utworzyć nowy.</p>
        </div>
      ) : groupByDzial ? (
        grouped.map(([dzial, pts]) => (
          <div key={dzial} className="card mb-1">
            <div className="card-title card-title-md">
              {dzial}
              <small>{pts.length} {pts.length === 1 ? 'punkt' : pts.length < 5 ? 'punkty' : 'punktów'}</small>
            </div>
            <div className="task-list">
              {pts.map((pp) => (
                <div key={pp.id} className="list-row list-row-outlined">
                  <span className="badge badge-info">{pp.code}</span>
                  <span className="col-tight">
                    <span className="text-sm">{pp.description}</span>
                    <span className="text-faint text-xs">
                      Klasa {pp.class} · {pp.subject}{pp.zakres && ` · ${pp.zakres}`}
                    </span>
                  </span>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn btn-ghost btn-icon"
                      onClick={() => openEdit(pp)}
                      aria-label={`Edytuj punkt ${pp.code}`}
                    >
                      <Pencil size={14} aria-hidden="true" />
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-soft btn-icon"
                      onClick={() => setConfirmDelete(pp)}
                      aria-label={`Usuń punkt ${pp.code}`}
                    >
                      <Trash2 size={14} aria-hidden="true" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </div>
        ))
      ) : (
        <div className="card">
          <div className="param-table-wrap">
            <table className="param-table">
              <thead>
                <tr>
                  <th>Kod</th>
                  <th>Opis</th>
                  <th>Dział</th>
                  <th>Poziom</th>
                  <th>Klasa</th>
                  <th>Zakres</th>
                  <th>Przedmiot</th>
                  <th><span className="sr-only">Akcje</span></th>
                </tr>
              </thead>
              <tbody>
                {pagedSlice.map((pp) => (
                  <tr key={pp.id}>
                    <td><span className="badge badge-info">{pp.code}</span></td>
                    <td className="col-max-w-400">{pp.description}</td>
                    <td className="text-sm">{pp.dzialNazwa || '—'}</td>
                    <td className="text-sm">{pp.level}</td>
                    <td className="text-sm">{pp.class}</td>
                    <td className="text-sm">{pp.zakres || '—'}</td>
                    <td className="text-sm">{pp.subject}</td>
                    <td>
                      <div className="flex gap-1">
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          onClick={() => openEdit(pp)}
                          aria-label={`Edytuj punkt ${pp.code}`}
                        >
                          <Pencil size={14} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          className="btn btn-danger-soft btn-icon"
                          onClick={() => setConfirmDelete(pp)}
                          aria-label={`Usuń punkt ${pp.code}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}

      {filtered && filtered.length > 0 && (
        <Pagination
          page={page}
          pageSize={pageSize}
          total={filtered.length}
          onPageChange={setPage}
          onPageSizeChange={(s) => { setPageSize(s); setPage(1); }}
        />
      )}

      {/* Add / Edit drawer */}
      {drawer.kind !== 'closed' && (
        <>
          <div className="drawer-backdrop" onClick={closeDrawer} />
          <aside className="drawer" role="dialog" aria-modal="true" aria-label={drawer.kind === 'edit' ? 'Edytuj punkt podstawy' : 'Dodaj punkt podstawy'}>
            <div className="drawer-header">
              <h3>{drawer.kind === 'edit' ? 'Edycja punktu podstawy' : 'Nowy punkt podstawy'}</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={closeDrawer} aria-label="Zamknij">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
            <div className="drawer-body">
              <div className="form-group">
                <label htmlFor="np-code">Kod</label>
                <input id="np-code" value={form.code} onChange={(e) => setForm({ ...form, code: e.target.value })} placeholder="np. III.9" />
              </div>
              <div className="form-row">
                <div className="form-group mb-0">
                  <label htmlFor="np-level">Poziom</label>
                  <select id="np-level" value={form.level} onChange={(e) => setForm({ ...form, level: e.target.value as ProgramPoint['level'] })}>
                    <option value="podstawowa">Szkoła podstawowa</option>
                    <option value="ponadpodstawowa">Liceum / technikum</option>
                  </select>
                </div>
                <div className="form-group mb-0">
                  <label htmlFor="np-class">Klasa</label>
                  <input id="np-class" value={form.cls} onChange={(e) => setForm({ ...form, cls: e.target.value })} placeholder="np. 7" />
                </div>
                <div className="form-group mb-0">
                  <label htmlFor="np-subject">Przedmiot</label>
                  <input id="np-subject" value={form.subject} onChange={(e) => setForm({ ...form, subject: e.target.value })} />
                </div>
                <div className="form-group mb-0">
                  <label htmlFor="np-zakres">Zakres</label>
                  <select id="np-zakres" value={form.zakres} onChange={(e) => setForm({ ...form, zakres: e.target.value })}>
                    <option value="">Brak</option>
                    <option value="podstawowy">Podstawowy</option>
                    <option value="rozszerzony">Rozszerzony</option>
                  </select>
                </div>
              </div>
              <div className="form-row">
                <div className="form-group mb-0">
                  <label htmlFor="np-dzial-nr">Numer działu</label>
                  <input id="np-dzial-nr" value={form.dzialNumer} onChange={(e) => setForm({ ...form, dzialNumer: e.target.value })} placeholder="np. II" />
                </div>
                <div className="form-group mb-0">
                  <label htmlFor="np-dzial-nazwa">Nazwa działu</label>
                  <input id="np-dzial-nazwa" value={form.dzialNazwa} onChange={(e) => setForm({ ...form, dzialNazwa: e.target.value })} placeholder="np. Ruch i siły" />
                </div>
              </div>
              <div className="form-group mb-0">
                <label htmlFor="np-desc">Opis wymagania</label>
                <textarea id="np-desc" value={form.description} onChange={(e) => setForm({ ...form, description: e.target.value })} rows={4} placeholder="Uczeń potrafi…" />
              </div>
            </div>
            <div className="drawer-footer">
              <button type="button" className="btn btn-ghost" onClick={closeDrawer}>Anuluj</button>
              <button type="button" className="btn btn-primary" onClick={savePoint}>
                <Save size={14} aria-hidden="true" /> {drawer.kind === 'edit' ? 'Zapisz zmiany' : 'Zapisz punkt'}
              </button>
            </div>
          </aside>
        </>
      )}

      <ConfirmDialog
        open={!!confirmDelete}
        title="Usunąć punkt podstawy?"
        description={confirmDelete ? `${confirmDelete.code}: ${confirmDelete.description.slice(0, 100)}${confirmDelete.description.length > 100 ? '…' : ''}` : ''}
        confirmLabel="Usuń"
        destructive
        onConfirm={() => { if (confirmDelete) { void deletePoint(confirmDelete); setConfirmDelete(null); } }}
        onCancel={() => setConfirmDelete(null)}
      />

      <ConfirmDialog
        open={!!importPreview}
        title="Zaimportować podstawę programową?"
        description={importPreview
          ? `Plik „${importPreview.file.name}" zawiera ${importPreview.points.length} punktów. Istniejące rekordy o tym samym ID zostaną nadpisane.`
          : ''}
        confirmLabel="Importuj"
        cancelLabel="Anuluj"
        onConfirm={() => { void performImport(); }}
        onCancel={() => { setImportPreview(null); if (importRef.current) importRef.current.value = ''; }}
      />
    </div>
  );
}
