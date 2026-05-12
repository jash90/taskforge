import { useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Database,
  Pencil,
  Shuffle,
  FileText,
  GraduationCap,
  Upload,
  Plus,
  Sun,
  Download,
  BookOpen,
  FolderTree,
  Sparkles,
  Settings as SettingsIcon,
} from 'lucide-react'
import db from '@shared/services/db'
import type { Task } from '@shared/types'

export interface PaletteCommand {
  id: string
  label: string
  hint?: string
  group: 'Nawigacja' | 'Akcje' | 'Ostatnie zadania'
  icon: React.ReactNode
  run: () => void
}

interface Props {
  open: boolean
  onClose: () => void
  onNavigate: (
    tab:
      | 'tasks'
      | 'editor'
      | 'randomizer'
      | 'tests'
      | 'program'
      | 'categories'
      | 'export'
      | 'ai'
      | 'settings',
  ) => void
  onNewTask: () => void
  onEditTask: (taskId: string) => void
  onExportJson: () => void
  onCycleTheme: () => void
}

const fuzzyScore = (q: string, label: string): number => {
  if (!q) return 1
  const ql = q.toLowerCase()
  const ll = label.toLowerCase()
  if (ll.includes(ql)) return 2 + (ll.startsWith(ql) ? 1 : 0)
  // letter-by-letter fuzzy
  let li = 0
  for (const ch of ql) {
    const found = ll.indexOf(ch, li)
    if (found === -1) return 0
    li = found + 1
  }
  return 1
}

export default function CommandPalette({
  open,
  onClose,
  onNavigate,
  onNewTask,
  onEditTask,
  onExportJson,
  onCycleTheme,
}: Props) {
  const recentTasks: Task[] | undefined = useLiveQuery(async () => {
    const all = await db.tasks.toArray()
    return all.sort((a, b) => b.updatedAt - a.updatedAt).slice(0, 8)
  }, [open])

  const [query, setQuery] = useState('')
  const [activeIdx, setActiveIdx] = useState(0)
  const inputRef = useRef<HTMLInputElement>(null)
  const listRef = useRef<HTMLUListElement>(null)

  useEffect(() => {
    if (open) {
      setQuery('')
      setActiveIdx(0)
      requestAnimationFrame(() => inputRef.current?.focus())
    }
  }, [open])

  const allCommands: PaletteCommand[] = useMemo(() => {
    const nav: PaletteCommand[] = [
      {
        id: 'nav-tasks',
        group: 'Nawigacja',
        label: 'Przejdź do bazy zadań',
        hint: 'g t',
        icon: <Database size={16} />,
        run: () => onNavigate('tasks'),
      },
      {
        id: 'nav-editor',
        group: 'Nawigacja',
        label: 'Przejdź do edytora',
        hint: 'g e',
        icon: <Pencil size={16} />,
        run: () => onNavigate('editor'),
      },
      {
        id: 'nav-rand',
        group: 'Nawigacja',
        label: 'Przejdź do losowania',
        hint: 'g r',
        icon: <Shuffle size={16} />,
        run: () => onNavigate('randomizer'),
      },
      {
        id: 'nav-tests',
        group: 'Nawigacja',
        label: 'Przejdź do testów',
        hint: 'g s',
        icon: <FileText size={16} />,
        run: () => onNavigate('tests'),
      },
      {
        id: 'nav-program',
        group: 'Nawigacja',
        label: 'Przejdź do podstawy programowej',
        hint: 'g p',
        icon: <GraduationCap size={16} />,
        run: () => onNavigate('program'),
      },
      {
        id: 'nav-categories',
        group: 'Nawigacja',
        label: 'Przejdź do kategorii',
        hint: 'g c',
        icon: <FolderTree size={16} />,
        run: () => onNavigate('categories'),
      },
      {
        id: 'nav-ai',
        group: 'Nawigacja',
        label: 'Generuj zadania AI',
        hint: 'g a',
        icon: <Sparkles size={16} />,
        run: () => onNavigate('ai'),
      },
      {
        id: 'nav-export',
        group: 'Nawigacja',
        label: 'Przejdź do eksport / import',
        hint: 'g x',
        icon: <Upload size={16} />,
        run: () => onNavigate('export'),
      },
      {
        id: 'nav-settings',
        group: 'Nawigacja',
        label: 'Ustawienia',
        hint: 'g u',
        icon: <SettingsIcon size={16} />,
        run: () => onNavigate('settings'),
      },
    ]
    const acts: PaletteCommand[] = [
      {
        id: 'act-new',
        group: 'Akcje',
        label: 'Nowe zadanie',
        hint: '⌘N',
        icon: <Plus size={16} />,
        run: onNewTask,
      },
      {
        id: 'act-export',
        group: 'Akcje',
        label: 'Eksportuj bazę do JSON',
        icon: <Download size={16} />,
        run: onExportJson,
      },
      {
        id: 'act-theme',
        group: 'Akcje',
        label: 'Przełącz motyw (jasny / ciemny / system)',
        icon: <Sun size={16} />,
        run: onCycleTheme,
      },
    ]
    const recent: PaletteCommand[] = (recentTasks || []).slice(0, 6).map((t) => ({
      id: `task-${t.id}`,
      group: 'Ostatnie zadania',
      label: t.title || '(bez tytułu)',
      hint: `${t.subject} · ${t.level} ${t.class}`,
      icon: <BookOpen size={16} />,
      run: () => onEditTask(t.id),
    }))
    return [...nav, ...acts, ...recent]
  }, [recentTasks, onNavigate, onNewTask, onEditTask, onExportJson, onCycleTheme])

  const filtered = useMemo(() => {
    if (!query.trim()) return allCommands
    return allCommands
      .map((c) => ({ c, score: fuzzyScore(query.trim(), c.label) }))
      .filter((x) => x.score > 0)
      .sort((a, b) => b.score - a.score)
      .map((x) => x.c)
  }, [allCommands, query])

  useEffect(() => {
    setActiveIdx(0)
  }, [query])

  useEffect(() => {
    if (!open) return
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault()
        onClose()
        return
      }
      if (e.key === 'ArrowDown') {
        e.preventDefault()
        setActiveIdx((i) => Math.min(i + 1, filtered.length - 1))
        return
      }
      if (e.key === 'ArrowUp') {
        e.preventDefault()
        setActiveIdx((i) => Math.max(i - 1, 0))
        return
      }
      if (e.key === 'Enter') {
        e.preventDefault()
        const cmd = filtered[activeIdx]
        if (cmd) {
          cmd.run()
          onClose()
        }
      }
    }
    window.addEventListener('keydown', onKey, true)
    return () => window.removeEventListener('keydown', onKey, true)
  }, [open, filtered, activeIdx, onClose])

  useEffect(() => {
    if (!open) return
    const item = listRef.current?.querySelector<HTMLElement>(`[data-idx="${activeIdx}"]`)
    item?.scrollIntoView({ block: 'nearest' })
  }, [activeIdx, open])

  if (!open) return null

  let lastGroup = ''
  let renderIdx = -1

  return (
    <div className="palette-backdrop" onMouseDown={onClose} role="presentation">
      <div
        className="palette"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-label="Paleta poleceń"
      >
        <input
          ref={inputRef}
          className="palette-input"
          placeholder="Szukaj poleceń lub zadań…"
          value={query}
          onChange={(e) => setQuery(e.target.value)}
          aria-autocomplete="list"
        />
        {filtered.length === 0 ? (
          <div className="palette-empty">Brak wyników dla „{query}"</div>
        ) : (
          <ul ref={listRef} className="palette-list" role="listbox">
            {filtered.map((c) => {
              renderIdx++
              const isNewGroup = c.group !== lastGroup
              lastGroup = c.group
              const idx = renderIdx
              return (
                <div key={c.id}>
                  {isNewGroup && (
                    <li className="palette-section" role="presentation">
                      {c.group}
                    </li>
                  )}
                  <li
                    role="option"
                    aria-selected={idx === activeIdx}
                    data-idx={idx}
                    className={`palette-item ${idx === activeIdx ? 'active' : ''}`}
                    onMouseEnter={() => setActiveIdx(idx)}
                    onClick={() => {
                      c.run()
                      onClose()
                    }}
                  >
                    {c.icon}
                    <span className="palette-item-label">{c.label}</span>
                    {c.hint && <span className="palette-item-hint">{c.hint}</span>}
                  </li>
                </div>
              )
            })}
          </ul>
        )}
        <div className="palette-footer">
          <span>
            <kbd>↑</kbd> <kbd>↓</kbd> nawigacja
          </span>
          <span>
            <kbd>Enter</kbd> wybierz · <kbd>Esc</kbd> zamknij
          </span>
        </div>
      </div>
    </div>
  )
}
