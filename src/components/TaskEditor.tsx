import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useLiveQuery } from 'dexie-react-hooks';
import { Wand2, Plus, Trash2, GripVertical, Maximize2, X } from 'lucide-react';
import db from '../db';
import type { Task, TaskParameter, AnswerKeyItem, TaskSpecification, TaskChoice, TaskType } from '../types';
import { detectParameters, renderParameterized } from '../utils/parameters';
import { copyAsWord } from '../utils/export';
import { useShortcuts } from '../hooks/useShortcuts';
import { toast } from '../hooks/useToast';
import EditorOutline, { type OutlineEntry } from './editor/EditorOutline';
import EditorPreview from './editor/EditorPreview';
import EditorSaveBar from './editor/EditorSaveBar';
import SectionProgramBase from './editor/SectionProgramBase';
import CategoryPicker from './CategoryPicker';

interface Props {
  task: Task | null;
  onSaved: () => void;
  onCancel: () => void;
}

const emptySpec: TaskSpecification = {
  answerKeyMethod: '',
  answerKeyAnswer: '',
  answerKeyConclusions: '',
};

const SUBJECTS = ['Matematyka', 'Fizyka', 'Chemia', 'Biologia', 'Informatyka', 'Język polski', 'Historia', 'Geografia'];

export default function TaskEditor({ task, onSaved, onCancel }: Props) {
  const programPoints = useLiveQuery(() => db.programPoints.toArray(), []);
  const categories = useLiveQuery(() => db.categories.toArray(), []);
  const paneRef = useRef<HTMLDivElement>(null);
  const scrollContainer = typeof document !== 'undefined' ? document.querySelector('.app-main') as HTMLElement | null : null;

  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [subject, setSubject] = useState<string>(SUBJECTS[0]);
  const [level, setLevel] = useState<Task['level']>('podstawowa');
  const [cls, setCls] = useState('7');
  const [selectedPP, setSelectedPP] = useState<string[]>([]);
  const [selectedCategories, setSelectedCategories] = useState<string[]>([]);
  const [parameters, setParameters] = useState<TaskParameter[]>([]);
  const [answerKey, setAnswerKey] = useState<AnswerKeyItem[]>([]);
  const [spec, setSpec] = useState<TaskSpecification>(emptySpec);
  const [tags, setTags] = useState('');
  const [taskType, setTaskType] = useState<TaskType>('open');
  const [choices, setChoices] = useState<TaskChoice[]>([]);
  const [shuffleChoices, setShuffleChoices] = useState(false);
  const [dirty, setDirty] = useState(false);
  const [saving, setSaving] = useState(false);
  const [showFullPreview, setShowFullPreview] = useState(false);
  const [showMobilePreview, setShowMobilePreview] = useState(false);
  const [errors, setErrors] = useState<{ title?: boolean; content?: boolean }>({});

  // Hydrate from task / reset on switch
  useEffect(() => {
    if (task) {
      setTitle(task.title);
      setContent(task.content);
      setSubject(task.subject);
      setLevel(task.level);
      setCls(task.class);
      setSelectedPP(task.programPoints);
      setSelectedCategories(task.categories ?? []);
      setParameters(task.parameters);
      setAnswerKey(task.answerKey);
      setSpec(task.specification);
      setTags(task.tags.join(', '));
      setTaskType(task.taskType ?? 'open');
      setChoices(task.choices ?? []);
      setShuffleChoices(task.shuffleChoices ?? false);
    } else {
      setTitle(''); setContent(''); setSubject(SUBJECTS[0]); setLevel('podstawowa');
      setCls('7'); setSelectedPP([]); setSelectedCategories([]); setParameters([]); setAnswerKey([]);
      setSpec(emptySpec); setTags('');
      setTaskType('open'); setChoices([]); setShuffleChoices(false);
    }
    setDirty(false);
    setErrors({});
  }, [task]);

  // Mark dirty on any field change after hydration
  const markDirty = () => { if (!dirty) setDirty(true); };

  const setTitleD       = (v: string) => { markDirty(); setTitle(v); };
  const setContentD     = (v: string) => { markDirty(); setContent(v); };
  const setSubjectD     = (v: string) => { markDirty(); setSubject(v); };
  const setLevelD       = (v: Task['level']) => { markDirty(); setLevel(v); };
  const setClsD         = (v: string) => { markDirty(); setCls(v); };
  const setTagsD        = (v: string) => { markDirty(); setTags(v); };
  const setSpecD        = (patch: Partial<TaskSpecification>) => { markDirty(); setSpec((s) => ({ ...s, ...patch })); };

  const runAutoDetect = useCallback(() => {
    const detected = detectParameters(content);
    const manual = parameters.filter((p) => !p.isAutoDetected);
    const existing = new Set(parameters.filter((p) => p.isAutoDetected).map((p) => `${p.name}|${p.unit ?? ''}`));
    const fresh = detected.filter((d) => !existing.has(`${d.name}|${d.unit ?? ''}`));
    if (fresh.length === 0) {
      toast.info({ title: 'Brak nowych parametrów', description: 'Wszystkie wykryte parametry są już dodane.' });
      return;
    }
    setParameters([...manual, ...fresh]);
    markDirty();
    toast.success({ title: `Wykryto ${fresh.length} ${fresh.length === 1 ? 'parametr' : fresh.length < 5 ? 'parametry' : 'parametrów'}` });
  }, [content, parameters]);

  const updateParam = (id: string, patch: Partial<TaskParameter>) => {
    markDirty();
    setParameters((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)));
  };
  const addManualParam = () => {
    markDirty();
    setParameters((ps) => [...ps, {
      id: `manual-${Date.now()}`, name: 'Nowy parametr', type: 'integer',
      value: 10, min: 1, max: 100, step: 1, isAutoDetected: false,
    }]);
  };
  const removeParam = (id: string) => { markDirty(); setParameters((ps) => ps.filter((p) => p.id !== id)); };
  const moveParam = (id: string, dir: -1 | 1) => {
    markDirty();
    setParameters((ps) => {
      const idx = ps.findIndex((p) => p.id === id);
      if (idx < 0) return ps;
      const ni = idx + dir;
      if (ni < 0 || ni >= ps.length) return ps;
      const next = [...ps];
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return next;
    });
  };

  const setTaskTypeD = (t: TaskType) => {
    markDirty();
    setTaskType(t);
    if (t === 'closed' && choices.length === 0) {
      // Seed with 4 empty choices a–d, first marked correct.
      const seed: TaskChoice[] = ['a', 'b', 'c', 'd'].map((_l, i) => ({
        id: `choice-${Date.now()}-${i}`,
        content: '',
        isCorrect: i === 0,
        points: i === 0 ? 1 : 0,
      }));
      setChoices(seed);
    }
  };

  const addChoice = () => {
    if (choices.length >= 6) return;
    markDirty();
    setChoices((c) => [...c, { id: `choice-${Date.now()}`, content: '', isCorrect: false, points: 0 }]);
  };
  const updateChoice = (id: string, patch: Partial<TaskChoice>) => {
    markDirty();
    setChoices((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)));
  };
  const removeChoice = (id: string) => {
    if (choices.length <= 2) return;
    markDirty();
    setChoices((cs) => cs.filter((c) => c.id !== id));
  };
  const moveChoice = (id: string, dir: -1 | 1) => {
    markDirty();
    setChoices((cs) => {
      const idx = cs.findIndex((c) => c.id === id);
      if (idx < 0) return cs;
      const ni = idx + dir;
      if (ni < 0 || ni >= cs.length) return cs;
      const next = [...cs];
      [next[idx], next[ni]] = [next[ni], next[idx]];
      return next;
    });
  };
  const setShuffleChoicesD = (v: boolean) => { markDirty(); setShuffleChoices(v); };

  const addAnswer = () => {
    markDirty();
    setAnswerKey((a) => [...a, { id: `ans-${Date.now()}`, answer: '', points: 1, explanation: '' }]);
  };
  const updateAnswer = (id: string, patch: Partial<AnswerKeyItem>) => {
    markDirty();
    setAnswerKey((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a)));
  };
  const removeAnswer = (id: string) => { markDirty(); setAnswerKey((as) => as.filter((a) => a.id !== id)); };

  const togglePP = (id: string) => {
    markDirty();
    setSelectedPP((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  };

  const validate = (): boolean => {
    const next = {
      title: !title.trim(),
      content: !content.trim(),
    };
    setErrors(next);
    return !next.title && !next.content;
  };

  const handleSave = useCallback(async () => {
    if (!validate()) {
      toast.error({ title: 'Uzupełnij wymagane pola', description: 'Tytuł i treść są wymagane.' });
      document.getElementById('sec-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      return;
    }
    if (selectedPP.length === 0) {
      toast.info({
        title: 'Brak punktów podstawy programowej',
        description: 'Zadanie zostanie zapisane bez przypisanej podstawy. Możesz dodać ją później.',
      });
    }
    setSaving(true);
    try {
      const payload: Task = {
        id: task?.id || `task-${Date.now()}`,
        title: title.trim(),
        content: content.trim(),
        subject, level, class: cls,
        programPoints: selectedPP,
        categories: selectedCategories,
        parameters, answerKey, specification: spec,
        tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
        createdAt: task?.createdAt || Date.now(),
        updatedAt: Date.now(),
        taskType,
        choices: taskType === 'closed' ? choices : undefined,
        shuffleChoices: taskType === 'closed' ? shuffleChoices : undefined,
      };
      await db.tasks.put(payload);
      setDirty(false);
      toast.success({ title: task ? 'Zaktualizowano zadanie' : 'Utworzono zadanie' });
      onSaved();
    } catch (err) {
      toast.error({ title: 'Nie udało się zapisać', description: err instanceof Error ? err.message : String(err) });
    } finally {
      setSaving(false);
    }
  }, [task, title, content, subject, level, cls, selectedPP, selectedCategories, parameters, answerKey, spec, tags, taskType, choices, shuffleChoices, onSaved]);

  const handleCopyWord = useCallback(async () => {
    const html = copyAsWord({
      id: 'temp', title, content, subject, level, class: cls,
      programPoints: selectedPP, parameters, answerKey, specification: spec,
      tags: tags.split(',').map((t) => t.trim()).filter(Boolean),
      createdAt: Date.now(), updatedAt: Date.now(),
      taskType,
      choices: taskType === 'closed' ? choices : undefined,
      shuffleChoices: taskType === 'closed' ? shuffleChoices : undefined,
    });
    const blob = new Blob([html], { type: 'text/html' });
    const item = new ClipboardItem({
      'text/html': blob,
      'text/plain': new Blob([title + '\n\n' + content], { type: 'text/plain' }),
    });
    await navigator.clipboard.write([item]);
    toast.success({ title: 'Skopiowano jako Word', description: 'Wklej do edytora dokumentów (Word, Pages, Google Docs).' });
  }, [title, content, subject, level, cls, selectedPP, parameters, answerKey, spec, tags, taskType, choices, shuffleChoices]);

  useShortcuts([
    { combo: 'mod+s', allowInInputs: true, handler: () => { void handleSave(); } },
  ]);

  const totalPoints = taskType === 'closed'
    ? choices.reduce((s, c) => s + (c.isCorrect ? (c.points ?? 1) : (c.points ?? 0)), 0)
    : answerKey.reduce((s, a) => s + a.points, 0);

  const hasAnyCorrectChoice = choices.some((c) => c.isCorrect);
  const hasFilledChoices = choices.length >= 2 && choices.every((c) => c.content.trim()) && hasAnyCorrectChoice;

  const outline: OutlineEntry[] = useMemo(() => {
    const answersEntry: OutlineEntry = taskType === 'closed'
      ? { id: 'sec-choices', label: 'Warianty (ABCD)', filled: hasFilledChoices }
      : { id: 'sec-answers', label: 'Klucz odpowiedzi', filled: answerKey.length > 0 };
    return [
      { id: 'sec-content',    label: 'Treść',           filled: !!title.trim() && !!content.trim() },
      { id: 'sec-meta',       label: 'Klasyfikacja',    filled: !!subject && !!cls },
      { id: 'sec-params',     label: 'Parametry',       filled: parameters.length > 0 },
      answersEntry,
      { id: 'sec-spec',       label: 'Kryteria',        filled: !!spec.answerKeyMethod || !!spec.answerKeyAnswer },
      { id: 'sec-program',    label: 'Podstawa',        filled: selectedPP.length > 0 },
      { id: 'sec-categories', label: 'Kategorie',       filled: selectedCategories.length > 0 },
      { id: 'sec-tags',       label: 'Tagi',            filled: !!tags.trim() },
    ];
  }, [title, content, subject, cls, parameters.length, taskType, answerKey.length, hasFilledChoices, spec, selectedPP.length, selectedCategories.length, tags]);

  return (
    <div className="editor-shell">
      <EditorOutline entries={outline} scrollContainer={scrollContainer} />

      <div className="editor-pane" ref={paneRef}>
        <div className="flex justify-between items-center mb-1">
          <h2 className="card-title mb-0" style={{ fontSize: 'var(--text-2xl)' }}>
            {task ? 'Edycja zadania' : 'Nowe zadanie'}
          </h2>
          {totalPoints > 0 && <span className="badge badge-success">{totalPoints} pkt łącznie</span>}
        </div>

        {/* === Treść === */}
        <section id="sec-content" className="card editor-section">
          <div className="section-header">
            <span className="section-no">1</span>
            <h3>Treść zadania</h3>
          </div>
          <div className="form-group">
            <label htmlFor="task-title">Tytuł <span style={{ color: 'var(--danger)' }} aria-hidden="true">*</span></label>
            <input
              id="task-title"
              className={errors.title ? 'invalid' : ''}
              value={title}
              onChange={(e) => setTitleD(e.target.value)}
              placeholder="np. Ruch jednostajny prostoliniowy"
              aria-invalid={errors.title ? 'true' : undefined}
              required
            />
            {errors.title && <div className="field-error" role="alert">Tytuł jest wymagany.</div>}
          </div>
          <div className="form-group mb-0">
            <label htmlFor="task-content">Treść <span style={{ color: 'var(--danger)' }} aria-hidden="true">*</span></label>
            <textarea
              id="task-content"
              className={errors.content ? 'invalid' : ''}
              value={content}
              onChange={(e) => setContentD(e.target.value)}
              placeholder="Samochód jedzie z prędkością 20 km/h. Jaką drogę przebędzie w ciągu 3 godzin?"
              rows={6}
              aria-invalid={errors.content ? 'true' : undefined}
              required
            />
            {errors.content && <div className="field-error" role="alert">Treść jest wymagana.</div>}
            <div className="flex gap-1 mt-1">
              <button type="button" className="btn btn-secondary btn-sm" onClick={runAutoDetect}>
                <Wand2 size={14} aria-hidden="true" /> Wykryj parametry w treści
              </button>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMobilePreview(true)}>
                <Maximize2 size={14} aria-hidden="true" /> Podgląd
              </button>
            </div>
          </div>
        </section>

        {/* === Klasyfikacja (toolbar) === */}
        <section id="sec-meta" className="editor-section editor-toolbar">
          <div className="form-group">
            <label htmlFor="task-type">Typ</label>
            <select id="task-type" value={taskType} onChange={(e) => setTaskTypeD(e.target.value as TaskType)}>
              <option value="open">Otwarte</option>
              <option value="closed">Zamknięte (ABCD)</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="task-subject">Przedmiot</label>
            <select id="task-subject" value={subject} onChange={(e) => setSubjectD(e.target.value)}>
              {SUBJECTS.map((s) => <option key={s}>{s}</option>)}
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="task-level">Poziom</label>
            <select id="task-level" value={level} onChange={(e) => setLevelD(e.target.value as Task['level'])}>
              <option value="podstawowa">Szkoła podstawowa</option>
              <option value="ponadpodstawowa">Liceum / technikum</option>
            </select>
          </div>
          <div className="form-group">
            <label htmlFor="task-class">Klasa</label>
            <input id="task-class" value={cls} onChange={(e) => setClsD(e.target.value)} placeholder="np. 7" />
          </div>
        </section>

        {/* === Parametry === */}
        <section id="sec-params" className="card editor-section">
          <div className="section-header">
            <span className="section-no">2</span>
            <h3>Parametry</h3>
            <span className="grow" />
            {parameters.length > 0 && <span className="badge badge-primary">{parameters.length}</span>}
            <button type="button" className="btn btn-secondary btn-sm" onClick={addManualParam}>
              <Plus size={14} aria-hidden="true" /> Dodaj
            </button>
          </div>

          {parameters.length === 0 ? (
            <p className="text-muted text-sm">
              Brak parametrów. Wpisz treść z liczbami i kliknij „Wykryj parametry", lub dodaj ręcznie.
            </p>
          ) : (
            <div className="param-table-wrap">
              <table className="param-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}><span className="sr-only">Kolejność</span></th>
                    <th>Nazwa</th>
                    <th style={{ width: 120 }}>Typ</th>
                    <th style={{ width: 80 }}>Min</th>
                    <th style={{ width: 80 }}>Max</th>
                    <th style={{ width: 80 }}>Krok</th>
                    <th style={{ width: 90 }}>Jednostka</th>
                    <th style={{ width: 90 }}>Wartość</th>
                    <th style={{ width: 36 }}><span className="sr-only">Usuń</span></th>
                  </tr>
                </thead>
                <tbody>
                  {parameters.map((p, idx) => {
                    const isNumeric = p.type === 'integer' || p.type === 'number';
                    return (
                      <tr key={p.id}>
                        <td>
                          <button
                            type="button"
                            className="btn btn-ghost btn-icon"
                            aria-label={`Przesuń parametr ${p.name} w górę`}
                            onClick={() => moveParam(p.id, -1)}
                            disabled={idx === 0}
                            style={{ padding: 4, minHeight: 24, width: 24 }}
                          >
                            <GripVertical size={12} aria-hidden="true" />
                          </button>
                        </td>
                        <td>
                          <input className="tbl-input" value={p.name} onChange={(e) => updateParam(p.id, { name: e.target.value })} placeholder="Nazwa" />
                        </td>
                        <td>
                          <select className="tbl-input" value={p.type} onChange={(e) => updateParam(p.id, { type: e.target.value as TaskParameter['type'] })}>
                            <option value="integer">Całkowita</option>
                            <option value="number">Dziesiętna</option>
                            <option value="text">Tekst</option>
                            <option value="choice">Wybór</option>
                          </select>
                        </td>
                        {isNumeric ? (
                          <>
                            <td><input className="tbl-input" type="number" inputMode="decimal" value={p.min ?? ''} onChange={(e) => updateParam(p.id, { min: parseFloat(e.target.value) })} /></td>
                            <td><input className="tbl-input" type="number" inputMode="decimal" value={p.max ?? ''} onChange={(e) => updateParam(p.id, { max: parseFloat(e.target.value) })} /></td>
                            <td><input className="tbl-input" type="number" inputMode="decimal" value={p.step ?? ''} onChange={(e) => updateParam(p.id, { step: parseFloat(e.target.value) })} /></td>
                          </>
                        ) : (
                          <td colSpan={3} className="text-muted text-sm" style={{ textAlign: 'center' }}>—</td>
                        )}
                        <td><input className="tbl-input" value={p.unit || ''} onChange={(e) => updateParam(p.id, { unit: e.target.value })} placeholder="np. km/h" /></td>
                        <td>
                          <input
                            className="tbl-input"
                            value={typeof p.value === 'number' ? String(p.value).replace('.', ',') : p.value}
                            onChange={(e) => {
                              const v = e.target.value.replace(',', '.');
                              const num = parseFloat(v);
                              updateParam(p.id, { value: isNaN(num) ? v : num });
                            }}
                          />
                        </td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-danger-soft btn-icon"
                            onClick={() => removeParam(p.id)}
                            aria-label={`Usuń parametr ${p.name}`}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* === Klucz odpowiedzi (open) / Warianty (closed) === */}
        {taskType === 'open' ? (
          <section id="sec-answers" className="card editor-section">
            <div className="section-header">
              <span className="section-no">3</span>
              <h3>Klucz odpowiedzi</h3>
              <span className="grow" />
              {totalPoints > 0 && <span className="badge badge-success">{totalPoints} pkt</span>}
              <button type="button" className="btn btn-secondary btn-sm" onClick={addAnswer}>
                <Plus size={14} aria-hidden="true" /> Dodaj
              </button>
            </div>

            {answerKey.length === 0 ? (
              <p className="text-muted text-sm">Dodaj oczekiwane odpowiedzi i przypisz im punkty.</p>
            ) : (
              <div className="param-table-wrap">
                <table className="param-table">
                  <thead>
                    <tr>
                      <th style={{ width: 36 }}>Lp.</th>
                      <th>Odpowiedź</th>
                      <th style={{ width: 90 }}>Punkty</th>
                      <th>Wyjaśnienie</th>
                      <th style={{ width: 36 }}><span className="sr-only">Usuń</span></th>
                    </tr>
                  </thead>
                  <tbody>
                    {answerKey.map((a, i) => (
                      <tr key={a.id}>
                        <td className="text-muted text-sm" style={{ textAlign: 'center' }}>{i + 1}</td>
                        <td><input className="tbl-input" value={a.answer} onChange={(e) => updateAnswer(a.id, { answer: e.target.value })} placeholder="Poprawna odpowiedź" /></td>
                        <td><input className="tbl-input" type="number" inputMode="decimal" value={a.points} onChange={(e) => updateAnswer(a.id, { points: parseFloat(e.target.value) || 0 })} /></td>
                        <td><input className="tbl-input" value={a.explanation || ''} onChange={(e) => updateAnswer(a.id, { explanation: e.target.value })} placeholder="Opcjonalnie" /></td>
                        <td>
                          <button
                            type="button"
                            className="btn btn-danger-soft btn-icon"
                            onClick={() => removeAnswer(a.id)}
                            aria-label={`Usuń odpowiedź ${i + 1}`}
                          >
                            <Trash2 size={14} aria-hidden="true" />
                          </button>
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            )}
          </section>
        ) : (
          <section id="sec-choices" className="card editor-section">
            <div className="section-header">
              <span className="section-no">3</span>
              <h3>Warianty odpowiedzi (ABCD)</h3>
              <span className="grow" />
              {totalPoints > 0 && <span className="badge badge-success">{totalPoints} pkt</span>}
              <button
                type="button"
                className="btn btn-secondary btn-sm"
                onClick={addChoice}
                disabled={choices.length >= 6}
                title={choices.length >= 6 ? 'Maks. 6 wariantów' : undefined}
              >
                <Plus size={14} aria-hidden="true" /> Dodaj
              </button>
            </div>

            <p className="text-muted text-sm mb-1">
              Min. 2, maks. 6 wariantów. W treści wariantu możesz użyć placeholderów <code>{'{{paramId}}'}</code> z parametrów lub liczb, które zostaną automatycznie wykryte i podstawione podczas losowania.
            </p>

            <div className="param-table-wrap">
              <table className="param-table">
                <thead>
                  <tr>
                    <th style={{ width: 28 }}><span className="sr-only">Kolejność</span></th>
                    <th style={{ width: 36 }}>Lit.</th>
                    <th>Treść wariantu</th>
                    <th style={{ width: 90 }}>Poprawna</th>
                    <th style={{ width: 80 }}>Punkty</th>
                    <th>Wyjaśnienie</th>
                    <th style={{ width: 36 }}><span className="sr-only">Usuń</span></th>
                  </tr>
                </thead>
                <tbody>
                  {choices.map((c, i) => (
                    <tr key={c.id}>
                      <td>
                        <button
                          type="button"
                          className="btn btn-ghost btn-icon"
                          aria-label={`Przesuń wariant ${String.fromCharCode(97 + i)} w górę`}
                          onClick={() => moveChoice(c.id, -1)}
                          disabled={i === 0}
                          style={{ padding: 4, minHeight: 24, width: 24 }}
                        >
                          <GripVertical size={12} aria-hidden="true" />
                        </button>
                      </td>
                      <td className="text-muted text-sm" style={{ textAlign: 'center', fontWeight: 600 }}>
                        {String.fromCharCode(97 + i)})
                      </td>
                      <td>
                        <input
                          className="tbl-input"
                          value={c.content}
                          onChange={(e) => updateChoice(c.id, { content: e.target.value })}
                          placeholder="Treść wariantu"
                        />
                      </td>
                      <td style={{ textAlign: 'center' }}>
                        <input
                          type="checkbox"
                          checked={c.isCorrect}
                          onChange={(e) => {
                            const next = e.target.checked;
                            updateChoice(c.id, {
                              isCorrect: next,
                              points: next ? (c.points && c.points > 0 ? c.points : 1) : 0,
                            });
                          }}
                          aria-label={`Wariant ${String.fromCharCode(97 + i)} jest poprawny`}
                        />
                      </td>
                      <td>
                        <input
                          className="tbl-input"
                          type="number"
                          inputMode="decimal"
                          value={c.points ?? (c.isCorrect ? 1 : 0)}
                          onChange={(e) => updateChoice(c.id, { points: parseFloat(e.target.value) || 0 })}
                        />
                      </td>
                      <td>
                        <input
                          className="tbl-input"
                          value={c.explanation || ''}
                          onChange={(e) => updateChoice(c.id, { explanation: e.target.value })}
                          placeholder="Opcjonalnie"
                        />
                      </td>
                      <td>
                        <button
                          type="button"
                          className="btn btn-danger-soft btn-icon"
                          onClick={() => removeChoice(c.id)}
                          disabled={choices.length <= 2}
                          aria-label={`Usuń wariant ${String.fromCharCode(97 + i)}`}
                        >
                          <Trash2 size={14} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>

            <div className="flex items-center gap-1 mt-1">
              <input
                id="shuffle-choices"
                type="checkbox"
                checked={shuffleChoices}
                onChange={(e) => setShuffleChoicesD(e.target.checked)}
              />
              <label htmlFor="shuffle-choices" className="text-sm" style={{ margin: 0, cursor: 'pointer' }}>
                Losuj kolejność wariantów podczas generowania
              </label>
            </div>

            {!hasAnyCorrectChoice && choices.length > 0 && (
              <p className="field-error mt-1" role="alert">
                Zaznacz co najmniej jeden wariant jako poprawny.
              </p>
            )}
          </section>
        )}

        {/* === Kryteria === */}
        <section id="sec-spec" className="card editor-section">
          <div className="section-header">
            <span className="section-no">4</span>
            <h3>Kryteria oceniania</h3>
          </div>
          <div className="grid-2">
            <div className="form-group mb-0">
              <label htmlFor="spec-method">Metoda rozwiązania</label>
              <textarea
                id="spec-method"
                value={spec.answerKeyMethod}
                onChange={(e) => setSpecD({ answerKeyMethod: e.target.value })}
                rows={5}
                placeholder="Opisz metodę rozwiązania krok po kroku…"
              />
            </div>
            <div>
              <div className="form-group">
                <label htmlFor="spec-answer">Odpowiedź</label>
                <textarea id="spec-answer" value={spec.answerKeyAnswer} onChange={(e) => setSpecD({ answerKeyAnswer: e.target.value })} rows={2} placeholder="Podaj poprawną odpowiedź…" />
              </div>
              <div className="form-group mb-0">
                <label htmlFor="spec-conclusions">Wnioski</label>
                <textarea id="spec-conclusions" value={spec.answerKeyConclusions} onChange={(e) => setSpecD({ answerKeyConclusions: e.target.value })} rows={2} placeholder="Wnioski, ciekawostki lub komentarze…" />
              </div>
            </div>
          </div>
        </section>

        {/* === Podstawa programowa === */}
        <section id="sec-program" className="card editor-section">
          <div className="section-header">
            <span className="section-no">5</span>
            <h3>Podstawa programowa</h3>
            <span className="text-faint text-sm" style={{ marginLeft: 'auto' }}>opcjonalne</span>
          </div>
          <SectionProgramBase
            level={level}
            cls={cls}
            selectedIds={selectedPP}
            programPoints={programPoints}
            onToggle={togglePP}
            onLevelChange={setLevelD}
            onClassChange={setClsD}
          />
        </section>

        {/* === Kategorie === */}
        <section id="sec-categories" className="card editor-section">
          <div className="section-header">
            <span className="section-no">6</span>
            <h3>Kategorie</h3>
            <span className="text-faint text-sm" style={{ marginLeft: 'auto' }}>opcjonalne</span>
          </div>
          <CategoryPicker
            categories={categories || []}
            selectedIds={selectedCategories}
            onChange={(next) => { markDirty(); setSelectedCategories(next); }}
          />
        </section>

        {/* === Tagi === */}
        <section id="sec-tags" className="card editor-section">
          <div className="section-header">
            <span className="section-no">7</span>
            <h3>Tagi</h3>
          </div>
          <div className="form-group mb-0">
            <label htmlFor="task-tags">Tagi (oddzielone przecinkami)</label>
            <input id="task-tags" value={tags} onChange={(e) => setTagsD(e.target.value)} placeholder="np. ruch, prędkość, zadanie tekstowe" />
          </div>
        </section>

        <EditorSaveBar dirty={dirty} saving={saving} onSave={handleSave} onCancel={onCancel} />
      </div>

      <EditorPreview
        title={title}
        content={content}
        parameters={parameters}
        choices={taskType === 'closed' ? choices : undefined}
        onOpenFull={() => setShowFullPreview(true)}
        onCopyWord={handleCopyWord}
      />

      {showFullPreview && (
        <div className="overlay" onMouseDown={() => setShowFullPreview(false)} role="presentation">
          <div className="overlay-content" onMouseDown={(e) => e.stopPropagation()} role="dialog" aria-modal="true" aria-label="Pełny podgląd zadania">
            <div className="flex justify-between items-center mb-2">
              <h2 className="card-title mb-0">{title || 'Podgląd zadania'}</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowFullPreview(false)} aria-label="Zamknij podgląd">
                <X size={16} aria-hidden="true" /> Zamknij
              </button>
            </div>
            <div className="preview-box prose">
              {renderParameterized(content, parameters)}
              {taskType === 'closed' && choices.length > 0 && (
                <ol style={{ marginTop: 12, paddingLeft: 0, listStyle: 'none' }}>
                  {choices.map((c, i) => (
                    <li key={c.id} style={{ marginTop: 4 }}>
                      <strong>{String.fromCharCode(97 + i)})</strong> {renderParameterized(c.content, parameters)}
                    </li>
                  ))}
                </ol>
              )}
            </div>
          </div>
        </div>
      )}

      {showMobilePreview && (
        <>
          <div className="drawer-backdrop" onClick={() => setShowMobilePreview(false)} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Podgląd zadania">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-header">
              <h3 className="card-title mb-0">Podgląd</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={() => setShowMobilePreview(false)}>Zamknij</button>
            </div>
            <div className="sheet-body">
              {title && <strong className="text-sm">{title}</strong>}
              <div className="preview-box mt-1">
                {renderParameterized(content, parameters) || 'Brak treści.'}
                {taskType === 'closed' && choices.length > 0 && (
                  <ol style={{ marginTop: 8, paddingLeft: 0, listStyle: 'none' }}>
                    {choices.map((c, i) => (
                      <li key={c.id} style={{ marginTop: 2 }}>
                        <strong>{String.fromCharCode(97 + i)})</strong> {renderParameterized(c.content, parameters)}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
