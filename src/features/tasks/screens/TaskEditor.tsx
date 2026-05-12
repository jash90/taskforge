import { useCallback, useEffect, useMemo, useRef, useState } from 'react'
import { useLiveQuery } from 'dexie-react-hooks'
import { copyAsWord } from '@features/export-import'
import { detectParameters } from '../utils/parameters'
import { useShortcuts } from '@shared/hooks/useShortcuts'
import { toast } from '@shared/hooks/useToast'
import db from '@shared/services/db'
import type {
  AnswerKeyItem,
  Task,
  TaskChoice,
  TaskParameter,
  TaskSpecification,
  TaskType,
} from '@shared/types'

import EditorOutline, { type OutlineEntry } from '../components/editor/EditorOutline'
import EditorPreview from '../components/editor/EditorPreview'
import EditorSaveBar from '../components/editor/EditorSaveBar'
import {
  AnswersSection,
  ChoicesSection,
  ContentSection,
  MetaSection,
  ParametersSection,
  PreviewModals,
  SpecificationSection,
  TaxonomySections,
} from '../components/TaskEditorSections'

interface Props {
  task: Task | null
  onSaved: () => void
  onCancel: () => void
}

const emptySpec: TaskSpecification = {
  answerKeyMethod: '',
  answerKeyAnswer: '',
  answerKeyConclusions: '',
}

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

export default function TaskEditor({ task, onSaved, onCancel }: Props) {
  const programPoints = useLiveQuery(() => db.programPoints.toArray(), [])
  const categories = useLiveQuery(() => db.categories.toArray(), [])
  const paneRef = useRef<HTMLDivElement>(null)
  const scrollContainer =
    typeof document !== 'undefined'
      ? (document.querySelector('.app-main') as HTMLElement | null)
      : null

  const [title, setTitle] = useState('')
  const [content, setContent] = useState('')
  const [subject, setSubject] = useState<string>(SUBJECTS[0])
  const [level, setLevel] = useState<Task['level']>('podstawowa')
  const [cls, setCls] = useState('7')
  const [selectedPP, setSelectedPP] = useState<string[]>([])
  const [selectedCategories, setSelectedCategories] = useState<string[]>([])
  const [parameters, setParameters] = useState<TaskParameter[]>([])
  const [answerKey, setAnswerKey] = useState<AnswerKeyItem[]>([])
  const [spec, setSpec] = useState<TaskSpecification>(emptySpec)
  const [tags, setTags] = useState('')
  const [taskType, setTaskType] = useState<TaskType>('open')
  const [choices, setChoices] = useState<TaskChoice[]>([])
  const [shuffleChoices, setShuffleChoices] = useState(false)
  const [dirty, setDirty] = useState(false)
  const [saving, setSaving] = useState(false)
  const [showFullPreview, setShowFullPreview] = useState(false)
  const [showMobilePreview, setShowMobilePreview] = useState(false)
  const [errors, setErrors] = useState<{ title?: boolean; content?: boolean }>({})

  // Hydrate from task / reset on switch
  useEffect(() => {
    if (task) {
      setTitle(task.title)
      setContent(task.content)
      setSubject(task.subject)
      setLevel(task.level)
      setCls(task.class)
      setSelectedPP(task.programPoints)
      setSelectedCategories(task.categories ?? [])
      setParameters(task.parameters)
      setAnswerKey(task.answerKey)
      setSpec(task.specification)
      setTags(task.tags.join(', '))
      setTaskType(task.taskType ?? 'open')
      setChoices(task.choices ?? [])
      setShuffleChoices(task.shuffleChoices ?? false)
    } else {
      setTitle('')
      setContent('')
      setSubject(SUBJECTS[0])
      setLevel('podstawowa')
      setCls('7')
      setSelectedPP([])
      setSelectedCategories([])
      setParameters([])
      setAnswerKey([])
      setSpec(emptySpec)
      setTags('')
      setTaskType('open')
      setChoices([])
      setShuffleChoices(false)
    }
    setDirty(false)
    setErrors({})
  }, [task])

  // Mark dirty on any field change after hydration
  const markDirty = useCallback(() => {
    if (!dirty) setDirty(true)
  }, [dirty])

  const setTitleD = (v: string) => {
    markDirty()
    setTitle(v)
  }
  const setContentD = (v: string) => {
    markDirty()
    setContent(v)
  }
  const setSubjectD = (v: string) => {
    markDirty()
    setSubject(v)
  }
  const setLevelD = (v: Task['level']) => {
    markDirty()
    setLevel(v)
  }
  const setClsD = (v: string) => {
    markDirty()
    setCls(v)
  }
  const setTagsD = (v: string) => {
    markDirty()
    setTags(v)
  }
  const setSpecD = (patch: Partial<TaskSpecification>) => {
    markDirty()
    setSpec((s) => ({ ...s, ...patch }))
  }

  const runAutoDetect = useCallback(() => {
    const detected = detectParameters(content)
    const manual = parameters.filter((p) => !p.isAutoDetected)
    const existing = new Set(
      parameters.filter((p) => p.isAutoDetected).map((p) => `${p.name}|${p.unit ?? ''}`),
    )
    const fresh = detected.filter((d) => !existing.has(`${d.name}|${d.unit ?? ''}`))
    if (fresh.length === 0) {
      toast.info({
        title: 'Brak nowych parametrów',
        description: 'Wszystkie wykryte parametry są już dodane.',
      })
      return
    }
    setParameters([...manual, ...fresh])
    markDirty()
    toast.success({
      title: `Wykryto ${fresh.length} ${fresh.length === 1 ? 'parametr' : fresh.length < 5 ? 'parametry' : 'parametrów'}`,
    })
  }, [content, markDirty, parameters])

  const updateParam = (id: string, patch: Partial<TaskParameter>) => {
    markDirty()
    setParameters((ps) => ps.map((p) => (p.id === id ? { ...p, ...patch } : p)))
  }
  const addManualParam = () => {
    markDirty()
    setParameters((ps) => [
      ...ps,
      {
        id: `manual-${Date.now()}`,
        name: 'Nowy parametr',
        type: 'integer',
        value: 10,
        min: 1,
        max: 100,
        step: 1,
        isAutoDetected: false,
      },
    ])
  }
  const removeParam = (id: string) => {
    markDirty()
    setParameters((ps) => ps.filter((p) => p.id !== id))
  }
  const moveParam = (id: string, dir: -1 | 1) => {
    markDirty()
    setParameters((ps) => {
      const idx = ps.findIndex((p) => p.id === id)
      if (idx < 0) return ps
      const ni = idx + dir
      if (ni < 0 || ni >= ps.length) return ps
      const next = [...ps]
      ;[next[idx], next[ni]] = [next[ni], next[idx]]
      return next
    })
  }

  const setTaskTypeD = (t: TaskType) => {
    markDirty()
    setTaskType(t)
    if (t === 'closed' && choices.length === 0) {
      // Seed with 4 empty choices a–d, first marked correct.
      const seed: TaskChoice[] = ['a', 'b', 'c', 'd'].map((_l, i) => ({
        id: `choice-${Date.now()}-${i}`,
        content: '',
        isCorrect: i === 0,
        points: i === 0 ? 1 : 0,
      }))
      setChoices(seed)
    }
  }

  const addChoice = () => {
    if (choices.length >= 6) return
    markDirty()
    setChoices((c) => [
      ...c,
      { id: `choice-${Date.now()}`, content: '', isCorrect: false, points: 0 },
    ])
  }
  const updateChoice = (id: string, patch: Partial<TaskChoice>) => {
    markDirty()
    setChoices((cs) => cs.map((c) => (c.id === id ? { ...c, ...patch } : c)))
  }
  const removeChoice = (id: string) => {
    if (choices.length <= 2) return
    markDirty()
    setChoices((cs) => cs.filter((c) => c.id !== id))
  }
  const moveChoice = (id: string, dir: -1 | 1) => {
    markDirty()
    setChoices((cs) => {
      const idx = cs.findIndex((c) => c.id === id)
      if (idx < 0) return cs
      const ni = idx + dir
      if (ni < 0 || ni >= cs.length) return cs
      const next = [...cs]
      ;[next[idx], next[ni]] = [next[ni], next[idx]]
      return next
    })
  }
  const setShuffleChoicesD = (v: boolean) => {
    markDirty()
    setShuffleChoices(v)
  }

  const addAnswer = () => {
    markDirty()
    setAnswerKey((a) => [...a, { id: `ans-${Date.now()}`, answer: '', points: 1, explanation: '' }])
  }
  const updateAnswer = (id: string, patch: Partial<AnswerKeyItem>) => {
    markDirty()
    setAnswerKey((as) => as.map((a) => (a.id === id ? { ...a, ...patch } : a)))
  }
  const removeAnswer = (id: string) => {
    markDirty()
    setAnswerKey((as) => as.filter((a) => a.id !== id))
  }

  const togglePP = (id: string) => {
    markDirty()
    setSelectedPP((prev) => (prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]))
  }

  const validate = useCallback((): boolean => {
    const next = {
      title: !title.trim(),
      content: !content.trim(),
    }
    setErrors(next)
    return !next.title && !next.content
  }, [content, title])

  const handleSave = useCallback(async () => {
    if (!validate()) {
      toast.error({ title: 'Uzupełnij wymagane pola', description: 'Tytuł i treść są wymagane.' })
      document.getElementById('sec-content')?.scrollIntoView({ behavior: 'smooth', block: 'start' })
      return
    }
    if (selectedPP.length === 0) {
      toast.info({
        title: 'Brak punktów podstawy programowej',
        description: 'Zadanie zostanie zapisane bez przypisanej podstawy. Możesz dodać ją później.',
      })
    }
    setSaving(true)
    try {
      const payload: Task = {
        id: task?.id || `task-${Date.now()}`,
        title: title.trim(),
        content: content.trim(),
        subject,
        level,
        class: cls,
        programPoints: selectedPP,
        categories: selectedCategories,
        parameters,
        answerKey,
        specification: spec,
        tags: tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
        createdAt: task?.createdAt || Date.now(),
        updatedAt: Date.now(),
        taskType,
        choices: taskType === 'closed' ? choices : undefined,
        shuffleChoices: taskType === 'closed' ? shuffleChoices : undefined,
      }
      await db.tasks.put(payload)
      setDirty(false)
      toast.success({ title: task ? 'Zaktualizowano zadanie' : 'Utworzono zadanie' })
      onSaved()
    } catch (err) {
      toast.error({
        title: 'Nie udało się zapisać',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setSaving(false)
    }
  }, [
    task,
    title,
    content,
    subject,
    level,
    cls,
    selectedPP,
    selectedCategories,
    parameters,
    answerKey,
    spec,
    tags,
    taskType,
    choices,
    shuffleChoices,
    validate,
    onSaved,
  ])

  const handleCopyWord = useCallback(async () => {
    const html = copyAsWord({
      id: 'temp',
      title,
      content,
      subject,
      level,
      class: cls,
      programPoints: selectedPP,
      parameters,
      answerKey,
      specification: spec,
      tags: tags
        .split(',')
        .map((t) => t.trim())
        .filter(Boolean),
      createdAt: Date.now(),
      updatedAt: Date.now(),
      taskType,
      choices: taskType === 'closed' ? choices : undefined,
      shuffleChoices: taskType === 'closed' ? shuffleChoices : undefined,
    })
    const blob = new Blob([html], { type: 'text/html' })
    const item = new ClipboardItem({
      'text/html': blob,
      'text/plain': new Blob([title + '\n\n' + content], { type: 'text/plain' }),
    })
    await navigator.clipboard.write([item])
    toast.success({
      title: 'Skopiowano jako Word',
      description: 'Wklej do edytora dokumentów (Word, Pages, Google Docs).',
    })
  }, [
    title,
    content,
    subject,
    level,
    cls,
    selectedPP,
    parameters,
    answerKey,
    spec,
    tags,
    taskType,
    choices,
    shuffleChoices,
  ])

  useShortcuts([
    {
      combo: 'mod+s',
      allowInInputs: true,
      handler: () => {
        void handleSave()
      },
    },
  ])

  const totalPoints =
    taskType === 'closed'
      ? choices.reduce((s, c) => s + (c.isCorrect ? (c.points ?? 1) : (c.points ?? 0)), 0)
      : answerKey.reduce((s, a) => s + a.points, 0)

  const hasAnyCorrectChoice = choices.some((c) => c.isCorrect)
  const hasFilledChoices =
    choices.length >= 2 && choices.every((c) => c.content.trim()) && hasAnyCorrectChoice

  const outline: OutlineEntry[] = useMemo(() => {
    const answersEntry: OutlineEntry =
      taskType === 'closed'
        ? { id: 'sec-choices', label: 'Warianty (ABCD)', filled: hasFilledChoices }
        : { id: 'sec-answers', label: 'Klucz odpowiedzi', filled: answerKey.length > 0 }
    return [
      { id: 'sec-content', label: 'Treść', filled: !!title.trim() && !!content.trim() },
      { id: 'sec-meta', label: 'Klasyfikacja', filled: !!subject && !!cls },
      { id: 'sec-params', label: 'Parametry', filled: parameters.length > 0 },
      answersEntry,
      {
        id: 'sec-spec',
        label: 'Kryteria',
        filled: !!spec.answerKeyMethod || !!spec.answerKeyAnswer,
      },
      { id: 'sec-program', label: 'Podstawa', filled: selectedPP.length > 0 },
      { id: 'sec-categories', label: 'Kategorie', filled: selectedCategories.length > 0 },
      { id: 'sec-tags', label: 'Tagi', filled: !!tags.trim() },
    ]
  }, [
    title,
    content,
    subject,
    cls,
    parameters.length,
    taskType,
    answerKey.length,
    hasFilledChoices,
    spec,
    selectedPP.length,
    selectedCategories.length,
    tags,
  ])

  return (
    <div className="editor-shell">
      <EditorOutline entries={outline} scrollContainer={scrollContainer} />

      <div className="editor-pane" ref={paneRef}>
        <div className="flex justify-between items-center mb-1">
          <h2 className="card-title mb-0 text-2xl">{task ? 'Edycja zadania' : 'Nowe zadanie'}</h2>
          {totalPoints > 0 && (
            <span className="badge badge-success">{totalPoints} pkt łącznie</span>
          )}
        </div>

        <ContentSection
          title={title}
          content={content}
          errors={errors}
          onTitleChange={setTitleD}
          onContentChange={setContentD}
          onAutoDetect={runAutoDetect}
          onOpenPreview={() => setShowMobilePreview(true)}
        />

        <MetaSection
          taskType={taskType}
          subject={subject}
          level={level}
          cls={cls}
          onTaskTypeChange={setTaskTypeD}
          onSubjectChange={setSubjectD}
          onLevelChange={setLevelD}
          onClassChange={setClsD}
        />

        <ParametersSection
          parameters={parameters}
          onAdd={addManualParam}
          onUpdate={updateParam}
          onRemove={removeParam}
          onMove={moveParam}
        />

        {taskType === 'open' ? (
          <AnswersSection
            answerKey={answerKey}
            totalPoints={totalPoints}
            onAdd={addAnswer}
            onUpdate={updateAnswer}
            onRemove={removeAnswer}
          />
        ) : (
          <ChoicesSection
            choices={choices}
            totalPoints={totalPoints}
            hasAnyCorrectChoice={hasAnyCorrectChoice}
            shuffleChoices={shuffleChoices}
            onAdd={addChoice}
            onUpdate={updateChoice}
            onRemove={removeChoice}
            onMove={moveChoice}
            onShuffleChange={setShuffleChoicesD}
          />
        )}

        <SpecificationSection spec={spec} onChange={setSpecD} />

        <TaxonomySections
          level={level}
          cls={cls}
          selectedPP={selectedPP}
          programPoints={programPoints}
          categories={categories}
          selectedCategories={selectedCategories}
          onTogglePP={togglePP}
          onLevelChange={setLevelD}
          onClassChange={setClsD}
          onCategoriesChange={(next) => {
            markDirty()
            setSelectedCategories(next)
          }}
          tags={tags}
          onTagsChange={setTagsD}
        />

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

      <PreviewModals
        title={title}
        content={content}
        parameters={parameters}
        taskType={taskType}
        choices={choices}
        showFullPreview={showFullPreview}
        showMobilePreview={showMobilePreview}
        onCloseFull={() => setShowFullPreview(false)}
        onCloseMobile={() => setShowMobilePreview(false)}
      />
    </div>
  )
}
