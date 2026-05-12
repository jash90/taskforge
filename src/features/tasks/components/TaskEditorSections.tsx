import { GripVertical, Maximize2, Plus, Trash2, Wand2, X } from 'lucide-react'

import { CategoryPicker } from '@features/categories'
import { renderParameterized } from '../utils/parameters'
import type {
  AnswerKeyItem,
  Category,
  ProgramPoint,
  Task,
  TaskChoice,
  TaskParameter,
  TaskSpecification,
  TaskType,
} from '@shared/types'

import SectionProgramBase from './editor/SectionProgramBase'

const SUBJECTS = [
  'Matematyka',
  'Fizyka',
  'Chemia',
  'Biologia',
  'Informatyka',
  'Język polski',
  'Historia',
  'Geografia',
]

interface ContentSectionProps {
  title: string
  content: string
  errors: { title?: boolean; content?: boolean }
  onTitleChange: (value: string) => void
  onContentChange: (value: string) => void
  onAutoDetect: () => void
  onOpenPreview: () => void
}

export function ContentSection({
  title,
  content,
  errors,
  onTitleChange,
  onContentChange,
  onAutoDetect,
  onOpenPreview,
}: ContentSectionProps) {
  return (
    <section id="sec-content" className="card editor-section">
      <div className="section-header">
        <span className="section-no">1</span>
        <h3>Treść zadania</h3>
      </div>
      <div className="form-group">
        <label htmlFor="task-title">
          Tytuł{' '}
          <span className="color-danger" aria-hidden="true">
            *
          </span>
        </label>
        <input
          id="task-title"
          className={errors.title ? 'invalid' : ''}
          value={title}
          onChange={(e) => onTitleChange(e.target.value)}
          placeholder="np. Ruch jednostajny prostoliniowy"
          aria-invalid={errors.title ? 'true' : undefined}
          required
        />
        {errors.title && (
          <div className="field-error" role="alert">
            Tytuł jest wymagany.
          </div>
        )}
      </div>
      <div className="form-group mb-0">
        <label htmlFor="task-content">
          Treść{' '}
          <span className="color-danger" aria-hidden="true">
            *
          </span>
        </label>
        <textarea
          id="task-content"
          className={errors.content ? 'invalid' : ''}
          value={content}
          onChange={(e) => onContentChange(e.target.value)}
          placeholder="Samochód jedzie z prędkością 20 km/h. Jaką drogę przebędzie w ciągu 3 godzin?"
          rows={6}
          aria-invalid={errors.content ? 'true' : undefined}
          required
        />
        {errors.content && (
          <div className="field-error" role="alert">
            Treść jest wymagana.
          </div>
        )}
        <div className="flex gap-1 mt-1">
          <button type="button" className="btn btn-secondary btn-sm" onClick={onAutoDetect}>
            <Wand2 size={14} aria-hidden="true" /> Wykryj parametry w treści
          </button>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenPreview}>
            <Maximize2 size={14} aria-hidden="true" /> Podgląd
          </button>
        </div>
      </div>
    </section>
  )
}

interface MetaSectionProps {
  taskType: TaskType
  subject: string
  level: Task['level']
  cls: string
  onTaskTypeChange: (value: TaskType) => void
  onSubjectChange: (value: string) => void
  onLevelChange: (value: Task['level']) => void
  onClassChange: (value: string) => void
}

export function MetaSection({
  taskType,
  subject,
  level,
  cls,
  onTaskTypeChange,
  onSubjectChange,
  onLevelChange,
  onClassChange,
}: MetaSectionProps) {
  return (
    <section id="sec-meta" className="editor-section editor-toolbar">
      <div className="form-group">
        <label htmlFor="task-type">Typ</label>
        <select
          id="task-type"
          value={taskType}
          onChange={(e) => onTaskTypeChange(e.target.value as TaskType)}
        >
          <option value="open">Otwarte</option>
          <option value="closed">Zamknięte (ABCD)</option>
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="task-subject">Przedmiot</label>
        <select id="task-subject" value={subject} onChange={(e) => onSubjectChange(e.target.value)}>
          {SUBJECTS.map((s) => (
            <option key={s}>{s}</option>
          ))}
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="task-level">Poziom</label>
        <select
          id="task-level"
          value={level}
          onChange={(e) => onLevelChange(e.target.value as Task['level'])}
        >
          <option value="podstawowa">Szkoła podstawowa</option>
          <option value="ponadpodstawowa">Liceum / technikum</option>
        </select>
      </div>
      <div className="form-group">
        <label htmlFor="task-class">Klasa</label>
        <input
          id="task-class"
          value={cls}
          onChange={(e) => onClassChange(e.target.value)}
          placeholder="np. 7"
        />
      </div>
    </section>
  )
}

interface ParametersSectionProps {
  parameters: TaskParameter[]
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<TaskParameter>) => void
  onRemove: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
}

export function ParametersSection({
  parameters,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
}: ParametersSectionProps) {
  return (
    <section id="sec-params" className="card editor-section">
      <div className="section-header">
        <span className="section-no">2</span>
        <h3>Parametry</h3>
        <span className="grow" />
        {parameters.length > 0 && <span className="badge badge-primary">{parameters.length}</span>}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAdd}>
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
                <th className="col-w-28">
                  <span className="sr-only">Kolejność</span>
                </th>
                <th>Nazwa</th>
                <th className="col-w-120">Typ</th>
                <th className="col-w-80">Min</th>
                <th className="col-w-80">Max</th>
                <th className="col-w-80">Krok</th>
                <th className="col-w-90">Jednostka</th>
                <th className="col-w-90">Wartość</th>
                <th className="col-w-36">
                  <span className="sr-only">Usuń</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {parameters.map((p, idx) => {
                const isNumeric = p.type === 'integer' || p.type === 'number'
                return (
                  <tr key={p.id}>
                    <td>
                      <button
                        type="button"
                        className="btn btn-ghost btn-icon btn-icon-xs"
                        aria-label={`Przesuń parametr ${p.name} w górę`}
                        onClick={() => onMove(p.id, -1)}
                        disabled={idx === 0}
                      >
                        <GripVertical size={12} aria-hidden="true" />
                      </button>
                    </td>
                    <td>
                      <input
                        className="tbl-input"
                        value={p.name}
                        onChange={(e) => onUpdate(p.id, { name: e.target.value })}
                        placeholder="Nazwa"
                      />
                    </td>
                    <td>
                      <select
                        className="tbl-input"
                        value={p.type}
                        onChange={(e) =>
                          onUpdate(p.id, { type: e.target.value as TaskParameter['type'] })
                        }
                      >
                        <option value="integer">Całkowita</option>
                        <option value="number">Dziesiętna</option>
                        <option value="text">Tekst</option>
                        <option value="choice">Wybór</option>
                      </select>
                    </td>
                    {isNumeric ? (
                      <>
                        <td>
                          <input
                            className="tbl-input"
                            type="number"
                            inputMode="decimal"
                            value={p.min ?? ''}
                            onChange={(e) => onUpdate(p.id, { min: parseFloat(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            className="tbl-input"
                            type="number"
                            inputMode="decimal"
                            value={p.max ?? ''}
                            onChange={(e) => onUpdate(p.id, { max: parseFloat(e.target.value) })}
                          />
                        </td>
                        <td>
                          <input
                            className="tbl-input"
                            type="number"
                            inputMode="decimal"
                            value={p.step ?? ''}
                            onChange={(e) => onUpdate(p.id, { step: parseFloat(e.target.value) })}
                          />
                        </td>
                      </>
                    ) : (
                      <td colSpan={3} className="text-muted text-sm text-center">
                        —
                      </td>
                    )}
                    <td>
                      <input
                        className="tbl-input"
                        value={p.unit || ''}
                        onChange={(e) => onUpdate(p.id, { unit: e.target.value })}
                        placeholder="np. km/h"
                      />
                    </td>
                    <td>
                      <input
                        className="tbl-input"
                        value={
                          typeof p.value === 'number' ? String(p.value).replace('.', ',') : p.value
                        }
                        onChange={(e) => {
                          const v = e.target.value.replace(',', '.')
                          const num = parseFloat(v)
                          onUpdate(p.id, { value: isNaN(num) ? v : num })
                        }}
                      />
                    </td>
                    <td>
                      <button
                        type="button"
                        className="btn btn-danger-soft btn-icon"
                        onClick={() => onRemove(p.id)}
                        aria-label={`Usuń parametr ${p.name}`}
                      >
                        <Trash2 size={14} aria-hidden="true" />
                      </button>
                    </td>
                  </tr>
                )
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  )
}

interface AnswersSectionProps {
  answerKey: AnswerKeyItem[]
  totalPoints: number
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<AnswerKeyItem>) => void
  onRemove: (id: string) => void
}

export function AnswersSection({
  answerKey,
  totalPoints,
  onAdd,
  onUpdate,
  onRemove,
}: AnswersSectionProps) {
  return (
    <section id="sec-answers" className="card editor-section">
      <div className="section-header">
        <span className="section-no">3</span>
        <h3>Klucz odpowiedzi</h3>
        <span className="grow" />
        {totalPoints > 0 && <span className="badge badge-success">{totalPoints} pkt</span>}
        <button type="button" className="btn btn-secondary btn-sm" onClick={onAdd}>
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
                <th className="col-w-36">Lp.</th>
                <th>Odpowiedź</th>
                <th className="col-w-90">Punkty</th>
                <th>Wyjaśnienie</th>
                <th className="col-w-36">
                  <span className="sr-only">Usuń</span>
                </th>
              </tr>
            </thead>
            <tbody>
              {answerKey.map((a, i) => (
                <tr key={a.id}>
                  <td className="text-muted text-sm text-center">{i + 1}</td>
                  <td>
                    <input
                      className="tbl-input"
                      value={a.answer}
                      onChange={(e) => onUpdate(a.id, { answer: e.target.value })}
                      placeholder="Poprawna odpowiedź"
                    />
                  </td>
                  <td>
                    <input
                      className="tbl-input"
                      type="number"
                      inputMode="decimal"
                      value={a.points}
                      onChange={(e) => onUpdate(a.id, { points: parseFloat(e.target.value) || 0 })}
                    />
                  </td>
                  <td>
                    <input
                      className="tbl-input"
                      value={a.explanation || ''}
                      onChange={(e) => onUpdate(a.id, { explanation: e.target.value })}
                      placeholder="Opcjonalnie"
                    />
                  </td>
                  <td>
                    <button
                      type="button"
                      className="btn btn-danger-soft btn-icon"
                      onClick={() => onRemove(a.id)}
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
  )
}

interface ChoicesSectionProps {
  choices: TaskChoice[]
  totalPoints: number
  hasAnyCorrectChoice: boolean
  shuffleChoices: boolean
  onAdd: () => void
  onUpdate: (id: string, patch: Partial<TaskChoice>) => void
  onRemove: (id: string) => void
  onMove: (id: string, dir: -1 | 1) => void
  onShuffleChange: (value: boolean) => void
}

export function ChoicesSection({
  choices,
  totalPoints,
  hasAnyCorrectChoice,
  shuffleChoices,
  onAdd,
  onUpdate,
  onRemove,
  onMove,
  onShuffleChange,
}: ChoicesSectionProps) {
  return (
    <section id="sec-choices" className="card editor-section">
      <div className="section-header">
        <span className="section-no">3</span>
        <h3>Warianty odpowiedzi (ABCD)</h3>
        <span className="grow" />
        {totalPoints > 0 && <span className="badge badge-success">{totalPoints} pkt</span>}
        <button
          type="button"
          className="btn btn-secondary btn-sm"
          onClick={onAdd}
          disabled={choices.length >= 6}
          title={choices.length >= 6 ? 'Maks. 6 wariantów' : undefined}
        >
          <Plus size={14} aria-hidden="true" /> Dodaj
        </button>
      </div>
      <p className="text-muted text-sm mb-1">
        Min. 2, maks. 6 wariantów. W treści wariantu możesz użyć placeholderów{' '}
        <code>{'{{paramId}}'}</code> z parametrów lub liczb, które zostaną automatycznie wykryte i
        podstawione podczas losowania.
      </p>
      <div className="param-table-wrap">
        <table className="param-table">
          <thead>
            <tr>
              <th className="col-w-28">
                <span className="sr-only">Kolejność</span>
              </th>
              <th className="col-w-36">Lit.</th>
              <th>Treść wariantu</th>
              <th className="col-w-90">Poprawna</th>
              <th className="col-w-80">Punkty</th>
              <th>Wyjaśnienie</th>
              <th className="col-w-36">
                <span className="sr-only">Usuń</span>
              </th>
            </tr>
          </thead>
          <tbody>
            {choices.map((c, i) => (
              <tr key={c.id}>
                <td>
                  <button
                    type="button"
                    className="btn btn-ghost btn-icon btn-icon-xs"
                    aria-label={`Przesuń wariant ${String.fromCharCode(97 + i)} w górę`}
                    onClick={() => onMove(c.id, -1)}
                    disabled={i === 0}
                  >
                    <GripVertical size={12} aria-hidden="true" />
                  </button>
                </td>
                <td className="text-muted text-sm text-center font-semibold">
                  {String.fromCharCode(97 + i)})
                </td>
                <td>
                  <input
                    className="tbl-input"
                    value={c.content}
                    onChange={(e) => onUpdate(c.id, { content: e.target.value })}
                    placeholder="Treść wariantu"
                  />
                </td>
                <td className="text-center">
                  <input
                    type="checkbox"
                    checked={c.isCorrect}
                    onChange={(e) => {
                      const next = e.target.checked
                      onUpdate(c.id, {
                        isCorrect: next,
                        points: next ? (c.points && c.points > 0 ? c.points : 1) : 0,
                      })
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
                    onChange={(e) => onUpdate(c.id, { points: parseFloat(e.target.value) || 0 })}
                  />
                </td>
                <td>
                  <input
                    className="tbl-input"
                    value={c.explanation || ''}
                    onChange={(e) => onUpdate(c.id, { explanation: e.target.value })}
                    placeholder="Opcjonalnie"
                  />
                </td>
                <td>
                  <button
                    type="button"
                    className="btn btn-danger-soft btn-icon"
                    onClick={() => onRemove(c.id)}
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
          onChange={(e) => onShuffleChange(e.target.checked)}
        />
        <label htmlFor="shuffle-choices" className="text-sm label-inline">
          Losuj kolejność wariantów podczas generowania
        </label>
      </div>
      {!hasAnyCorrectChoice && choices.length > 0 && (
        <p className="field-error mt-1" role="alert">
          Zaznacz co najmniej jeden wariant jako poprawny.
        </p>
      )}
    </section>
  )
}

interface SpecificationSectionProps {
  spec: TaskSpecification
  onChange: (patch: Partial<TaskSpecification>) => void
}

export function SpecificationSection({ spec, onChange }: SpecificationSectionProps) {
  return (
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
            onChange={(e) => onChange({ answerKeyMethod: e.target.value })}
            rows={5}
            placeholder="Opisz metodę rozwiązania krok po kroku…"
          />
        </div>
        <div>
          <div className="form-group">
            <label htmlFor="spec-answer">Odpowiedź</label>
            <textarea
              id="spec-answer"
              value={spec.answerKeyAnswer}
              onChange={(e) => onChange({ answerKeyAnswer: e.target.value })}
              rows={2}
              placeholder="Podaj poprawną odpowiedź…"
            />
          </div>
          <div className="form-group mb-0">
            <label htmlFor="spec-conclusions">Wnioski</label>
            <textarea
              id="spec-conclusions"
              value={spec.answerKeyConclusions}
              onChange={(e) => onChange({ answerKeyConclusions: e.target.value })}
              rows={2}
              placeholder="Wnioski, ciekawostki lub komentarze…"
            />
          </div>
        </div>
      </div>
    </section>
  )
}

interface TaxonomySectionsProps {
  level: Task['level']
  cls: string
  selectedPP: string[]
  programPoints: ProgramPoint[] | undefined
  categories: Category[] | undefined
  selectedCategories: string[]
  onTogglePP: (id: string) => void
  onLevelChange: (value: Task['level']) => void
  onClassChange: (value: string) => void
  onCategoriesChange: (value: string[]) => void
  tags: string
  onTagsChange: (value: string) => void
}

export function TaxonomySections({
  level,
  cls,
  selectedPP,
  programPoints,
  categories,
  selectedCategories,
  onTogglePP,
  onLevelChange,
  onClassChange,
  onCategoriesChange,
  tags,
  onTagsChange,
}: TaxonomySectionsProps) {
  return (
    <>
      <section id="sec-program" className="card editor-section">
        <div className="section-header">
          <span className="section-no">5</span>
          <h3>Podstawa programowa</h3>
          <span className="text-faint text-sm ml-auto">opcjonalne</span>
        </div>
        <SectionProgramBase
          level={level}
          cls={cls}
          selectedIds={selectedPP}
          programPoints={programPoints}
          onToggle={onTogglePP}
          onLevelChange={onLevelChange}
          onClassChange={onClassChange}
        />
      </section>
      <section id="sec-categories" className="card editor-section">
        <div className="section-header">
          <span className="section-no">6</span>
          <h3>Kategorie</h3>
          <span className="text-faint text-sm ml-auto">opcjonalne</span>
        </div>
        <CategoryPicker
          categories={categories || []}
          selectedIds={selectedCategories}
          onChange={onCategoriesChange}
        />
      </section>
      <section id="sec-tags" className="card editor-section">
        <div className="section-header">
          <span className="section-no">7</span>
          <h3>Tagi</h3>
        </div>
        <div className="form-group mb-0">
          <label htmlFor="task-tags">Tagi (oddzielone przecinkami)</label>
          <input
            id="task-tags"
            value={tags}
            onChange={(e) => onTagsChange(e.target.value)}
            placeholder="np. ruch, prędkość, zadanie tekstowe"
          />
        </div>
      </section>
    </>
  )
}

interface PreviewModalsProps {
  title: string
  content: string
  parameters: TaskParameter[]
  taskType: TaskType
  choices: TaskChoice[]
  showFullPreview: boolean
  showMobilePreview: boolean
  onCloseFull: () => void
  onCloseMobile: () => void
}

export function PreviewModals({
  title,
  content,
  parameters,
  taskType,
  choices,
  showFullPreview,
  showMobilePreview,
  onCloseFull,
  onCloseMobile,
}: PreviewModalsProps) {
  return (
    <>
      {showFullPreview && (
        <div className="overlay" onMouseDown={onCloseFull} role="presentation">
          <div
            className="overlay-content"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-label="Pełny podgląd zadania"
          >
            <div className="flex justify-between items-center mb-2">
              <h2 className="card-title mb-0">{title || 'Podgląd zadania'}</h2>
              <button
                type="button"
                className="btn btn-ghost btn-sm"
                onClick={onCloseFull}
                aria-label="Zamknij podgląd"
              >
                <X size={16} aria-hidden="true" /> Zamknij
              </button>
            </div>
            <div className="preview-box prose">
              {renderParameterized(content, parameters)}
              {taskType === 'closed' && choices.length > 0 && (
                <ol className="preview-list">
                  {choices.map((c, i) => (
                    <li key={c.id}>
                      <strong>{String.fromCharCode(97 + i)})</strong>{' '}
                      {renderParameterized(c.content, parameters)}
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
          <div className="drawer-backdrop" onClick={onCloseMobile} />
          <div className="sheet" role="dialog" aria-modal="true" aria-label="Podgląd zadania">
            <div className="sheet-handle" aria-hidden="true" />
            <div className="sheet-header">
              <h3 className="card-title mb-0">Podgląd</h3>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onCloseMobile}>
                Zamknij
              </button>
            </div>
            <div className="sheet-body">
              {title && <strong className="text-sm">{title}</strong>}
              <div className="preview-box mt-1">
                {renderParameterized(content, parameters) || 'Brak treści.'}
                {taskType === 'closed' && choices.length > 0 && (
                  <ol className="preview-list is-tight">
                    {choices.map((c, i) => (
                      <li key={c.id}>
                        <strong>{String.fromCharCode(97 + i)})</strong>{' '}
                        {renderParameterized(c.content, parameters)}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          </div>
        </>
      )}
    </>
  )
}
