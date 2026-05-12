import { useMemo, useState } from 'react';
import { Search, X, Globe } from 'lucide-react';
import type { ProgramPoint, SchoolLevel } from '../../types';

interface Props {
  level: SchoolLevel;
  cls: string;
  selectedIds: string[];
  programPoints: ProgramPoint[] | undefined;
  onToggle: (id: string) => void;
  onLevelChange: (lvl: SchoolLevel) => void;
  onClassChange: (cls: string) => void;
}

const LEVEL_LABEL: Record<SchoolLevel, string> = {
  podstawowa: 'Szkoła podstawowa',
  ponadpodstawowa: 'Liceum / technikum',
};

const LEVEL_SHORT: Record<SchoolLevel, string> = {
  podstawowa: 'SP',
  ponadpodstawowa: 'LO/T',
};

export default function SectionProgramBase({
  level, cls, selectedIds, programPoints, onToggle, onLevelChange, onClassChange,
}: Props) {
  const [query, setQuery] = useState('');
  const [allLevels, setAllLevels] = useState(false);

  const list = useMemo(() => {
    const all = programPoints || [];
    const scoped = allLevels ? all : all.filter((p) => p.level === level && p.class === cls);
    if (!query.trim()) return scoped;
    const q = query.toLowerCase();
    return scoped.filter((p) =>
      p.code.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.dzialNazwa || '').toLowerCase().includes(q) ||
      p.subject.toLowerCase().includes(q),
    );
  }, [programPoints, level, cls, query, allLevels]);

  // Hint: when query has 0 in-scope results but matches in other levels.
  const hasMatchesOutsideScope = useMemo(() => {
    if (allLevels || !query.trim()) return false;
    const inScope = (programPoints || []).filter((p) => p.level === level && p.class === cls);
    const q = query.toLowerCase();
    const inScopeMatches = inScope.filter((p) =>
      p.code.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.dzialNazwa || '').toLowerCase().includes(q),
    );
    if (inScopeMatches.length > 0) return false;
    return (programPoints || []).some((p) =>
      p.code.toLowerCase().includes(q) ||
      p.description.toLowerCase().includes(q) ||
      (p.dzialNazwa || '').toLowerCase().includes(q),
    );
  }, [programPoints, level, cls, query, allLevels]);

  // Group results
  const grouped = useMemo(() => {
    const acc: Record<string, ProgramPoint[]> = {};
    for (const p of list) {
      const groupKey = allLevels
        ? `${LEVEL_LABEL[p.level]} · klasa ${p.class}${p.dzialNazwa ? ` · ${p.dzialNumer ? p.dzialNumer + '. ' : ''}${p.dzialNazwa}` : ''}`
        : (p.dzialNumer ? `${p.dzialNumer}. ${p.dzialNazwa || 'Inne'}` : 'Inne');
      (acc[groupKey] ??= []).push(p);
    }
    return Object.entries(acc);
  }, [list, allLevels]);

  // Selected points with details, even if not in current view
  const selectedDetailed = useMemo(() => {
    if (!programPoints || selectedIds.length === 0) return [];
    const idSet = new Set(selectedIds);
    return programPoints.filter((p) => idSet.has(p.id));
  }, [programPoints, selectedIds]);

  const selectedCount = selectedIds.length;

  return (
    <div>
      <div className="form-row pp-controls">
        <div className="level-toggle" role="group" aria-label="Poziom edukacyjny">
          {(['podstawowa', 'ponadpodstawowa'] as const).map((lvl) => (
            <button
              key={lvl}
              type="button"
              className={`btn btn-sm ${level === lvl ? 'btn-primary' : 'btn-secondary'}`}
              onClick={() => onLevelChange(lvl)}
              aria-pressed={level === lvl}
            >
              {LEVEL_LABEL[lvl]}
            </button>
          ))}
        </div>
        <div className="form-group mb-0 pp-class-field">
          <label htmlFor="pp-class">Klasa</label>
          <input id="pp-class" value={cls} onChange={(e) => onClassChange(e.target.value)} placeholder="np. 7" />
        </div>
        <div className="form-group mb-0 grow pp-search-field">
          <label htmlFor="pp-search">Szukaj</label>
          <div className="search-input">
            <Search size={14} aria-hidden="true" />
            <input
              id="pp-search"
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Kod, opis, dział lub przedmiot…"
            />
          </div>
        </div>
      </div>

      {/* Selected pinned summary */}
      {selectedCount > 0 && (
        <div
          className="card card-tight"
          style={{
            background: 'var(--accent-soft)',
            borderColor: 'var(--accent)',
            marginTop: 'var(--space-3)',
            marginBottom: 'var(--space-3)',
          }}
        >
          <div className="flex justify-between items-center mb-1">
            <strong className="text-sm" style={{ color: 'var(--accent)' }}>
              Wybrane punkty ({selectedCount})
            </strong>
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={() => selectedIds.forEach(onToggle)}
              aria-label="Usuń wszystkie wybrane"
            >
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
                aria-label={`Usuń wybór punktu ${pp.code}`}
                title={pp.description}
              >
                {pp.code}
                <X size={10} aria-hidden="true" />
              </button>
            ))}
          </div>
        </div>
      )}

      {/* Cross-level toggle + counts */}
      <div className="flex justify-between items-center" style={{ flexWrap: 'wrap', gap: 'var(--space-3)', marginBottom: 'var(--space-3)' }}>
        <span className="text-sm text-muted">
          {list.length} {list.length === 1 ? 'dostępny punkt' : list.length < 5 ? 'dostępne punkty' : 'dostępnych punktów'}
          {!allLevels && <> · {LEVEL_LABEL[level]} · klasa {cls || '—'}</>}
        </span>
        <button
          type="button"
          className={`btn btn-sm ${allLevels ? 'btn-primary' : 'btn-secondary'}`}
          onClick={() => setAllLevels(!allLevels)}
          aria-pressed={allLevels}
        >
          <Globe size={12} aria-hidden="true" />
          {allLevels ? 'Wszystkie klasy i poziomy' : 'Tylko bieżąca klasa'}
        </button>
      </div>

      {hasMatchesOutsideScope && (
        <div
          className="text-sm"
          style={{
            background: 'var(--info-bg)',
            color: 'var(--info)',
            padding: 'var(--space-3) var(--space-4)',
            borderRadius: 'var(--radius-sm)',
            marginBottom: 'var(--space-3)',
          }}
          role="status"
        >
          Brak wyników w bieżącej klasie. Punkty pasujące do „{query}" istnieją w innych klasach lub poziomach.
          {' '}
          <button
            type="button"
            onClick={() => setAllLevels(true)}
            style={{ background: 'transparent', border: 'none', color: 'var(--info)', textDecoration: 'underline', cursor: 'pointer', font: 'inherit', padding: 0 }}
          >
            Pokaż wszystkie
          </button>
        </div>
      )}

      {list.length === 0 && !hasMatchesOutsideScope && (
        <p className="text-muted text-sm">
          {query ? `Brak punktów dla „${query}".` : 'Brak punktów dla tego poziomu i klasy.'}
        </p>
      )}

      {grouped.map(([groupKey, pts]) => (
        <div key={groupKey} className="mb-1">
          <div className="text-sm font-semibold text-muted" style={{ marginTop: 12, marginBottom: 6 }}>{groupKey}</div>
          {pts.map((pp) => {
            const checked = selectedIds.includes(pp.id);
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
                    {allLevels && (
                      <span className="badge" style={{ background: 'var(--surface-2)', color: 'var(--text-muted)' }}>
                        {LEVEL_SHORT[pp.level]} · {pp.class}
                      </span>
                    )}
                    <span className="text-sm">{pp.description}</span>
                  </span>
                  {pp.zakres && <span className="text-faint text-xs">{pp.zakres}</span>}
                </span>
              </label>
            );
          })}
        </div>
      ))}
    </div>
  );
}
