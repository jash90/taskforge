import { useCallback, useEffect, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  BookOpen, Pencil, FileText, Database, GraduationCap,
  Shuffle, Upload, Plus, Command, MoreHorizontal, FolderTree,
  Settings as SettingsIcon, Sparkles,
} from 'lucide-react';
import TaskList from './components/TaskList';
import TaskEditor from './components/TaskEditor';
import TestGenerator from './components/TestGenerator';
import ProgramBaseViewer from './components/ProgramBaseViewer';
import ExportImport from './components/ExportImport';
import RandomizerPanel from './components/RandomizerPanel';
import CategoryManager from './components/CategoryManager';
import Settings from './components/Settings';
import AITaskGenerator from './components/AITaskGenerator';
import ThemeToggle from './components/ThemeToggle';
import Toaster from './components/Toaster';
import CommandPalette from './components/CommandPalette';
import { useTheme } from './hooks/useTheme';
import { useShortcuts, useSequenceShortcuts } from './hooks/useShortcuts';
import { toast } from './hooks/useToast';
import { exportTasksToJSON, downloadFile } from './utils/export';
import db from './db';
import type { Task } from './types';

type Tab = 'tasks' | 'editor' | 'ai' | 'randomizer' | 'tests' | 'program' | 'categories' | 'export' | 'settings';

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
  { id: 'ai',         label: 'Generuj AI',          icon: <Sparkles size={18} />,      group: 'workspace', inBottom: true },
  { id: 'randomizer', label: 'Losowanie',           icon: <Shuffle size={18} />,       group: 'workspace', inBottom: false },
  { id: 'tests',      label: 'Testy',               icon: <FileText size={18} />,      group: 'workspace', inBottom: true },
];

const TAB_LABELS: Record<Tab, string> = TABS.reduce((acc, t) => {
  acc[t.id] = t.label;
  return acc;
}, {} as Record<Tab, string>);

export default function App() {
  const [activeTab, setActiveTab] = useState<Tab>('tasks');
  const [editingTask, setEditingTask] = useState<Task | null>(null);
  const [refreshKey, setRefreshKey] = useState(0);
  const [paletteOpen, setPaletteOpen] = useState(false);
  const [moreOpen, setMoreOpen] = useState(false);
  const { cycle: cycleTheme } = useTheme();

  const tasksAll = useLiveQuery(() => db.tasks.toArray(), []);
  const testsAll = useLiveQuery(() => db.tests.toArray(), []);
  const programPointsAll = useLiveQuery(() => db.programPoints.toArray(), []);
  const categoriesAll = useLiveQuery(() => db.categories.toArray(), []);

  const refresh = useCallback(() => setRefreshKey((k) => k + 1), []);

  const goNewTask = useCallback(() => {
    setEditingTask(null);
    setActiveTab('editor');
  }, []);

  const goEditTask = useCallback((id: string) => {
    const t = (tasksAll || []).find((x) => x.id === id) || null;
    setEditingTask(t);
    setActiveTab('editor');
  }, [tasksAll]);

  const goRandomize = useCallback((task: Task) => {
    setEditingTask(task);
    setActiveTab('randomizer');
  }, []);

  const exportJson = useCallback(() => {
    const json = exportTasksToJSON(tasksAll || [], testsAll || [], programPointsAll || [], categoriesAll || []);
    downloadFile(json, `taskforge_backup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    toast.success({
      title: 'Eksport gotowy',
      description: `${(tasksAll || []).length} zadań · ${(testsAll || []).length} testów · ${(programPointsAll || []).length} punktów podstawy · ${(categoriesAll || []).length} kategorii`,
    });
  }, [tasksAll, testsAll, programPointsAll, categoriesAll]);

  useShortcuts([
    { combo: 'mod+k', allowInInputs: true, handler: () => setPaletteOpen((v) => !v) },
    { combo: 'mod+n', allowInInputs: false, handler: goNewTask },
    { combo: '?',    allowInInputs: false, handler: () => setPaletteOpen(true) },
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
          <ThemeToggle />
          <button
            type="button"
            className="btn btn-primary"
            onClick={goNewTask}
          >
            <Plus size={16} aria-hidden="true" /> Nowe zadanie
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
        {activeTab === 'tasks' && (
          <TaskList
            onEdit={(task) => { setEditingTask(task); setActiveTab('editor'); }}
            onRandomize={goRandomize}
            onNew={goNewTask}
          />
        )}
        {activeTab === 'editor' && (
          <TaskEditor
            task={editingTask}
            onSaved={() => { refresh(); setActiveTab('tasks'); setEditingTask(null); }}
            onCancel={() => { setActiveTab('tasks'); setEditingTask(null); }}
          />
        )}
        {activeTab === 'randomizer' && (
          <RandomizerPanel task={editingTask} onClose={() => { setActiveTab('tasks'); setEditingTask(null); }} />
        )}
        {activeTab === 'tests' && <TestGenerator />}
        {activeTab === 'program' && <ProgramBaseViewer />}
        {activeTab === 'categories' && <CategoryManager />}
        {activeTab === 'ai' && <AITaskGenerator onOpenSettings={() => setActiveTab('settings')} />}
        {activeTab === 'settings' && <Settings />}
        {activeTab === 'export' && <ExportImport onImport={refresh} />}
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
