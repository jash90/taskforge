import { useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import {
  Sparkles, GraduationCap, FolderTree, X, Save, Loader2, AlertTriangle,
  RefreshCw, Bot, Trash2, Settings as SettingsIcon, ChevronDown, ChevronRight,
} from 'lucide-react';
import db from '../db';
import type { Task, TaskParameter, AnswerKeyItem, TaskSpecification, SchoolLevel } from '../types';
import { useSettings } from '../hooks/useSettings';
import { generateChat } from '../utils/openrouter';
import { buildTree, descendantIds, findNode, pathLabel } from '../utils/categoryTree';
import ProgramPointPicker from './ProgramPointPicker';
import CategoryPicker from './CategoryPicker';
import { toast } from '../hooks/useToast';

interface DraftTask {
  id: string;
  title: string;
  content: string;
  answerKey: { answer: string; points: number; explanation?: string }[];
  specification?: { method?: string; answer?: string; conclusions?: string };
  tags?: string[];
  parameters?: TaskParameter[];
  saved?: boolean;
}

const DEFAULT_SYSTEM_PROMPT_FALLBACK = `Jesteś nauczycielem fizyki / przedmiotów ścisłych w polskiej szkole. \
Tworzysz parametryzowane zadania edukacyjne dopasowane do podanej podstawy programowej i kategorii. \
Każde zadanie zawiera: tytuł, treść (z liczbami i jednostkami w treści), klucz odpowiedzi (1–3 punkty), \
metodę rozwiązania, opcjonalne wnioski. Używaj polskich nazw i poprawnej terminologii.`;

const SUBJECTS = ['Fizyka', 'Matematyka', 'Chemia', 'Biologia', 'Informatyka', 'Język polski', 'Historia', 'Geografia'];

interface Props {
  onOpenSettings: () => void;
}

export default function AITaskGenerator({ onOpenSettings }: Props) {
  const { settings } = useSettings();
  const programPoints = useLiveQuery(() => db.programPoints.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);

  const [selectedPP, setSelectedPP] = useState<Set<string>>(new Set());
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [ppPickerOpen, setPpPickerOpen] = useState(false);
  const [catPickerOpen, setCatPickerOpen] = useState(false);

  const [subject, setSubject] = useState<string>('Fizyka');
  const [level, setLevel] = useState<SchoolLevel>('ponadpodstawowa');
  const [klasa, setKlasa] = useState<string>('1');
  const [count, setCount] = useState<number>(3);
  const [difficulty, setDifficulty] = useState<'łatwe' | 'średnie' | 'trudne' | 'mieszane'>('średnie');
  const [withParameters, setWithParameters] = useState(true);
  const [extraInstructions, setExtraInstructions] = useState('');
  const [showAdvanced, setShowAdvanced] = useState(false);

  const [generating, setGenerating] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [drafts, setDrafts] = useState<DraftTask[]>([]);
  /** How many of the N parallel requests have finished (success or fail). */
  const [progressDone, setProgressDone] = useState(0);
  const abortRef = useRef<AbortController | null>(null);

  const togglePP = (id: string) => {
    setSelectedPP((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  };
  const clearPP = () => setSelectedPP(new Set());
  const removeCategory = (id: string) => setSelectedCategories((prev) => prev.filter((x) => x !== id));

  const ppDetailed = useMemo(() => {
    if (selectedPP.size === 0 || !programPoints) return [];
    return programPoints.filter((p) => selectedPP.has(p.id));
  }, [programPoints, selectedPP]);

  const categoriesDetailed = useMemo(() => {
    if (selectedCategories.length === 0 || !categories) return [];
    const ids = new Set(selectedCategories);
    return categories.filter((c) => ids.has(c.id));
  }, [categories, selectedCategories]);

  const taskCountByPpId = useMemo(() => new Map<string, number>(), []);

  // For category picker — also include descendants when summarizing
  const categoryPathsForPrompt = useMemo(() => {
    if (!categories || selectedCategories.length === 0) return [];
    const tree = buildTree(categories);
    return selectedCategories.map((id) => {
      const node = findNode(tree, id);
      const childCount = node ? descendantIds(node).length : 0;
      return { id, path: pathLabel(categories, id), childCount };
    });
  }, [categories, selectedCategories]);

  /** Build a prompt asking for a SINGLE task. The index/total hint nudges
   *  the model to vary the angle so parallel requests don't all return
   *  the same boilerplate problem. */
  const buildUserPromptForSingle = (index: number, total: number): string => {
    const parts: string[] = [];
    parts.push('Wygeneruj JEDNO zadanie edukacyjne.');
    if (total > 1) {
      parts.push(`To zadanie ${index + 1} z ${total} w tej serii — postaraj się, aby było wyraźnie różne od typowego ujęcia tematu (inny przykład liczbowy, inny scenariusz, inne pojęcie kluczowe).`);
    }
    parts.push(`Przedmiot: ${subject}.`);
    parts.push(`Poziom: ${level === 'podstawowa' ? 'szkoła podstawowa' : 'liceum / technikum'}, klasa ${klasa}.`);
    parts.push(`Trudność: ${difficulty}.`);
    if (withParameters) {
      parts.push('Zadanie powinno zawierać liczby i jednostki w treści (np. "20 km/h", "3 godziny", "100 zł"), żeby można było je sparametryzować.');
    }

    if (ppDetailed.length > 0) {
      parts.push('');
      parts.push('Zadanie ma realizować któryś z NASTĘPUJĄCYCH punktów podstawy programowej:');
      for (const p of ppDetailed) {
        parts.push(`- [${p.code}] ${p.description}`);
      }
    }

    if (categoryPathsForPrompt.length > 0) {
      parts.push('');
      parts.push('Zadanie ma dotyczyć jednej z NASTĘPUJĄCYCH kategorii (hierarchicznych):');
      for (const c of categoryPathsForPrompt) {
        parts.push(`- ${c.path}`);
      }
    }

    if (extraInstructions.trim()) {
      parts.push('');
      parts.push(`Dodatkowe wytyczne: ${extraInstructions.trim()}`);
    }

    parts.push('');
    parts.push('Zwróć WYŁĄCZNIE poprawny JSON o strukturze:');
    parts.push('{');
    parts.push('  "task": {');
    parts.push('    "title": "krótki tytuł zadania",');
    parts.push('    "content": "treść zadania w jednym akapicie z liczbami i jednostkami",');
    parts.push('    "answerKey": [');
    parts.push('      { "answer": "poprawna odpowiedź z jednostką", "points": 2, "explanation": "krótkie uzasadnienie" }');
    parts.push('    ],');
    parts.push('    "specification": {');
    parts.push('      "method": "metoda rozwiązania krok po kroku",');
    parts.push('      "answer": "ostateczna odpowiedź",');
    parts.push('      "conclusions": "wnioski lub komentarz (opcjonalnie)"');
    parts.push('    },');
    parts.push('    "tags": ["3-6 krótkich tagów"]');
    parts.push('  }');
    parts.push('}');
    parts.push('');
    parts.push('Bez markdown, bez bloków kodu, bez komentarzy. Tylko czysty JSON.');
    return parts.join('\n');
  };

  /** Parse a model response that contains a single task. Accepts both
   *  the new `{ "task": {...} }` shape (asked for in the prompt) and the
   *  legacy `{ "tasks": [{...}] }` array — picks the first element if so. */
  const parseSingleDraft = (raw: string, index: number): DraftTask => {
    let cleaned = raw.trim();
    if (cleaned.startsWith('```')) {
      cleaned = cleaned.replace(/^```(?:json)?\s*/i, '').replace(/```\s*$/i, '').trim();
    }
    let parsed: unknown;
    try {
      parsed = JSON.parse(cleaned);
    } catch {
      const match = cleaned.match(/\{[\s\S]*\}/);
      if (!match) throw new Error('Model nie zwrócił JSON.');
      parsed = JSON.parse(match[0]);
    }
    const root = parsed as { task?: unknown; tasks?: unknown };
    let raw_task: unknown;
    if (root.task && typeof root.task === 'object') {
      raw_task = root.task;
    } else if (Array.isArray(root.tasks) && root.tasks.length > 0) {
      raw_task = root.tasks[0];
    } else {
      throw new Error('Brak pola "task" w odpowiedzi.');
    }
    const x = raw_task as Partial<DraftTask> & Record<string, unknown>;
    return {
      id: `draft-${Date.now()}-${index}`,
      title: typeof x.title === 'string' ? x.title : `Zadanie ${index + 1}`,
      content: typeof x.content === 'string' ? x.content : '',
      answerKey: Array.isArray(x.answerKey) ? x.answerKey.map((a) => ({
        answer: typeof (a as { answer?: unknown }).answer === 'string' ? (a as { answer: string }).answer : '',
        points: Number((a as { points?: unknown }).points) || 1,
        explanation: typeof (a as { explanation?: unknown }).explanation === 'string' ? (a as { explanation: string }).explanation : undefined,
      })) : [],
      specification: x.specification && typeof x.specification === 'object' ? {
        method: (x.specification as { method?: string }).method,
        answer: (x.specification as { answer?: string }).answer,
        conclusions: (x.specification as { conclusions?: string }).conclusions,
      } : undefined,
      tags: Array.isArray(x.tags) ? (x.tags as string[]).filter((t) => typeof t === 'string') : [],
    } satisfies DraftTask;
  };

  const handleGenerate = async () => {
    if (!settings.openrouterApiKey) {
      toast.error({ title: 'Brak klucza API', description: 'Dodaj klucz OpenRouter w Ustawieniach.' });
      onOpenSettings();
      return;
    }
    if (selectedPP.size === 0 && selectedCategories.length === 0) {
      toast.error({ title: 'Wybierz zakres', description: 'Zaznacz punkty podstawy lub kategorie, do których AI ma wygenerować zadania.' });
      return;
    }

    setGenerating(true);
    setError(null);
    setDrafts([]);
    setProgressDone(0);
    abortRef.current = new AbortController();
    const systemPrompt = settings.aiSystemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT_FALLBACK;
    const failures: string[] = [];

    // Run a single task with one retry on transient failures: empty body
    // or `finish_reason: 'length'` (response cut off mid-JSON). The
    // retry doubles maxTokens once to fit longer outputs.
    const runOne = async (i: number): Promise<string> => {
      const userPrompt = buildUserPromptForSingle(i, count);
      let lastErr: unknown;
      for (let attempt = 0; attempt < 2; attempt++) {
        try {
          const result = await generateChat({
            apiKey: settings.openrouterApiKey!,
            model: settings.openrouterModel,
            systemPrompt,
            userPrompt,
            jsonMode: true,
            // 2500 tokens leaves comfortable room for a Polish task
            // description + answer key + method explanation. First
            // attempt uses 2500; retry bumps to 4000.
            maxTokens: attempt === 0 ? 2500 : 4000,
            signal: abortRef.current!.signal,
          });
          // If the model was truncated, try again with more headroom.
          if (result.finishReason === 'length' && attempt === 0) {
            lastErr = new Error('Odpowiedź obcięta — ponawiam z większym limitem.');
            continue;
          }
          const draft = parseSingleDraft(result.content, i);
          setDrafts((prev) => [...prev, draft]);
          return result.model;
        } catch (err) {
          lastErr = err;
          if ((err as Error).name === 'AbortError') throw err;
          // Retry on parse / empty-body errors. Other HTTP errors also
          // retry once — transient OpenRouter glitches are common.
          if (attempt === 0) continue;
        }
      }
      throw lastErr ?? new Error('Nie udało się wygenerować zadania.');
    };

    // Concurrency-limited worker pool. 10 simultaneous requests to a
    // single OpenRouter model tend to trip provider rate limits and
    // return empty bodies; 3 at a time is the sweet spot — still much
    // faster than serial, but reliable across providers.
    const CONCURRENCY = 3;
    const results: PromiseSettledResult<string>[] = new Array(count);
    let next = 0;
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, count) }, async () => {
        while (true) {
          const i = next++;
          if (i >= count) return;
          try {
            results[i] = { status: 'fulfilled', value: await runOne(i) };
          } catch (err) {
            results[i] = { status: 'rejected', reason: err };
            if ((err as Error).name !== 'AbortError') {
              failures.push(`Zadanie ${i + 1}: ${err instanceof Error ? err.message : String(err)}`);
            }
          } finally {
            setProgressDone((n) => n + 1);
          }
        }
      }),
    );

    const okCount = results.filter((r) => r.status === 'fulfilled').length;
    const aborted = results.some((r) => r.status === 'rejected' && (r.reason as Error)?.name === 'AbortError');

    if (aborted) {
      toast.info({ title: 'Anulowano generowanie', description: okCount > 0 ? `Zachowano ${okCount} ukończonych zadań.` : undefined });
    } else if (okCount === 0) {
      const msg = failures[0] || 'Model nie zwrócił żadnego zadania.';
      setError(failures.join('\n'));
      toast.error({ title: 'Błąd generowania', description: msg });
    } else if (failures.length > 0) {
      setError(failures.join('\n'));
      toast.info({
        title: `Wygenerowano ${okCount} z ${count}`,
        description: `${failures.length} ${failures.length === 1 ? 'zadanie nie powiodło się' : 'zadań nie powiodło się'}.`,
      });
    } else {
      const modelName = results.find((r) => r.status === 'fulfilled')?.value as string | undefined;
      toast.success({
        title: `Wygenerowano ${okCount} ${okCount === 1 ? 'zadanie' : okCount < 5 ? 'zadania' : 'zadań'}`,
        description: modelName,
      });
    }
    setGenerating(false);
    abortRef.current = null;
  };

  const handleCancel = () => {
    abortRef.current?.abort();
  };

  const saveDraft = async (draft: DraftTask) => {
    const now = Date.now();
    const id = `task-${now}-${Math.random().toString(36).slice(2, 6)}`;
    const answerKey: AnswerKeyItem[] = draft.answerKey.map((a, i) => ({
      id: `ans-${now}-${i}`,
      answer: a.answer,
      points: a.points,
      explanation: a.explanation,
    }));
    const spec: TaskSpecification = {
      answerKeyMethod: draft.specification?.method ?? '',
      answerKeyAnswer: draft.specification?.answer ?? '',
      answerKeyConclusions: draft.specification?.conclusions ?? '',
    };
    const task: Task = {
      id,
      title: draft.title.trim(),
      content: draft.content.trim(),
      subject,
      level,
      class: klasa,
      programPoints: Array.from(selectedPP),
      categories: selectedCategories,
      parameters: draft.parameters ?? [],
      answerKey,
      specification: spec,
      tags: draft.tags ?? [],
      createdAt: now,
      updatedAt: now,
      aiGenerated: true,
      aiModel: settings.openrouterModel,
    };
    await db.tasks.add(task);
    setDrafts((prev) => prev.map((d) => d.id === draft.id ? { ...d, saved: true } : d));
    toast.success({ title: 'Zapisano zadanie', description: draft.title });
  };

  const saveAllDrafts = async () => {
    for (const d of drafts) {
      if (!d.saved) await saveDraft(d);
    }
  };

  const discardDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id));
  };

  const hasKey = !!settings.openrouterApiKey;

  return (
    <div style={{ maxWidth: 980 }}>
      <div className="flex items-center gap-1 mb-3">
        <Sparkles size={26} aria-hidden="true" style={{ color: 'var(--accent)' }} />
        <h1 style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--text-2xl)', fontWeight: 600 }}>
          Generuj zadania AI
        </h1>
      </div>

      {!hasKey && (
        <div
          role="alert"
          className="card mb-2"
          style={{ background: 'var(--warning-bg)', borderColor: 'var(--warning)' }}
        >
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle size={16} aria-hidden="true" style={{ color: 'var(--warning)' }} />
            <strong>Brak klucza API OpenRouter</strong>
          </div>
          <p className="text-sm mb-2">
            Aby generować zadania, dodaj klucz OpenRouter w Ustawieniach. Klucz jest przechowywany lokalnie w przeglądarce.
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenSettings}>
            <SettingsIcon size={14} aria-hidden="true" /> Otwórz ustawienia
          </button>
        </div>
      )}

      {/* Wybór modelu — przypomnienie */}
      <div className="card mb-2 flex items-center justify-between" style={{ flexWrap: 'wrap', gap: 'var(--space-3)' }}>
        <div className="flex items-center gap-1">
          <Bot size={16} aria-hidden="true" style={{ color: 'var(--accent)' }} />
          <div>
            <div className="text-sm font-semibold">{settings.openrouterModelLabel || 'Domyślny model'}</div>
            <div className="text-xs text-faint" style={{ fontFamily: 'ui-monospace, monospace' }}>{settings.openrouterModel}</div>
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenSettings}>
          <SettingsIcon size={14} aria-hidden="true" /> Zmień model / klucz
        </button>
      </div>

      {/* Zakres */}
      <section className="card mb-2">
        <div className="section-header">
          <span className="section-no">1</span>
          <h3>Zakres tematyczny</h3>
        </div>
        <p className="text-muted text-sm mb-2 prose">
          Wybierz przynajmniej jedno: punkty podstawy programowej lub kategorie. Wszystko, co zaznaczysz, trafi do promptu jako zakres tematyczny generowanych zadań.
        </p>

        <div className="flex gap-1 wrap mb-1">
          <button
            type="button"
            className={`btn ${selectedPP.size > 0 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setPpPickerOpen(true)}
          >
            <GraduationCap size={14} aria-hidden="true" />
            Podstawa programowa
            {selectedPP.size > 0 && (
              <span className="badge" style={{ background: 'rgba(255,255,255,0.25)', color: 'var(--accent-fg)' }}>{selectedPP.size}</span>
            )}
          </button>
          <button
            type="button"
            className={`btn ${selectedCategories.length > 0 ? 'btn-primary' : 'btn-secondary'}`}
            onClick={() => setCatPickerOpen(true)}
          >
            <FolderTree size={14} aria-hidden="true" />
            Kategorie
            {selectedCategories.length > 0 && (
              <span className="badge" style={{ background: 'rgba(255,255,255,0.25)', color: 'var(--accent-fg)' }}>{selectedCategories.length}</span>
            )}
          </button>
        </div>

        {(ppDetailed.length > 0 || categoriesDetailed.length > 0) && (
          <div className="flex gap-1 wrap" style={{ alignItems: 'center', marginTop: 'var(--space-3)' }}>
            {ppDetailed.length > 0 && (
              <>
                <span className="text-xs text-muted">Podstawa:</span>
                {ppDetailed.map((pp) => (
                  <button
                    key={pp.id}
                    type="button"
                    className="badge badge-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', border: 'none' }}
                    onClick={() => togglePP(pp.id)}
                    title={pp.description}
                  >
                    {pp.code}
                    <X size={10} aria-hidden="true" />
                  </button>
                ))}
              </>
            )}
            {categoriesDetailed.length > 0 && (
              <>
                <span className="text-xs text-muted" style={{ marginLeft: ppDetailed.length > 0 ? 'var(--space-3)' : 0 }}>Kategorie:</span>
                {categoriesDetailed.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className="badge badge-primary"
                    style={{ display: 'inline-flex', alignItems: 'center', gap: 4, cursor: 'pointer', border: 'none' }}
                    onClick={() => removeCategory(cat.id)}
                    title={pathLabel(categories || [], cat.id)}
                  >
                    {pathLabel(categories || [], cat.id)}
                    <X size={10} aria-hidden="true" />
                  </button>
                ))}
              </>
            )}
          </div>
        )}
      </section>

      {/* Parametry */}
      <section className="card mb-2">
        <div className="section-header">
          <span className="section-no">2</span>
          <h3>Parametry generowania</h3>
        </div>
        <div className="form-row">
          <div className="form-group mb-0">
            <label htmlFor="ai-subject">Przedmiot</label>
            <select id="ai-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group mb-0">
            <label htmlFor="ai-level">Poziom</label>
            <select id="ai-level" value={level} onChange={(e) => setLevel(e.target.value as SchoolLevel)}>
              <option value="podstawowa">Szkoła podstawowa</option>
              <option value="ponadpodstawowa">Liceum / technikum</option>
            </select>
          </div>
          <div className="form-group mb-0">
            <label htmlFor="ai-class">Klasa</label>
            <input id="ai-class" value={klasa} onChange={(e) => setKlasa(e.target.value)} placeholder="np. 7" />
          </div>
          <div className="form-group mb-0">
            <label htmlFor="ai-count">Ilość</label>
            <input
              id="ai-count"
              type="number"
              inputMode="numeric"
              min={1}
              max={20}
              value={count}
              onChange={(e) => setCount(Math.min(20, Math.max(1, parseInt(e.target.value) || 1)))}
            />
          </div>
          <div className="form-group mb-0">
            <label htmlFor="ai-difficulty">Trudność</label>
            <select id="ai-difficulty" value={difficulty} onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}>
              <option value="łatwe">Łatwe</option>
              <option value="średnie">Średnie</option>
              <option value="trudne">Trudne</option>
              <option value="mieszane">Mieszane</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-1" style={{ textTransform: 'none', letterSpacing: 0, fontSize: 'var(--text-sm)' }}>
          <input
            type="checkbox"
            checked={withParameters}
            onChange={(e) => setWithParameters(e.target.checked)}
            style={{ width: 16, height: 16 }}
          />
          Każde zadanie ma zawierać liczby i jednostki (do późniejszej parametryzacji)
        </label>

        <button
          type="button"
          className="btn btn-ghost btn-sm mt-1"
          onClick={() => setShowAdvanced(!showAdvanced)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? <ChevronDown size={14} aria-hidden="true" /> : <ChevronRight size={14} aria-hidden="true" />}
          Dodatkowe wytyczne dla AI
        </button>
        {showAdvanced && (
          <div className="form-group mb-0 mt-1">
            <label htmlFor="ai-extra">Dopisz, czego oczekujesz</label>
            <textarea
              id="ai-extra"
              value={extraInstructions}
              onChange={(e) => setExtraInstructions(e.target.value)}
              rows={3}
              placeholder="np. dwa zadania zamknięte ABCD i jedno otwarte z obliczeniami; styl kontekstowy z życia codziennego"
            />
          </div>
        )}
      </section>

      {/* Akcja */}
      <div className="flex gap-1 mb-2">
        {!generating ? (
          <button
            type="button"
            className="btn btn-primary"
            onClick={handleGenerate}
            disabled={!hasKey || (selectedPP.size === 0 && selectedCategories.length === 0)}
          >
            <Sparkles size={16} aria-hidden="true" /> Generuj {count} {count === 1 ? 'zadanie' : count < 5 ? 'zadania' : 'zadań'}
          </button>
        ) : (
          <button type="button" className="btn btn-secondary" onClick={handleCancel}>
            <X size={16} aria-hidden="true" /> Anuluj
          </button>
        )}
        {generating && (
          <span className="flex items-center gap-1 text-muted text-sm">
            <Loader2 size={14} aria-hidden="true" className="spinner" />
            {count > 1
              ? `${progressDone}/${count} ukończonych${drafts.length < progressDone ? ` (${drafts.length} udanych)` : ''} — model może odpowiadać do 90 s na zadanie`
              : 'Model myśli (do 90 s)…'}
          </span>
        )}
      </div>

      {error && (
        <div
          role="alert"
          className="card mb-2 flex items-center gap-1"
          style={{ background: 'var(--danger-bg)', borderColor: 'var(--danger)', color: 'var(--danger)' }}
        >
          <AlertTriangle size={16} aria-hidden="true" /> {error}
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleGenerate}>
            <RefreshCw size={14} aria-hidden="true" /> Spróbuj ponownie
          </button>
        </div>
      )}

      {/* Wyniki */}
      {drafts.length > 0 && (
        <section className="card">
          <div className="flex justify-between items-center mb-2">
            <div>
              <h3 className="card-title mb-0">Wygenerowane wersje robocze ({drafts.filter((d) => !d.saved).length})</h3>
              <p className="text-muted text-sm">Sprawdź każde zadanie, edycja możliwa po zapisaniu.</p>
            </div>
            <div className="flex gap-1">
              <button
                type="button"
                className="btn btn-primary"
                onClick={saveAllDrafts}
                disabled={drafts.every((d) => d.saved)}
              >
                <Save size={14} aria-hidden="true" /> Zapisz wszystkie
              </button>
            </div>
          </div>

          <div className="task-list">
            {drafts.map((d) => (
              <div
                key={d.id}
                className="card card-tight"
                style={{ borderColor: d.saved ? 'var(--success)' : 'var(--border)', opacity: d.saved ? 0.7 : 1 }}
              >
                <div className="flex justify-between items-center mb-1" style={{ gap: 'var(--space-3)', flexWrap: 'wrap' }}>
                  <div style={{ minWidth: 0, flex: 1 }}>
                    <div className="flex items-center gap-1 wrap">
                      <strong>{d.title}</strong>
                      <span
                        className="badge"
                        style={{ background: 'var(--info-bg)', color: 'var(--info)', display: 'inline-flex', alignItems: 'center', gap: 3 }}
                      >
                        <Sparkles size={10} aria-hidden="true" /> AI
                      </span>
                      {d.saved && <span className="badge badge-success">zapisane</span>}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn btn-primary btn-sm"
                      onClick={() => saveDraft(d)}
                      disabled={d.saved}
                    >
                      <Save size={12} aria-hidden="true" /> {d.saved ? 'Zapisane' : 'Zapisz'}
                    </button>
                    <button
                      type="button"
                      className="btn btn-danger-soft btn-sm"
                      onClick={() => discardDraft(d.id)}
                    >
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </div>
                </div>
                <div className="preview-box prose">{d.content}</div>
                {d.answerKey.length > 0 && (
                  <div className="text-sm mt-1">
                    <strong>Klucz:</strong>{' '}
                    {d.answerKey.map((a, i) => (
                      <span key={i}>
                        {i > 0 && ' · '}
                        <span style={{ color: 'var(--accent)' }}>{a.answer}</span> ({a.points} pkt)
                      </span>
                    ))}
                  </div>
                )}
                {d.specification?.method && (
                  <div className="text-sm text-muted mt-1">
                    <strong>Metoda:</strong> {d.specification.method}
                  </div>
                )}
                {d.tags && d.tags.length > 0 && (
                  <div className="flex gap-1 wrap mt-1">
                    {d.tags.map((t) => <span key={t} className="tag">{t}</span>)}
                  </div>
                )}
              </div>
            ))}
          </div>
        </section>
      )}

      {/* Pickery */}
      {ppPickerOpen && (
        <div className="overlay" onMouseDown={() => setPpPickerOpen(false)} role="presentation">
          <div className="overlay-content" style={{ maxWidth: 880 }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="flex justify-between items-center mb-2">
              <h2 className="card-title mb-0">Punkty podstawy programowej</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setPpPickerOpen(false)}>
                <X size={14} aria-hidden="true" /> Zamknij
              </button>
            </div>
            <ProgramPointPicker
              programPoints={programPoints || []}
              selectedIds={selectedPP}
              onToggle={togglePP}
              onClear={clearPP}
              taskCountByPpId={taskCountByPpId}
            />
            <div className="flex justify-end mt-2">
              <button type="button" className="btn btn-primary" onClick={() => setPpPickerOpen(false)}>
                Gotowe ({selectedPP.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {catPickerOpen && (
        <div className="overlay" onMouseDown={() => setCatPickerOpen(false)} role="presentation">
          <div className="overlay-content" style={{ maxWidth: 720 }} onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true">
            <div className="flex justify-between items-center mb-2">
              <h2 className="card-title mb-0">Kategorie</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setCatPickerOpen(false)}>
                <X size={14} aria-hidden="true" /> Zamknij
              </button>
            </div>
            <CategoryPicker
              categories={categories || []}
              selectedIds={selectedCategories}
              onChange={setSelectedCategories}
            />
            <div className="flex justify-end mt-2">
              <button type="button" className="btn btn-primary" onClick={() => setCatPickerOpen(false)}>
                Gotowe ({selectedCategories.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
