import { useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Download, Upload, FileJson, AlertTriangle } from 'lucide-react';
import db from '../db';
import { exportTasksToJSON, importTasksFromJSON, downloadFile } from '../utils/export';
import { toast } from '../hooks/useToast';
import ConfirmDialog from './ConfirmDialog';
import type { Task, Test, ProgramPoint, Category } from '../types';

interface Props {
  onImport: () => void;
}

interface ImportPreview {
  file: File;
  tasks: Task[];
  tests: Test[];
  programPoints: ProgramPoint[];
  categories: Category[];
}

export default function ExportImport({ onImport }: Props) {
  const tasks = useLiveQuery(() => db.tasks.toArray(), []);
  const tests = useLiveQuery(() => db.tests.toArray(), []);
  const programPoints = useLiveQuery(() => db.programPoints.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const fileRef = useRef<HTMLInputElement>(null);
  const [preview, setPreview] = useState<ImportPreview | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [dragOver, setDragOver] = useState(false);

  const handleExport = () => {
    const json = exportTasksToJSON(tasks || [], tests || [], programPoints || [], categories || []);
    downloadFile(json, `taskforge_backup_${new Date().toISOString().slice(0, 10)}.json`, 'application/json');
    toast.success({
      title: 'Eksport gotowy',
      description: `${(tasks || []).length} zadań · ${(tests || []).length} testów · ${(programPoints || []).length} punktów podstawy · ${(categories || []).length} kategorii`,
    });
  };

  const parseFile = async (file: File) => {
    try {
      setError(null);
      const text = await file.text();
      const data = importTasksFromJSON(text);
      setPreview({ file, tasks: data.tasks, tests: data.tests, programPoints: data.programPoints, categories: data.categories });
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      setError(`Błąd odczytu pliku: ${msg}`);
      toast.error({ title: 'Nieprawidłowy plik', description: msg });
    }
  };

  const performImport = async () => {
    if (!preview) return;
    try {
      for (const t of preview.tasks) {
        await db.tasks.put({ ...t, id: t.id || `task-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
      }
      for (const test of preview.tests) {
        await db.tests.put({ ...test, id: test.id || `test-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
      }
      for (const pp of preview.programPoints) {
        await db.programPoints.put({ ...pp, id: pp.id || `pp-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
      }
      for (const cat of preview.categories) {
        await db.categories.put({ ...cat, id: cat.id || `cat-${Date.now()}-${Math.random().toString(36).slice(2, 6)}` });
      }
      const parts: string[] = [];
      if (preview.tasks.length) parts.push(`${preview.tasks.length} zadań`);
      if (preview.tests.length) parts.push(`${preview.tests.length} testów`);
      if (preview.programPoints.length) parts.push(`${preview.programPoints.length} punktów podstawy`);
      if (preview.categories.length) parts.push(`${preview.categories.length} kategorii`);
      toast.success({ title: 'Import zakończony', description: parts.join(' · ') });
      onImport();
    } catch (err) {
      toast.error({ title: 'Nie udało się zaimportować', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setPreview(null);
      if (fileRef.current) fileRef.current.value = '';
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) void parseFile(file);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragOver(false);
    const file = e.dataTransfer.files?.[0];
    if (file && file.name.endsWith('.json')) {
      void parseFile(file);
    } else {
      toast.error({ title: 'Wybierz plik JSON', description: 'Akceptujemy pliki .json wyeksportowane z TaskForge.' });
    }
  };

  return (
    <div className="grid-2">
      <div className="panel">
        <div className="panel-title">Eksport bazy</div>
        <p className="text-muted text-sm mb-2 prose">
          Wyeksportuj wszystkie zadania i testy do pojedynczego pliku JSON. Możesz użyć go jako kopii zapasowej, albo przenieść dane na inne urządzenie.
        </p>
        <div className="card card-tight mb-2">
          <div className="flex items-center gap-1 mb-1">
            <FileJson size={16} aria-hidden="true" />
            <strong className="text-sm">Statystyki bazy</strong>
          </div>
          <div className="text-sm">
            Zadania: <strong>{tasks?.length ?? 0}</strong>
            <span className="text-muted"> · Testy: <strong>{tests?.length ?? 0}</strong></span>
            <span className="text-muted"> · Punkty podstawy: <strong>{programPoints?.length ?? 0}</strong></span>
            <span className="text-muted"> · Kategorie: <strong>{categories?.length ?? 0}</strong></span>
          </div>
        </div>
        <button type="button" className="btn btn-primary" onClick={handleExport}>
          <Download size={16} aria-hidden="true" /> Pobierz JSON
        </button>
      </div>

      <div className="panel">
        <div className="panel-title">Import bazy</div>
        <p className="text-muted text-sm mb-2 prose">
          Wczytaj wcześniej wyeksportowany plik JSON. Zadania i testy o tym samym ID zostaną nadpisane. Pokażemy podgląd przed zapisem.
        </p>
        <input
          ref={fileRef}
          type="file"
          accept=".json,application/json"
          onChange={handleFileChange}
          style={{ display: 'none' }}
        />
        <div
          className={`dropzone ${dragOver ? 'over' : ''}`}
          role="button"
          tabIndex={0}
          onClick={() => fileRef.current?.click()}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); fileRef.current?.click(); } }}
          onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onDrop={handleDrop}
          aria-label="Upuść plik JSON tutaj lub kliknij, aby wybrać"
        >
          <Upload size={28} aria-hidden="true" style={{ marginBottom: 8 }} />
          <div className="text-sm font-semibold">Upuść plik JSON tutaj</div>
          <div className="text-xs text-faint">lub kliknij, aby wybrać z dysku</div>
        </div>

        {error && (
          <div className="mt-1 flex items-center gap-1" style={{ color: 'var(--danger)' }} role="alert">
            <AlertTriangle size={16} aria-hidden="true" /> {error}
          </div>
        )}
      </div>

      <ConfirmDialog
        open={!!preview}
        title="Potwierdź import"
        description={preview
          ? `Plik „${preview.file.name}" zawiera ${preview.tasks.length} zadań, ${preview.tests.length} testów, ${preview.programPoints.length} punktów podstawy programowej i ${preview.categories.length} kategorii. Istniejące rekordy o tym samym ID zostaną nadpisane.`
          : ''}
        confirmLabel="Importuj"
        cancelLabel="Anuluj"
        onConfirm={() => { void performImport(); }}
        onCancel={() => { setPreview(null); if (fileRef.current) fileRef.current.value = ''; }}
      />
    </div>
  );
}
