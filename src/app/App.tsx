import { lazy, Suspense, useCallback, useEffect, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  BookOpen,
  Pencil,
  FileText,
  Database,
  GraduationCap,
  Shuffle,
  Upload,
  Plus,
  Command,
  MoreHorizontal,
  FolderTree,
  Settings as SettingsIcon,
  Sparkles,
  ArrowDownToLine,
} from 'lucide-react'
// Lazy-loaded so each tab's module-level code only runs once that tab is
// first opened. Once mounted, the route stays in the DOM (display:none when
// inactive) so its state survives navigation — see KeepAlive below.
const TaskList = lazy(() =>
  import('@features/tasks').then((module) => ({ default: module.TaskList })),
)
const TaskEditor = lazy(() =>
  import('@features/tasks').then((module) => ({ default: module.TaskEditor })),
)
const TestGenerator = lazy(() =>
  import('@features/tests').then((module) => ({ default: module.TestGenerator })),
)
const ProgramBaseViewer = lazy(() =>
  import('@features/program-base').then((module) => ({ default: module.ProgramBaseViewer })),
)
const ExportImport = lazy(() =>
  import('@features/export-import').then((module) => ({ default: module.ExportImport })),
)
const RandomizerPanel = lazy(() =>
  import('@features/tasks').then((module) => ({ default: module.RandomizerPanel })),
)
const CategoryManager = lazy(() =>
  import('@features/categories').then((module) => ({ default: module.CategoryManager })),
)
const Settings = lazy(() =>
  import('@features/settings').then((module) => ({ default: module.Settings })),
)
const AITaskGenerator = lazy(() =>
  import('@features/ai-generation').then((module) => ({ default: module.AITaskGenerator })),
)
const DownloadPage = lazy(() =>
  import('@features/download').then((module) => ({ default: module.DownloadPage })),
)
import CommandPalette from '@app/components/CommandPalette'
import { downloadFile, exportTasksToJSON } from '@features/export-import'
import FontSizeToggle from '@shared/components/FontSizeToggle'
import ThemeToggle from '@shared/components/ThemeToggle'
import Toaster from '@shared/components/Toaster'
import db from '@shared/services/db'
import { useRoute, type Tab } from '@shared/hooks/useRoute'
import { useShortcuts, useSequenceShortcuts } from '@shared/hooks/useShortcuts'
import { useTheme } from '@shared/hooks/useTheme'
import { toast } from '@shared/hooks/useToast'
import { useUpdater } from '@shared/hooks/useUpdater'
import type { Task } from '@shared/types'

interface TabDef {
  id: Tab
  label: string
  icon: React.ReactNode
  group: 'library' | 'workspace'
  inBottom: boolean
}

const TABS: TabDef[] = [
  {
    id: 'tasks',
    label: 'Baza zadań',
    icon: <Database size={18} />,
    group: 'library',
    inBottom: true,
  },
  {
    id: 'program',
    label: 'Podstawa programowa',
    icon: <GraduationCap size={18} />,
    group: 'library',
    inBottom: true,
  },
  {
    id: 'categories',
    label: 'Kategorie',
    icon: <FolderTree size={18} />,
    group: 'library',
    inBottom: false,
  },
  {
    id: 'export',
    label: 'Eksport / Import',
    icon: <Upload size={18} />,
    group: 'library',
    inBottom: false,
  },
  {
    id: 'download',
    label: 'Pobierz',
    icon: <ArrowDownToLine size={18} />,
    group: 'library',
    inBottom: false,
  },
  {
    id: 'settings',
    label: 'Ustawienia',
    icon: <SettingsIcon size={18} />,
    group: 'library',
    inBottom: false,
  },
  { id: 'editor', label: 'Edytor', icon: <Pencil size={18} />, group: 'workspace', inBottom: true },
  {
    id: 'ai',
    label: 'Generuj AI',
    icon: <Sparkles size={18} />,
    group: 'workspace',
    inBottom: false,
  },
  {
    id: 'randomizer',
    label: 'Losowanie',
    icon: <Shuffle size={18} />,
    group: 'workspace',
    inBottom: false,
  },
  { id: 'tests', label: 'Testy', icon: <FileText size={18} />, group: 'workspace', inBottom: true },
]

const TAB_LABELS: Record<Tab, string> = TABS.reduce(
  (acc, t) => {
    acc[t.id] = t.label
    return acc
  },
  {} as Record<Tab, string>,
)

const navItemClass = (active: boolean) =>
  [
    'inline-flex cursor-pointer items-center gap-3 whitespace-nowrap border-0 border-b-2 px-5 py-4 font-body text-sm font-semibold transition-colors duration-fast ease-out',
    active
      ? 'border-accent bg-accent-soft text-accent'
      : 'border-transparent bg-transparent text-muted hover:bg-surface-2 hover:text-text',
  ].join(' ')

const bottomNavItemClass = (active: boolean) =>
  [
    'inline-flex cursor-pointer flex-col items-center justify-center gap-[2px] border-0 bg-transparent text-[calc(10px*var(--font-scale))] font-semibold',
    active ? 'text-accent' : 'text-muted',
  ].join(' ')

function RouteFallback() {
  return (
    <div
      className="flex flex-col items-center gap-3 px-6 py-8 text-center text-muted"
      aria-busy="true"
    >
      <div className="mb-4 h-[86px] w-full max-w-[480px] animate-shimmer rounded-sm bg-[linear-gradient(90deg,var(--surface-2)_25%,var(--surface-3)_37%,var(--surface-2)_63%)] bg-[length:400%_100%]" />
    </div>
  )
}

/** Wraps a route so it is mounted only once visited, and kept mounted
 *  (hidden via display:none) afterwards. This preserves the route's local
 *  state — scroll position, draft input, filters — across navigation.
 *
 *  Each route has its OWN Suspense boundary so the first-time lazy load of
 *  any one route does not unmount its already-mounted siblings (which would
 *  defeat the whole keep-alive). */
function KeepAlive({
  active,
  visited,
  children,
}: {
  active: boolean
  visited: boolean
  children: React.ReactNode
}) {
  if (!visited) return null
  return (
    <div className={active ? 'contents' : 'hidden'} aria-hidden={active ? undefined : true}>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </div>
  )
}

export default function App() {
  const { tab: activeTab, param: routeParam, setTab: setActiveTab, setRoute } = useRoute()
  const [editingTask, setEditingTask] = useState<Task | null>(null)
  const [refreshKey, setRefreshKey] = useState(0)
  // Tabs the user has visited at least once. We mount their components on
  // first activation and then keep them in the tree (hidden when inactive).
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([activeTab]))
  useEffect(() => {
    if (visited.has(activeTab)) return
    setVisited((prev) => {
      if (prev.has(activeTab)) return prev
      const next = new Set(prev)
      next.add(activeTab)
      return next
    })
  }, [activeTab, visited])

  const [paletteOpen, setPaletteOpen] = useState(false)
  const [moreOpen, setMoreOpen] = useState(false)
  const { cycle: cycleTheme } = useTheme()
  useUpdater()

  const tasksAll = useLiveQuery(() => db.tasks.toArray(), [])
  const testsAll = useLiveQuery(() => db.tests.toArray(), [])
  const programPointsAll = useLiveQuery(() => db.programPoints.toArray(), [])
  const categoriesAll = useLiveQuery(() => db.categories.toArray(), [])

  // Keep editingTask in sync with the URL param. Two scenarios this handles:
  //  - Deep link / refresh: URL says `#/edytor/<id>` but state is empty —
  //    look the task up in Dexie once it loads, then set it.
  //  - Browser back/forward to a different task — URL param changes, but
  //    editingTask still points to the previous one; resync.
  // We only react when the *id* (param) changes or the tab toggles into a
  // task-aware route, so Dexie's live updates to the same task do not
  // re-set editingTask (which would otherwise wipe in-progress edits via
  // TaskEditor's hydration effect).
  useEffect(() => {
    const usesParam = activeTab === 'editor' || activeTab === 'randomizer'
    if (!usesParam) return
    if (!routeParam) {
      if (editingTask) setEditingTask(null)
      return
    }
    if (editingTask?.id === routeParam) return
    // Wait until Dexie has actually loaded before deciding the id is bogus.
    if (!tasksAll) return
    const found = tasksAll.find((t) => t.id === routeParam) ?? null
    if (found) {
      setEditingTask(found)
      return
    }
    // ID in the URL points to nothing in the DB — likely a stale bookmark,
    // a deleted task, or a typo. Strip the bogus id (history.replaceState so
    // we don't add a junk entry) and tell the user; the route stays on the
    // same tab so the editor / randomizer just falls back to its empty state.
    toast.info({
      title: 'Nie znaleziono zadania',
      description: `ID „${routeParam}" nie istnieje w bazie. Otworzono pusty ekran.`,
    })
    setRoute(activeTab, undefined, { replace: true })
  }, [activeTab, routeParam, tasksAll, editingTask, setRoute])

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), [])

  const goNewTask = useCallback(() => {
    setEditingTask(null)
    setRoute('editor')
  }, [setRoute])

  const goEditTask = useCallback(
    (id: string) => {
      const t = (tasksAll || []).find((x) => x.id === id) || null
      setEditingTask(t)
      setRoute('editor', id)
    },
    [tasksAll, setRoute],
  )

  const goRandomize = useCallback(
    (task: Task) => {
      setEditingTask(task)
      setRoute('randomizer', task.id)
    },
    [setRoute],
  )

  const exportJson = useCallback(() => {
    const json = exportTasksToJSON(
      tasksAll || [],
      testsAll || [],
      programPointsAll || [],
      categoriesAll || [],
    )
    downloadFile(
      json,
      `taskforge_backup_${new Date().toISOString().slice(0, 10)}.json`,
      'application/json',
    )
    toast.success({
      title: 'Eksport gotowy',
      description: `${(tasksAll || []).length} zadań · ${(testsAll || []).length} testów · ${(programPointsAll || []).length} punktów podstawy · ${(categoriesAll || []).length} kategorii`,
    })
  }, [tasksAll, testsAll, programPointsAll, categoriesAll])

  useShortcuts([
    { combo: 'mod+k', allowInInputs: true, handler: () => setPaletteOpen((v) => !v) },
    { combo: 'mod+n', allowInInputs: false, handler: goNewTask },
    // The help shortcut "?" is produced by Shift+/ on most layouts. Per
    // spec, e.key should be "?", but some platforms (and Playwright)
    // report e.key="/" with shiftKey=true. Bind both forms so the shortcut
    // works regardless of how the browser surfaces the keypress.
    { combo: '?', allowInInputs: false, handler: () => setPaletteOpen(true) },
    { combo: 'shift+/', allowInInputs: false, handler: () => setPaletteOpen(true) },
  ])

  useSequenceShortcuts([
    { keys: ['g', 't'], handler: () => setActiveTab('tasks') },
    { keys: ['g', 'e'], handler: () => setActiveTab('editor') },
    { keys: ['g', 'r'], handler: () => setActiveTab('randomizer') },
    { keys: ['g', 's'], handler: () => setActiveTab('tests') },
    { keys: ['g', 'p'], handler: () => setActiveTab('program') },
    { keys: ['g', 'c'], handler: () => setActiveTab('categories') },
    { keys: ['g', 'a'], handler: () => setActiveTab('ai') },
    { keys: ['g', 'u'], handler: () => setActiveTab('settings') },
    { keys: ['g', 'x'], handler: () => setActiveTab('export') },
  ])

  useEffect(() => {
    document.title = `${TAB_LABELS[activeTab]} · TaskForge`
  }, [activeTab])

  const libraryTabs = TABS.filter((t) => t.group === 'library')
  const workspaceTabs = TABS.filter((t) => t.group === 'workspace')
  const bottomTabs = TABS.filter((t) => t.inBottom)
  const moreTabs = TABS.filter((t) => !t.inBottom)

  return (
    <div className="flex min-h-screen flex-col">
      <a
        href="#main"
        className="absolute -top-[100px] left-3 z-[1000] rounded-sm border border-border-strong bg-surface px-5 py-3 font-semibold text-text transition-[top] duration-base ease-out focus:top-3 focus:no-underline"
      >
        Przejdź do treści
      </a>

      <header className="flex min-h-[var(--header-height)] items-center justify-between gap-4 border-b border-border bg-surface px-6 py-4 mobile:px-[max(var(--space-4),env(safe-area-inset-left))] mobile:py-3 mobile:pt-[max(var(--space-3),env(safe-area-inset-top))]">
        <div className="flex min-w-0 items-center gap-4">
          <BookOpen size={26} className="shrink-0 text-accent" aria-hidden="true" />
          <div>
            <h1 className="font-display text-xl font-bold leading-[1.1] text-text mobile:text-lg">
              TaskForge
            </h1>
            <span className="text-xs font-semibold uppercase tracking-[0.08em] text-muted mobile:hidden">
              Parametryzowane zadania edukacyjne
            </span>
          </div>
        </div>
        <div className="flex items-center gap-3">
          <a
            href="https://github.com/jash90/taskforge/releases/latest"
            target="_blank"
            rel="noopener noreferrer"
            className="btn btn-ghost btn-sm"
            aria-label="Pobierz aplikację"
            title="Pobierz instalator"
          >
            <ArrowDownToLine size={16} />
          </a>
          <button
            type="button"
            className="inline-flex cursor-pointer items-center gap-2 rounded-sm border border-border bg-surface-2 px-3 py-2 text-xs font-semibold text-muted transition-colors duration-fast ease-out hover:bg-surface-3 hover:text-text [@media(hover:none)]:hidden"
            onClick={() => setPaletteOpen(true)}
            aria-label="Otwórz paletę poleceń"
          >
            <Command size={12} aria-hidden="true" />
            <kbd>K</kbd>
          </button>
          <FontSizeToggle />
          <ThemeToggle />
          <button
            type="button"
            className="btn btn-primary"
            onClick={goNewTask}
            aria-label="Nowe zadanie"
          >
            <Plus size={16} aria-hidden="true" /> <span className="btn-label">Nowe zadanie</span>
          </button>
        </div>
      </header>

      <nav
        className="flex items-stretch gap-1 overflow-x-auto border-b border-border bg-surface px-6 [scrollbar-width:none] [&::-webkit-scrollbar]:hidden mobile:hidden"
        aria-label="Główna nawigacja"
      >
        <div className="flex gap-[2px]">
          {libraryTabs.map((t) => (
            <button
              key={t.id}
              className={navItemClass(activeTab === t.id)}
              onClick={() => setActiveTab(t.id)}
              aria-current={activeTab === t.id ? 'page' : undefined}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="mx-3 my-3 w-px shrink-0 bg-border" aria-hidden="true" />
        <div className="flex gap-[2px]">
          {workspaceTabs.map((t) => (
            <button
              key={t.id}
              className={navItemClass(activeTab === t.id)}
              onClick={() => setActiveTab(t.id)}
              aria-current={activeTab === t.id ? 'page' : undefined}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main
        id="main"
        className="flex-1 [overflow-x:clip] scroll-smooth p-6 mobile:p-4"
        key={refreshKey}
      >
        <KeepAlive active={activeTab === 'tasks'} visited={visited.has('tasks')}>
          <TaskList
            onEdit={(task) => goEditTask(task.id)}
            onRandomize={goRandomize}
            onNew={goNewTask}
          />
        </KeepAlive>
        <KeepAlive active={activeTab === 'editor'} visited={visited.has('editor')}>
          <TaskEditor
            task={editingTask}
            onSaved={() => {
              refresh()
              setRoute('tasks')
              setEditingTask(null)
            }}
            onCancel={() => {
              setRoute('tasks')
              setEditingTask(null)
            }}
          />
        </KeepAlive>
        <KeepAlive active={activeTab === 'randomizer'} visited={visited.has('randomizer')}>
          <RandomizerPanel
            task={editingTask}
            onClose={() => {
              setRoute('tasks')
              setEditingTask(null)
            }}
          />
        </KeepAlive>
        <KeepAlive active={activeTab === 'tests'} visited={visited.has('tests')}>
          <TestGenerator />
        </KeepAlive>
        <KeepAlive active={activeTab === 'program'} visited={visited.has('program')}>
          <ProgramBaseViewer />
        </KeepAlive>
        <KeepAlive active={activeTab === 'categories'} visited={visited.has('categories')}>
          <CategoryManager />
        </KeepAlive>
        <KeepAlive active={activeTab === 'ai'} visited={visited.has('ai')}>
          <AITaskGenerator onOpenSettings={() => setActiveTab('settings')} />
        </KeepAlive>
        <KeepAlive active={activeTab === 'download'} visited={visited.has('download')}>
          <DownloadPage />
        </KeepAlive>
        <KeepAlive active={activeTab === 'settings'} visited={visited.has('settings')}>
          <Settings />
        </KeepAlive>
        <KeepAlive active={activeTab === 'export'} visited={visited.has('export')}>
          <ExportImport onImport={refresh} />
        </KeepAlive>
      </main>

      <nav
        className="sticky bottom-0 z-30 [display:none] border-t border-border bg-surface pb-[env(safe-area-inset-bottom,0)] mobile:!block"
        aria-label="Nawigacja mobilna"
      >
        <div className="flex h-[var(--bottom-nav-height)] [&>*]:min-w-0 [&>*]:flex-1">
          {bottomTabs.map((t) => (
            <button
              key={t.id}
              className={bottomNavItemClass(activeTab === t.id)}
              onClick={() => setActiveTab(t.id)}
              aria-current={activeTab === t.id ? 'page' : undefined}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
          <button
            type="button"
            className={bottomNavItemClass(false)}
            onClick={() => setMoreOpen(true)}
            aria-label="Więcej zakładek"
          >
            <MoreHorizontal size={18} aria-hidden="true" />
            <span>Więcej</span>
          </button>
        </div>
      </nav>

      {moreOpen && (
        <>
          <div
            className="fixed inset-0 z-[90] animate-overlay-in bg-[oklch(0.180_0.012_55_/_0.35)]"
            onClick={() => setMoreOpen(false)}
          />
          <div
            className="fixed inset-x-0 bottom-0 z-[91] flex max-h-[85vh] animate-sheet-in flex-col rounded-t-lg bg-surface pb-[env(safe-area-inset-bottom,0)] shadow-lg"
            role="dialog"
            aria-modal="true"
            aria-label="Więcej zakładek"
          >
            <div
              className="mx-auto my-2 h-1 w-9 rounded-[2px] bg-border-strong"
              aria-hidden="true"
            />
            <div className="flex items-center justify-between px-5 pb-4 pt-3">
              <h3 className="mb-0 flex items-center gap-3 font-display text-lg font-semibold tracking-[-0.005em]">
                Więcej
              </h3>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={() => setMoreOpen(false)}
              >
                Zamknij
              </button>
            </div>
            <div className="overflow-y-auto px-5 pb-5">
              {moreTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="mb-2 flex w-full cursor-pointer items-center gap-4 rounded-sm border border-border bg-surface px-4 py-3 transition-colors duration-fast ease-out hover:border-border-strong hover:bg-surface-2 mobile:gap-3 mobile:px-3 mobile:py-2"
                  onClick={() => {
                    setActiveTab(t.id)
                    setMoreOpen(false)
                  }}
                >
                  {t.icon}
                  <span className="font-semibold text-left">{t.label}</span>
                  <span aria-hidden="true">→</span>
                </button>
              ))}
            </div>
          </div>
        </>
      )}

      <CommandPalette
        open={paletteOpen}
        onClose={() => setPaletteOpen(false)}
        onNavigate={(tab) => setActiveTab(tab)}
        onNewTask={goNewTask}
        onEditTask={goEditTask}
        onExportJson={exportJson}
        onCycleTheme={cycleTheme}
      />

      <Toaster />
    </div>
  )
}
