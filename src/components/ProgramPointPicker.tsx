import { useMemo, useState } from 'react';
import { Search, X } from 'lucide-react';
import type { ProgramPoint, SchoolLevel } from '../types';

interface Props {
  programPoints: ProgramPoint[];
  selectedIds: Set<string>;
  onToggle: (id: string) => void;
  onClear: () => void;
  /** Optional: number of tasks per program-point (so the picker can show usage hints). */
  taskCountByPpId?: Map<string, number>;
}

const LEVEL_LABEL: Record<SchoolLevel, string> = {
  podstawowa: 'Szkoła podstawowa',
  liceum: 'Liceum',
  technikum: 'Technikum',
};

const LEVEL_SHORT: Record<SchoolLevel, string> = {
  podstawowa: 'SP',
  liceum: 'LO',
  technikum: 'TECH',
};

export default function ProgramPointPicker({
  programPoints, selectedIds, onToggle, onClear, taskCountByPpId,
}: Props) {
  const [query, setQuery] = useState('');
  const [subject, setSubject] = useState<string>('');
  const [level, setLevel] = useState<'' | SchoolLevel>('');
  const [cls, setCls] = useState<string>('');
  const [onlyWithTasks, setOnlyWithTasks] = useState(false);

  const subjects = useMemo(
    () => Array.from(new Set(programPoints.map((p) => p.subject))).sort(),
    [programPoints],
  );
  const classes = useMemo(
    () => Array.from(new Set(programPoints.map((p) => p.class))).sort(),
    [programPoints],
  );

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    return programPoints.filter((p) => {
      if (subject && p.subject !== subject) return false;
      if (level && p.level !== level) return false;
      if (cls && p.class !== cls) return false;
      if (onlyWithTasks && (!taskCountByPpId || (taskCountByPpId.get(p.id) ?? 0) === 0)) return false;
      if (!q) return true;
      return (
        p.code.toLowerCase().includes(q) ||
        p.description.toLowerCase().includes(q) ||
        (p.dzialNazwa || '').toLowerCase().includes(q) ||
        p.subject.toLowerCase().includes(q)
      );
    });
  }, [programPoints, query, subject, level, cls, onlyWithTasks, taskCountByPpId]);

  // Group by level → klasa → dział for clarity when scope is wide
  const grouped = useMemo(() => {
    const acc: Record<string, ProgramPoint[]> = {};
    for (const p of filtered) {
      const dzial = p.dzialNumer ? `${p.dzialNumer}. ${p.dzialNazwa || 'Inne'}` : 'Inne';
      const key = `${LEVEL_LABEL[p.level]} · klasa ${p.class}${p.zakres ? ` · ${p.zakres}` : ''} · ${dzial}`;
      (acc[key] ??= []).push(p);
    }
    return Object.entries(acc);
  }, [filtered]);

  const selectedDetailed = useMemo(() => {
    if (selectedIds.size === 0) return [];
    return programPoints.filter((p) => selectedIds.has(p.id));
  }, [programPoints, selectedIds]);

  return (
    <div>
      <div className="form-row">
        <div className="form-group mb-0 grow">
          <label htmlFor="ppp-search" className="sr-only">Szukaj</label>
          <div className="search-input">
            <Search size={14} aria-hidden="true" />
            <input
              id="ppp-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kod, opis, dział lub przedmiot…"
              autoFocus
            />
          </div>
        </div>
        <div className="form-group mb-0" style={{ flex: '0 1 180px' }}>
          <label htmlFor="ppp-subject" className="sr-only">Przedmiot</label>
          <select id="ppp-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
            <option value="">Wszystkie przedmioty</option>
            {subjects.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </div>
        <div className="form-group mb-0" style={{ flex: '0 1 180px' }}>
          <label htmlFor="ppp-level" className="sr-only">Poziom</label>
          <select id="ppp-level" value={level} onChange={(e) => setLevel(e.target.value as '' | SchoolLevel)}>
            <option value="">Wszystkie poziomy</option>
            <option value="podstawowa">Szkoła podstawowa</option>
            <option value="liceum">Liceum</option>
            <option value="technikum">Technikum</option>
          </select>
        </div>
        <div className="form-group mb-0" style={{ flex: '0 1 140px' }}>
          <label htmlFor="ppp-class" className="sr-only">Klasa</label>
          <select id="ppp-class" value={cls} onChange={(e) => setCls(e.target.value)}>
            <option value="">Wszystkie klasy</option>
            {classes.map((c) => <option key={c} value={c}>Klasa {c}</option>)}
          </select>
        </div>
      </div>

      {taskCountByPpId && (
        <label
          className="flex items-center gap-1 mb-0"
          style={{ textTransform: 'none', letterSpacing: 0, fontSize: 'var(--text-sm)', color: 'var(--text-muted)' }}
        >
          <input
            type="checkbox"
            checked={onlyWithTasks}
            onChange={(e) => setOnlyWithTasks(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Pokaż tylko punkty z przypisanymi zadaniami
        </label>
      )}

      {/* Selected chips */}
      {selectedIds.size > 0 && (
        <div
          className="card card-tight"
          style={{ background: 'var(--accent-soft)', borderColor: 'var(--accent)', marginTop: 'var(--space-3)' }}
        >
          <div className="flex justify-between items-center mb-1">
            <strong className="text-sm" style={{ color: 'var(--accent)' }}>
              Wybrane filtry ({selectedIds.size})
            </strong>
            <button type="button" className="btn btn-ghost btn-sm" onClick={onClear}>
              <X size={12} aria-hidden="true" /> Wyczyść
            </button>
          </div>
          <div className="flex gap-1 wrap">
            {selectedDetailed.map((pp) => (
              <button
                key={pp.id}
                type="button"
                className="badge badge-primary"
                style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', border: 'none' }}
                onClick={() => onToggle(pp.id)}
                title={pp.description}
                aria-label={`Usuń filtr ${pp.code}`}
              >
                {pp.code}
                <X size={10} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      <div className="text-sm text-muted" style={{ marginTop: 'var(--space-3)', marginBottom: 'var(--space-2)' }}>
        {filtered.length} {filtered.length === 1 ? 'punkt' : (filtered.length % 10 >= 2 && filtered.length % 10 <= 4 && (filtered.length % 100 < 12 || filtered.length % 100 > 14)) ? 'punkty' : 'punktów'}
      </div>

      {filtered.length === 0 && (
        <p className="text-muted text-sm">Brak punktów dla wybranych filtrów.</p>
      )}

      <div style={{ maxHeight: 'min(60vh, 480px)', overflowY: 'auto', paddingRight: 4 }}>
        {grouped.map(([groupKey, pts]) => (
          <div key={groupKey} className="mb-1">
            <div className="text-faint text-xs font-semibold" style={{ marginTop: 12, marginBottom: 4, textTransform: 'uppercase', letterSpacing: '0.04em' }}>
              {groupKey}
            </div>
            {pts.map((pp) => {
              const checked = selectedIds.has(pp.id);
              const taskCount = taskCountByPpId?.get(pp.id) ?? 0;
              return (
                <label key={pp.id} className={`list-row ${checked ? 'selected' : ''}`} style={{ marginBottom: 4 }}>
                  <input
                    type="checkbox"
                    checked={checked}
                    onChange={() => onToggle(pp.id)}
                    style={{ width: 16, height: 16 }}
                  />
                  <span style={{ display: 'flex', flexDirection: 'column', gap: 2, minWidth: 0 }}>
                    <span className="flex items-center gap-1 wrap">
                      <span className="badge badge-info">{pp.code}</span>
                      <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                        {LEVEL_SHORT[pp.level]} · {pp.class}{pp.zakres ? ` · ${pp.zakres}` : ''}
                      </span>
                      <span className="text-sm">{pp.description}</span>
                    </span>
                  </span>
                  <span aria-hidden="true" className="text-faint text-xs">
                    {taskCount > 0 ? `${taskCount} ${taskCount === 1 ? 'zadanie' : taskCount < 5 ? 'zadania' : 'zadań'}` : ''}
                  </span>
                </label>
              );
            })}
          </div>
        ))}
      </div>
    </div>
  );
}
