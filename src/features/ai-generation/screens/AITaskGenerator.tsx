import { useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import {
  Sparkles,
  GraduationCap,
  FolderTree,
  X,
  Loader2,
  AlertTriangle,
  RefreshCw,
  ChevronDown,
  ChevronRight,
} from 'lucide-react'
import { generateChat } from '../services/openrouter'
import { buildTree, descendantIds, findNode, pathLabel } from '@features/categories'
import { useSettings } from '@shared/hooks/useSettings'
import { toast } from '@shared/hooks/useToast'
import db from '@shared/services/db'
import type { AnswerKeyItem, SchoolLevel, Task, TaskSpecification } from '@shared/types'

import AIDraftResults from '../components/AIDraftResults'
import AIHeaderCards from '../components/AIHeaderCards'
import AIPickers from '../components/AIPickers'
import {
  DEFAULT_SYSTEM_PROMPT_FALLBACK,
  SUBJECTS,
  buildUserPromptForSingle,
  parseSingleDraft,
  type DraftTask,
} from '../services/draftTasks'

interface Props {
  onOpenSettings: () => void
}

export default function AITaskGenerator({ onOpenSettings }: Props) {
  const { settings } = useSettings()
  const programPoints = useLiveQuery(() => db.programPoints.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])

  const [selectedPP, setSelectedPP] = useState<Set<string>>(new Set())
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [ppPickerOpen, setPpPickerOpen] = useState(false)
  const [catPickerOpen, setCatPickerOpen] = useState(false)

  const [subject, setSubject] = useState<string>('Fizyka')
  const [level, setLevel] = useState<SchoolLevel>('ponadpodstawowa')
  const [klasa, setKlasa] = useState<string>('1')
  const [count, setCount] = useState<number>(3)
  const [difficulty, setDifficulty] = useState<'łatwe' | 'średnie' | 'trudne' | 'mieszane'>(
    'średnie',
  )
  const [withParameters, setWithParameters] = useState(true)
  const [extraInstructions, setExtraInstructions] = useState('')
  const [showAdvanced, setShowAdvanced] = useState(false)

  const [generating, setGenerating] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [drafts, setDrafts] = useState<DraftTask[]>([])
  /** How many of the N parallel requests have finished (success or fail). */
  const [progressDone, setProgressDone] = useState(0)
  const abortRef = useRef<AbortController | null>(null)

  const togglePP = (id: string) => {
    setSelectedPP((prev) => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }
  const clearPP = () => setSelectedPP(new Set())
  const removeCategory = (id: string) =>
    setSelectedCategories((prev) => prev.filter((x) => x !== id))

  const ppDetailed = useMemo(() => {
    if (selectedPP.size === 0 || !programPoints) return []
    return programPoints.filter((p) => selectedPP.has(p.id))
  }, [programPoints, selectedPP])

  const categoriesDetailed = useMemo(() => {
    if (selectedCategories.length === 0 || !categories) return []
    const ids = new Set(selectedCategories)
    return categories.filter((c) => ids.has(c.id))
  }, [categories, selectedCategories])

  const taskCountByPpId = useMemo(() => new Map<string, number>(), [])

  // For category picker — also include descendants when summarizing
  const categoryPathsForPrompt = useMemo(() => {
    if (!categories || selectedCategories.length === 0) return []
    const tree = buildTree(categories)
    return selectedCategories.map((id) => {
      const node = findNode(tree, id)
      const childCount = node ? descendantIds(node).length : 0
      return { id, path: pathLabel(categories, id), childCount }
    })
  }, [categories, selectedCategories])

  const handleGenerate = async () => {
    if (!settings.openrouterApiKey) {
      toast.error({
        title: 'Brak klucza API',
        description: 'Dodaj klucz OpenRouter w Ustawieniach.',
      })
      onOpenSettings()
      return
    }
    if (selectedPP.size === 0 && selectedCategories.length === 0) {
      toast.error({
        title: 'Wybierz zakres',
        description: 'Zaznacz punkty podstawy lub kategorie, do których AI ma wygenerować zadania.',
      })
      return
    }

    setGenerating(true)
    setError(null)
    setDrafts([])
    setProgressDone(0)
    abortRef.current = new AbortController()
    const systemPrompt = settings.aiSystemPrompt?.trim() || DEFAULT_SYSTEM_PROMPT_FALLBACK
    const failures: string[] = []
    // Collected locally — we only `setDrafts` ONCE at the end so the user
    // sees the full batch appear in one go instead of cards popping in
    // one by one. The slot index keeps original task order even though
    // requests finish in arbitrary completion order.
    const collected: (DraftTask | null)[] = new Array(count).fill(null)

    // Run a single task with one retry on transient failures: empty body
    // or `finish_reason: 'length'` (response cut off mid-JSON). The
    // retry doubles maxTokens once to fit longer outputs.
    const runOne = async (i: number): Promise<string> => {
      const userPrompt = buildUserPromptForSingle({
        index: i,
        total: count,
        subject,
        level,
        klasa,
        difficulty,
        withParameters,
        ppDetailed,
        categoryPathsForPrompt,
        extraInstructions,
      })
      let lastErr: unknown
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
          })
          // If the model was truncated, try again with more headroom.
          if (result.finishReason === 'length' && attempt === 0) {
            lastErr = new Error('Odpowiedź obcięta — ponawiam z większym limitem.')
            continue
          }
          collected[i] = parseSingleDraft(result.content, i)
          return result.model
        } catch (err) {
          lastErr = err
          if ((err as Error).name === 'AbortError') throw err
          // Retry on parse / empty-body errors. Other HTTP errors also
          // retry once — transient OpenRouter glitches are common.
          if (attempt === 0) continue
        }
      }
      throw lastErr ?? new Error('Nie udało się wygenerować zadania.')
    }

    // Concurrency-limited worker pool. 10 simultaneous requests to a
    // single OpenRouter model tend to trip provider rate limits and
    // return empty bodies; 3 at a time is the sweet spot — still much
    // faster than serial, but reliable across providers.
    const CONCURRENCY = 3
    const results: PromiseSettledResult<string>[] = new Array(count)
    let next = 0
    await Promise.all(
      Array.from({ length: Math.min(CONCURRENCY, count) }, async () => {
        while (true) {
          const i = next++
          if (i >= count) return
          try {
            results[i] = { status: 'fulfilled', value: await runOne(i) }
          } catch (err) {
            results[i] = { status: 'rejected', reason: err }
            if ((err as Error).name !== 'AbortError') {
              failures.push(`Zadanie ${i + 1}: ${err instanceof Error ? err.message : String(err)}`)
            }
          } finally {
            setProgressDone((n) => n + 1)
          }
        }
      }),
    )

    // Reveal the whole batch at once (drops nulls from failed slots so the
    // surviving tasks keep their original prompt order).
    setDrafts(collected.filter((d): d is DraftTask => d !== null))

    const okCount = results.filter((r) => r.status === 'fulfilled').length
    const aborted = results.some(
      (r) => r.status === 'rejected' && (r.reason as Error)?.name === 'AbortError',
    )

    if (aborted) {
      toast.info({
        title: 'Anulowano generowanie',
        description: okCount > 0 ? `Zachowano ${okCount} ukończonych zadań.` : undefined,
      })
    } else if (okCount === 0) {
      const msg = failures[0] || 'Model nie zwrócił żadnego zadania.'
      setError(failures.join('\n'))
      toast.error({ title: 'Błąd generowania', description: msg })
    } else if (failures.length > 0) {
      setError(failures.join('\n'))
      toast.info({
        title: `Wygenerowano ${okCount} z ${count}`,
        description: `${failures.length} ${failures.length === 1 ? 'zadanie nie powiodło się' : 'zadań nie powiodło się'}.`,
      })
    } else {
      const modelName = results.find((r) => r.status === 'fulfilled')?.value as string | undefined
      toast.success({
        title: `Wygenerowano ${okCount} ${okCount === 1 ? 'zadanie' : okCount < 5 ? 'zadania' : 'zadań'}`,
        description: modelName,
      })
    }
    setGenerating(false)
    abortRef.current = null
  }

  const handleCancel = () => {
    abortRef.current?.abort()
  }

  const saveDraft = async (draft: DraftTask) => {
    const now = Date.now()
    const id = `task-${now}-${Math.random().toString(36).slice(2, 6)}`
    const answerKey: AnswerKeyItem[] = draft.answerKey.map((a, i) => ({
      id: `ans-${now}-${i}`,
      answer: a.answer,
      points: a.points,
      explanation: a.explanation,
    }))
    const spec: TaskSpecification = {
      answerKeyMethod: draft.specification?.method ?? '',
      answerKeyAnswer: draft.specification?.answer ?? '',
      answerKeyConclusions: draft.specification?.conclusions ?? '',
    }
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
    }
    await db.tasks.add(task)
    setDrafts((prev) => prev.map((d) => (d.id === draft.id ? { ...d, saved: true } : d)))
    toast.success({ title: 'Zapisano zadanie', description: draft.title })
  }

  const saveAllDrafts = async () => {
    for (const d of drafts) {
      if (!d.saved) await saveDraft(d)
    }
  }

  const discardDraft = (id: string) => {
    setDrafts((prev) => prev.filter((d) => d.id !== id))
  }

  const hasKey = !!settings.openrouterApiKey

  return (
    <div className="max-w-980">
      <div className="flex items-center gap-1 mb-3">
        <Sparkles size={26} aria-hidden="true" className="color-accent" />
        <h1 className="page-h1">Generuj zadania AI</h1>
      </div>

      <AIHeaderCards
        hasKey={hasKey}
        model={settings.openrouterModel}
        modelLabel={settings.openrouterModelLabel}
        onOpenSettings={onOpenSettings}
      />

      <section className="card mb-2">
        <div className="section-header">
          <span className="section-no">1</span>
          <h3>Zakres tematyczny</h3>
        </div>
        <p className="text-muted text-sm mb-2 prose">
          Wybierz przynajmniej jedno: punkty podstawy programowej lub kategorie. Wszystko, co
          zaznaczysz, trafi do promptu jako zakres tematyczny generowanych zadań.
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
              <span className="badge badge-on-primary">{selectedPP.size}</span>
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
              <span className="badge badge-on-primary">{selectedCategories.length}</span>
            )}
          </button>
        </div>

        {(ppDetailed.length > 0 || categoriesDetailed.length > 0) && (
          <div className="flex gap-1 wrap items-center mt-1">
            {ppDetailed.length > 0 && (
              <>
                <span className="text-xs text-muted">Podstawa:</span>
                {ppDetailed.map((pp) => (
                  <button
                    key={pp.id}
                    type="button"
                    className="badge badge-primary badge-action"
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
                <span
                  className="text-xs text-muted"
                  data-spaced={ppDetailed.length > 0 || undefined}
                >
                  Kategorie:
                </span>
                {categoriesDetailed.map((cat) => (
                  <button
                    key={cat.id}
                    type="button"
                    className="badge badge-primary badge-action"
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

      <section className="card mb-2">
        <div className="section-header">
          <span className="section-no">2</span>
          <h3>Parametry generowania</h3>
        </div>
        <div className="form-row">
          <div className="form-group mb-0">
            <label htmlFor="ai-subject">Przedmiot</label>
            <select id="ai-subject" value={subject} onChange={(e) => setSubject(e.target.value)}>
              {SUBJECTS.map((s) => (
                <option key={s}>{s}</option>
              ))}
            </select>
          </div>
          <div className="form-group mb-0">
            <label htmlFor="ai-level">Poziom</label>
            <select
              id="ai-level"
              value={level}
              onChange={(e) => setLevel(e.target.value as SchoolLevel)}
            >
              <option value="podstawowa">Szkoła podstawowa</option>
              <option value="ponadpodstawowa">Liceum / technikum</option>
            </select>
          </div>
          <div className="form-group mb-0">
            <label htmlFor="ai-class">Klasa</label>
            <input
              id="ai-class"
              value={klasa}
              onChange={(e) => setKlasa(e.target.value)}
              placeholder="np. 7"
            />
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
            <select
              id="ai-difficulty"
              value={difficulty}
              onChange={(e) => setDifficulty(e.target.value as typeof difficulty)}
            >
              <option value="łatwe">Łatwe</option>
              <option value="średnie">Średnie</option>
              <option value="trudne">Trudne</option>
              <option value="mieszane">Mieszane</option>
            </select>
          </div>
        </div>
        <label className="flex items-center gap-1 label-plain">
          <input
            type="checkbox"
            className="icon-16"
            checked={withParameters}
            onChange={(e) => setWithParameters(e.target.checked)}
          />
          Każde zadanie ma zawierać liczby i jednostki (do późniejszej parametryzacji)
        </label>

        <button
          type="button"
          className="btn btn-ghost btn-sm mt-1"
          onClick={() => setShowAdvanced(!showAdvanced)}
          aria-expanded={showAdvanced}
        >
          {showAdvanced ? (
            <ChevronDown size={14} aria-hidden="true" />
          ) : (
            <ChevronRight size={14} aria-hidden="true" />
          )}
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
            <Sparkles size={16} aria-hidden="true" /> Generuj {count}{' '}
            {count === 1 ? 'zadanie' : count < 5 ? 'zadania' : 'zadań'}
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
              ? `${progressDone}/${count} ukończonych — model może odpowiadać do 90 s na zadanie`
              : 'Model myśli (do 90 s)…'}
          </span>
        )}
      </div>

      {error && (
        <div role="alert" className="card card-danger mb-2 flex items-center gap-1">
          <AlertTriangle size={16} aria-hidden="true" /> {error}
          <button type="button" className="btn btn-ghost btn-sm" onClick={handleGenerate}>
            <RefreshCw size={14} aria-hidden="true" /> Spróbuj ponownie
          </button>
        </div>
      )}

      <AIDraftResults
        drafts={drafts}
        onSaveAll={saveAllDrafts}
        onSave={saveDraft}
        onDiscard={discardDraft}
      />

      <AIPickers
        ppPickerOpen={ppPickerOpen}
        catPickerOpen={catPickerOpen}
        programPoints={programPoints}
        categories={categories}
        selectedPP={selectedPP}
        selectedCategories={selectedCategories}
        taskCountByPpId={taskCountByPpId}
        onClosePP={() => setPpPickerOpen(false)}
        onCloseCategories={() => setCatPickerOpen(false)}
        onTogglePP={togglePP}
        onClearPP={clearPP}
        onCategoriesChange={setSelectedCategories}
      />
    </div>
  )
}
