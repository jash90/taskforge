import { useCallback, useState } from 'react';
import { RefreshCw, Copy, CheckCircle, ArrowLeft, Download } from 'lucide-react';
import type { Task, RandomizedTask, TaskChoice } from '../types';
import { randomizeParameter, renderParameterized, applyParameters, shuffleArray } from '../utils/parameters';
import { downloadFile } from '../utils/export';
import { toast } from '../hooks/useToast';

interface Props {
  task: Task | null;
  onClose: () => void;
}

type ExportFormat = 'txt' | 'csv' | 'json';

const SAFE_FILENAME = (s: string) =>
  s.replace(/[^a-z0-9ąćęłńóśźż\s]/gi, '').replace(/\s+/g, '_').slice(0, 60) || 'warianty';

const formatValue = (v: number | string) =>
  typeof v === 'number' ? String(v).replace('.', ',') : v;

const csvCell = (v: string) => `"${v.replace(/"/g, '""')}"`;

export default function RandomizerPanel({ task, onClose }: Props) {
  const [instances, setInstances] = useState<RandomizedTask[]>([]);
  const [count, setCount] = useState(5);
  const [copiedIdx, setCopiedIdx] = useState<number | null>(null);
  const [exportFormat, setExportFormat] = useState<ExportFormat>('txt');

  const generate = useCallback(() => {
    if (!task) return;
    const next: RandomizedTask[] = [];
    for (let i = 0; i < count; i++) {
      const randomized = task.parameters.map((p) => randomizeParameter(p));

      let renderedChoices: TaskChoice[] | undefined;
      if (task.taskType === 'closed' && task.choices && task.choices.length > 0) {
        const applied = task.choices.map((c) => ({
          ...c,
          content: renderParameterized(applyParameters(c.content, task.parameters), randomized),
        }));
        renderedChoices = task.shuffleChoices ? shuffleArray(applied) : applied;
      }

      next.push({
        originalTaskId: task.id,
        title: task.title,
        content: renderParameterized(applyParameters(task.content, task.parameters), randomized),
        parameters: randomized,
        choices: renderedChoices,
        taskType: task.taskType,
      });
    }
    setInstances(next);
    if (next.length > 0) {
      toast.info({ title: `Wygenerowano ${next.length} ${next.length === 1 ? 'wariant' : next.length < 5 ? 'warianty' : 'wariantów'}` });
    }
  }, [task, count]);

  const formatChoicesText = (choices?: TaskChoice[]): string => {
    if (!choices || choices.length === 0) return '';
    const lines = choices.map((c, i) => `${String.fromCharCode(97 + i)}) ${c.content}`);
    const correct = choices
      .map((c, i) => (c.isCorrect ? String.fromCharCode(97 + i) : null))
      .filter(Boolean)
      .join(', ');
    return '\n\n' + lines.join('\n') + (correct ? `\n\nPoprawna: ${correct})` : '');
  };

  const copyInstance = async (idx: number) => {
    const inst = instances[idx];
    const choicesText = formatChoicesText(inst.choices);
    await navigator.clipboard.writeText(`${inst.title}\n\n${inst.content}${choicesText}`);
    setCopiedIdx(idx);
    setTimeout(() => setCopiedIdx(null), 1500);
  };

  const exportAll = () => {
    if (!task || instances.length === 0) return;
    const filenameBase = SAFE_FILENAME(task.title);

    if (exportFormat === 'json') {
      const json = JSON.stringify(
        instances.map((inst, i) => ({
          variant: i + 1,
          title: inst.title,
          content: inst.content,
          parameters: inst.parameters.map((p) => ({ name: p.name, value: p.value, unit: p.unit ?? '' })),
          ...(inst.choices && inst.choices.length > 0
            ? {
                choices: inst.choices.map((c, ci) => ({
                  letter: String.fromCharCode(97 + ci),
                  content: c.content,
                  isCorrect: c.isCorrect,
                  points: c.points ?? (c.isCorrect ? 1 : 0),
                  explanation: c.explanation ?? '',
                })),
              }
            : {}),
        })),
        null, 2,
      );
      downloadFile(json, `${filenameBase}_warianty.json`, 'application/json');
    } else if (exportFormat === 'csv') {
      const allKeys = Array.from(new Set(instances.flatMap((i) => i.parameters.map((p) => p.name))));
      const hasChoices = instances.some((i) => i.choices && i.choices.length > 0);
      const choiceCols = hasChoices ? ['a', 'b', 'c', 'd', 'e', 'f'] : [];
      const header = ['Wariant', 'Tytuł', ...allKeys, 'Treść', ...choiceCols.map((l) => l + ')'), ...(hasChoices ? ['Poprawna'] : [])].map(csvCell).join(',');
      const rows = instances.map((inst, i) => {
        const row: string[] = [String(i + 1), inst.title];
        for (const key of allKeys) {
          const p = inst.parameters.find((x) => x.name === key);
          row.push(p ? `${formatValue(p.value)}${p.unit ? ' ' + p.unit : ''}` : '');
        }
        row.push(inst.content.replace(/\n/g, ' '));
        if (hasChoices) {
          for (let ci = 0; ci < choiceCols.length; ci++) {
            row.push(inst.choices?.[ci]?.content.replace(/\n/g, ' ') ?? '');
          }
          const correct = (inst.choices ?? [])
            .map((c, ci) => (c.isCorrect ? String.fromCharCode(97 + ci) : null))
            .filter(Boolean)
            .join('|');
          row.push(correct);
        }
        return row.map(csvCell).join(',');
      });
      // Add UTF-8 BOM for Excel compatibility
      downloadFile('﻿' + [header, ...rows].join('\n'), `${filenameBase}_warianty.csv`, 'text/csv;charset=utf-8');
    } else {
      const lines = instances.map((inst, i) => {
        const params = inst.parameters
          .map((p) => `${p.name}: ${formatValue(p.value)}${p.unit ? ' ' + p.unit : ''}`)
          .join('; ');
        return `=== Wariant ${i + 1} ===\n${inst.content}${formatChoicesText(inst.choices)}\nParametry: ${params}\n`;
      }).join('\n');
      downloadFile(`${task.title}\n\n${lines}`, `${filenameBase}_warianty.txt`, 'text/plain;charset=utf-8');
    }
    toast.success({ title: `Wyeksportowano ${instances.length} wariantów`, description: exportFormat.toUpperCase() });
  };

  if (!task) {
    return (
      <div className="empty-state card">
        <ArrowLeft size={48} aria-hidden="true" />
        <h3>Wybierz zadanie</h3>
        <p>Aby wygenerować warianty z losowymi parametrami, otwórz dowolne zadanie z bazy zadań.</p>
        <button type="button" className="btn btn-secondary" onClick={onClose}>Powrót do bazy</button>
      </div>
    );
  }

  return (
    <div>
      <div className="flex justify-between items-center mb-2">
        <div>
          <h2 className="card-title mb-0 text-2xl">Losowanie wariantów</h2>
          <div className="text-muted text-sm">{task.title}</div>
        </div>
        <button type="button" className="btn btn-secondary" onClick={onClose}>
          <ArrowLeft size={16} aria-hidden="true" /> Powrót
        </button>
      </div>

      <div className="card mb-2">
        <div className="form-row items-end mb-0">
          <div className="form-group mb-0 flex-160">
            <label htmlFor="rand-count">Liczba wariantów</label>
            <input
              id="rand-count"
              type="number"
              inputMode="numeric"
              min={1}
              max={50}
              value={count}
              onChange={(e) => setCount(Math.min(50, Math.max(1, parseInt(e.target.value) || 1)))}
            />
          </div>
          <div className="form-group mb-0 flex-160">
            <label htmlFor="rand-format">Format eksportu</label>
            <select id="rand-format" value={exportFormat} onChange={(e) => setExportFormat(e.target.value as ExportFormat)}>
              <option value="txt">Tekst (.txt)</option>
              <option value="csv">CSV (Excel)</option>
              <option value="json">JSON</option>
            </select>
          </div>
          <button type="button" className="btn btn-primary" onClick={generate}>
            <RefreshCw size={16} aria-hidden="true" /> Generuj
          </button>
          {instances.length > 0 && (
            <button type="button" className="btn btn-secondary" onClick={exportAll}>
              <Download size={16} aria-hidden="true" /> Eksportuj
            </button>
          )}
        </div>

        <div className="mt-2">
          <strong className="text-sm">Parametry do losowania</strong>
          <div className="flex gap-1 wrap mt-1">
            {task.parameters.length === 0
              ? <span className="text-muted text-sm">Brak parametrów. Dodaj je w edytorze.</span>
              : task.parameters.map((p) => (
                <span key={p.id} className="param-chip">
                  {p.name}: {p.min ?? '—'}{p.max != null && `–${p.max}`} {p.unit || ''}
                </span>
              ))}
          </div>
        </div>
      </div>

      {instances.length === 0 ? (
        <div className="empty-state card">
          <RefreshCw size={32} aria-hidden="true" />
          <p>Kliknij „Generuj", aby utworzyć warianty z losowymi parametrami.</p>
        </div>
      ) : (
        <div className={`grid-variants ${instances.length >= 12 ? 'dense' : ''}`}>
          {instances.map((inst, i) => (
            <div key={i} className="card card-tight">
              <div className="flex justify-between items-center mb-1 gap-1">
                <div className="flex items-center gap-1 wrap min-w-0">
                  <span className="badge badge-primary">Wariant {i + 1}</span>
                  <span className="text-muted text-xs">
                    {inst.parameters.map((p) => `${p.name}: ${formatValue(p.value)}${p.unit ? ' ' + p.unit : ''}`).join(' · ')}
                  </span>
                </div>
                <button
                  type="button"
                  className="btn btn-secondary btn-sm"
                  onClick={() => copyInstance(i)}
                  aria-label={`Kopiuj wariant ${i + 1}`}
                >
                  {copiedIdx === i
                    ? <><CheckCircle size={14} aria-hidden="true" /> Skopiowane</>
                    : <><Copy size={14} aria-hidden="true" /> Kopiuj</>}
                </button>
              </div>
              <div className="preview-box">
                {inst.content}
                {inst.choices && inst.choices.length > 0 && (
                  <ol className="preview-list is-tight">
                    {inst.choices.map((c, ci) => (
                      <li key={c.id}>
                        <strong>{String.fromCharCode(97 + ci)})</strong> {c.content}
                        {c.isCorrect && (
                          <span className="badge badge-success ml-px-6 text-tiny">poprawna</span>
                        )}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
