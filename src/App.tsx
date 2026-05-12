import { lazy, Suspense, useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen, Pencil, FileText, Database, GraduationCap,
  Shuffle, Upload, Plus, Command, MoreHorizontal, FolderTree,
  Settings as SettingsIcon, Sparkles,
} from 'lucide-react';
// Lazy-loaded so each tab's module-level code only runs once that tab is
// first opened. Once mounted, the route stays in the DOM (display:none when
// inactive) so its state survives navigation — see KeepAlive below.
const TaskList         = lazy(() => import('./components/TaskList'));
const TaskEditor       = lazy(() => import('./components/TaskEditor'));
const TestGenerator    = lazy(() => import('./components/TestGenerator'));
const ProgramBaseViewer = lazy(() => import('./components/ProgramBaseViewer'));
const ExportImport     = lazy(() => import('./components/ExportImport'));
const RandomizerPanel  = lazy(() => import('./components/RandomizerPanel'));
const CategoryManager  = lazy(() => import('./components/CategoryManager'));
const Settings         = lazy(() => import('./components/Settings'));
const AITaskGenerator  = lazy(() => import('./components/AITaskGenerator'));
import ThemeToggle from './components/ThemeToggle';
import FontSizeToggle from './components/FontSizeToggle';
import Toaster from './components/Toaster';
import CommandPalette from './components/CommandPalette';
import { useTheme } from './hooks/useTheme';
import { useRoute, type Tab } from './hooks/useRoute';
import { useShortcuts, useSequenceShortcuts } from './hooks/useShortcuts';
import { toast } from './hooks/useToast';
import { exportTasksToJSON, downloadFile } from './utils/export';
import db from './db';
import type { Task } from './types';

interface TabDef {
  id: Tab;
  label: string;
  icon: React.ReactNode;
  group: 'library' | 'workspace';
  inBottom: boolean;
}

const TABS: TabDef[] = [
  { id: 'tasks',      label: 'Baza zadań',          icon: <Database size={18} />,     group: 'library',   inBottom: true },
  { id: 'program',    label: 'Podstawa programowa', icon: <GraduationCap size={18} />, group: 'library',   inBottom: true },
  { id: 'categories', label: 'Kategorie',           icon: <FolderTree size={18} />,    group: 'library',   inBottom: false },
  { id: 'export',     label: 'Eksport / Import',    icon: <Upload size={18} />,        group: 'library',   inBottom: false },
  { id: 'settings',   label: 'Ustawienia',          icon: <SettingsIcon size={18} />,  group: 'library',   inBottom: false },
  { id: 'editor',     label: 'Edytor',              icon: <Pencil size={18} />,        group: 'workspace', inBottom: true },
  { id: 'ai',         label: 'Generuj AI',          icon: <Sparkles size={18} />,      group: 'workspace', inBottom: false },
  { id: 'randomizer', label: 'Losowanie',           icon: <Shuffle size={18} />,       group: 'workspace', inBottom: false },
  { id: 'tests',      label: 'Testy',               icon: <FileText size={18} />,      group: 'workspace', inBottom: true },
];

const TAB_LABELS: Record<Tab, string> = TABS.reduce((acc, t) => {
  acc[t.id] = t.label;
  return acc;
}, {} as Record<Tab, string>);

function RouteFallback() {
  return (
    <div className="empty-state" aria-busy="true">
      <div className="skeleton skeleton-card" style={{ maxWidth: 480, width: '100%' }} />
    </div>
  );
}

/** Wraps a route so it is mounted only once visited, and kept mounted
 *  (hidden via display:none) afterwards. This preserves the route's local
 *  state — scroll position, draft input, filters — across navigation.
 *
 *  Each route has its OWN Suspense boundary so the first-time lazy load of
 *  any one route does not unmount its already-mounted siblings (which would
 *  defeat the whole keep-alive). */
function KeepAlive({ active, visited, children }: { active: boolean; visited: boolean; children: React.ReactNode }) {
  if (!visited) return null;
  return (
    <div style={{ display: active ? 'contents' : 'none' }} aria-hidden={active ? undefined : true}>
      <Suspense fallback={<RouteFallback />}>{children}</Suspense>
    </div>
  );
}

export default function App() {
  const { tab: activeTab, param: routeParam, setTab: setActiveTab, setRoute } = useRoute();
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  // Tabs the user has visited at least once. We mount their components on
  // first activation and then keep them in the tree (hidden when inactive).
  const [visited, setVisited] = useState<Set<Tab>>(() => new Set([activeTab]));
  useEffect(() => {
    if (visited.has(activeTab)) return;
    setVisited((prev) => {
      if (prev.has(activeTab)) return prev;
      const next = new Set(prev);
      next.add(activeTab);
      return next;
    });
  }, [activeTab, visited]);

  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { cycle: cycleTheme } = useTheme();

  const tasksAll = useLiveQuery(() => db.tasks.toArray(), []);
  const testsAll = useLiveQuery(() => db.tests.toArray(), []);
  const programPointsAll = useLiveQuery(() => db.programPoints.toArray(), []);
  const categoriesAll = useLiveQuery(() => db.categories.toArray(), []);

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
    const usesParam = activeTab === 'editor' || activeTab === 'randomizer';
    if (!usesParam) return;
    if (!routeParam) {
      if (editingTask) setEditingTask(null);
      return;
    }
    if (editingTask?.id === routeParam) return;
    // Wait until Dexie has actually loaded before deciding the id is bogus.
    if (!tasksAll) return;
    const found = tasksAll.find((t) => t.id === routeParam) ?? null;
    if (found) {
      setEditingTask(found);
      return;
    }
    // ID in the URL points to nothing in the DB — likely a stale bookmark,
    // a deleted task, or a typo. Strip the bogus id (history.replaceState so
    // we don't add a junk entry) and tell the user; the route stays on the
    // same tab so the editor / randomizer just falls back to its empty state.
    toast.info({
      title: 'Nie znaleziono zadania',
      description: `ID „${routeParam}" nie istnieje w bazie. Otworzono pusty ekran.`,
    });
    setRoute(activeTab, undefined, { replace: true });
  }, [activeTab, routeParam, tasksAll, editingTask, setRoute]);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const goNewTask = useCallback(() => {
    setEditingTask(null);
    setRoute('editor');
  }, [setRoute]);

  const goEditTask = useCallback((id: string) => {
    const t = (tasksAll || []).find((x) => x.id === id) || null;
    setEditingTask(t);
    setRoute('editor', id);
  }, [tasksAll, setRoute]);

  const goRandomize = useCallback((task: Task) => {
    setEditingTask(task);
    setRoute('randomizer', task.id);
  }, [setRoute]);

  const exportJson = useCallback(() => {
    const json = exportTasksToJSON(tasksAll || [], testsAll || [], programPointsAll || [], categoriesAll || []);
    downloadFile(json, `taskforge_backup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    toast.success({
      title: 'Eksport gotowy',
      description: `${(tasksAll || []).length} zadań · ${(testsAll || []).length} testów · ${(programPointsAll || []).length} punktów podstawy · ${(categoriesAll || []).length} kategorii`,
    });
  }, [tasksAll, testsAll, programPointsAll, categoriesAll]);

  useShortcuts([
    { combo: 'mod+k',   allowInInputs: true,  handler: () => setPaletteOpen((v) => !v) },
    { combo: 'mod+n',   allowInInputs: false, handler: goNewTask },
    // The help shortcut "?" is produced by Shift+/ on most layouts. Per
    // spec, e.key should be "?", but some platforms (and Playwright)
    // report e.key="/" with shiftKey=true. Bind both forms so the shortcut
    // works regardless of how the browser surfaces the keypress.
    { combo: '?',       allowInInputs: false, handler: () => setPaletteOpen(true) },
    { combo: 'shift+/', allowInInputs: false, handler: () => setPaletteOpen(true) },
  ]);

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
  ]);

  useEffect(() => {
    document.title = `${TAB_LABELS[activeTab]} · TaskForge`;
  }, [activeTab]);

  const libraryTabs = TABS.filter((t) => t.group === 'library');
  const workspaceTabs = TABS.filter((t) => t.group === 'workspace');
  const bottomTabs = TABS.filter((t) => t.inBottom);
  const moreTabs = TABS.filter((t) => !t.inBottom);

  return (
    <div className="app-container">
      <a href="#main" className="skip-link">Przejdź do treści</a>

      <header className="app-header">
        <div className="header-brand">
          <BookOpen size={26} className="header-icon" aria-hidden="true" />
          <div>
            <h1>TaskForge</h1>
            <span className="header-sub">Parametryzowane zadania edukacyjne</span>
          </div>
        </div>
        <div className="header-tools">
          <button
            type="button"
            className="kbd-hint"
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

      <nav className="app-nav" aria-label="Główna nawigacja">
        <div className="nav-group">
          {libraryTabs.map((t) => (
            <button
              key={t.id}
              className={`nav-item ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
              aria-current={activeTab === t.id ? 'page' : undefined}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
        <div className="nav-divider" aria-hidden="true" />
        <div className="nav-group">
          {workspaceTabs.map((t) => (
            <button
              key={t.id}
              className={`nav-item ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
              aria-current={activeTab === t.id ? 'page' : undefined}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
        </div>
      </nav>

      <main id="main" className="app-main" key={refreshKey}>
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
            onSaved={() => { refresh(); setRoute('tasks'); setEditingTask(null); }}
            onCancel={() => { setRoute('tasks'); setEditingTask(null); }}
          />
        </KeepAlive>
        <KeepAlive active={activeTab === 'randomizer'} visited={visited.has('randomizer')}>
          <RandomizerPanel task={editingTask} onClose={() => { setRoute('tasks'); setEditingTask(null); }} />
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
        <KeepAlive active={activeTab === 'settings'} visited={visited.has('settings')}>
          <Settings />
        </KeepAlive>
        <KeepAlive active={activeTab === 'export'} visited={visited.has('export')}>
          <ExportImport onImport={refresh} />
        </KeepAlive>
      </main>

      <nav className="app-bottom-nav" aria-label="Nawigacja mobilna">
        <div className="bottom-nav-row">
          {bottomTabs.map((t) => (
            <button
              key={t.id}
              className={`bottom-nav-item ${activeTab === t.id ? 'active' : ''}`}
              onClick={() => setActiveTab(t.id)}
              aria-current={activeTab === t.id ? 'page' : undefined}
            >
              {t.icon}
              <span>{t.label}</span>
            </button>
          ))}
          <button
            type="button"
            className="bottom-nav-item"
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
          <div className="drawer-backdrop" onClick={() => setMoreOpen(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Więcej zakładek">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-header">
              <h3 className="card-title mb-0">Więcej</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setMoreOpen(false)}>Zamknij</button>
            </div>
            <div className="sheet-body">
              {moreTabs.map((t) => (
                <button
                  key={t.id}
                  type="button"
                  className="list-row"
                  onClick={() => { setActiveTab(t.id); setMoreOpen(false); }}
                  style={{ width: '100%', marginBottom: 8 }}
                >
                  {t.icon}
                  <span style={{ fontWeight: 600, textAlign: 'left' }}>{t.label}</span>
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
  );
}
