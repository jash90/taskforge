import type { ProgramPoint, SchoolLevel, TaskParameter } from '@shared/types'

export interface DraftTask {
  id: string
  title: string
  content: string
  answerKey: { answer: string; points: number; explanation?: string }[]
  specification?: { method?: string; answer?: string; conclusions?: string }
  tags?: string[]
  parameters?: TaskParameter[]
  saved?: boolean
}

export interface CategoryPromptPath {
  id: string
  path: string
  childCount: number
}

export const DEFAULT_SYSTEM_PROMPT_FALLBACK = `Jesteś nauczycielem fizyki / przedmiotów ścisłych w polskiej szkole. \
Tworzysz parametryzowane zadania edukacyjne dopasowane do podanej podstawy programowej i kategorii. \
Każde zadanie zawiera: tytuł, treść (z liczbami i jednostkami w treści), klucz odpowiedzi (1–3 punkty), \
metodę rozwiązania, opcjonalne wnioski. Używaj polskich nazw i poprawnej terminologii.`

export const SUBJECTS = [
  'Fizyka',
  'Matematyka',
  'Chemia',
  'Biologia',
  'Informatyka',
  'Język polski',
  'Historia',
  'Geografia',
]

interface BuildUserPromptParams {
  index: number
  total: number
  subject: string
  level: SchoolLevel
  klasa: string
  difficulty: string
  withParameters: boolean
  ppDetailed: ProgramPoint[]
  categoryPathsForPrompt: CategoryPromptPath[]
  extraInstructions: string
}

export const buildUserPromptForSingle = ({
  index,
  total,
  subject,
  level,
  klasa,
  difficulty,
  withParameters,
  ppDetailed,
  categoryPathsForPrompt,
  extraInstructions,
}: BuildUserPromptParams): string => {
  const parts: string[] = []
  parts.push('Wygeneruj JEDNO zadanie edukacyjne.')
  if (total > 1) {
    parts.push(
      `To zadanie ${index + 1} z ${total} w tej serii — postaraj się, aby było wyraźnie różne od typowego ujęcia tematu (inny przykład liczbowy, inny scenariusz, inne pojęcie kluczowe).`,
    )
  }
  parts.push(`Przedmiot: ${subject}.`)
  parts.push(
    `Poziom: ${level === 'podstawowa' ? 'szkoła podstawowa' : 'liceum / technikum'}, klasa ${klasa}.`,
  )
  parts.push(`Trudność: ${difficulty}.`)
  if (withParameters) {
    parts.push(
      'Zadanie powinno zawierać liczby i jednostki w treści (np. "20 km/h", "3 godziny", "100 zł"), żeby można było je sparametryzować.',
    )
  }

  if (ppDetailed.length > 0) {
    parts.push('', 'Zadanie ma realizować któryś z NASTĘPUJĄCYCH punktów podstawy programowej:')
    for (const p of ppDetailed) parts.push(`- [${p.code}] ${p.description}`)
  }

  if (categoryPathsForPrompt.length > 0) {
    parts.push('', 'Zadanie ma dotyczyć jednej z NASTĘPUJĄCYCH kategorii (hierarchicznych):')
    for (const c of categoryPathsForPrompt) parts.push(`- ${c.path}`)
  }

  if (extraInstructions.trim()) {
    parts.push('', `Dodatkowe wytyczne: ${extraInstructions.trim()}`)
  }

  parts.push('', 'Zwróć WYŁĄCZNIE poprawny JSON o strukturze:', '{', '  "task": {')
  parts.push('    "title": "krótki tytuł zadania",')
  parts.push('    "content": "treść zadania w jednym akapicie z liczbami i jednostkami",')
  parts.push('    "answerKey": [')
  parts.push(
    '      { "answer": "poprawna odpowiedź z jednostką", "points": 2, "explanation": "krótkie uzasadnienie" }',
  )
  parts.push('    ],', '    "specification": {')
  parts.push('      "method": "metoda rozwiązania krok po kroku",')
  parts.push('      "answer": "ostateczna odpowiedź",')
  parts.push('      "conclusions": "wnioski lub komentarz (opcjonalnie)"')
  parts.push('    },', '    "tags": ["3-6 krótkich tagów"]', '  }', '}', '')
  parts.push('Bez markdown, bez bloków kodu, bez komentarzy. Tylko czysty JSON.')
  return parts.join('\n')
}

export const parseSingleDraft = (raw: string, index: number): DraftTask => {
  let cleaned = raw.trim()
  if (cleaned.startsWith('```')) {
    cleaned = cleaned
      .replace(/^```(?:json)?\s*/i, '')
      .replace(/```\s*$/i, '')
      .trim()
  }
  let parsed: unknown
  try {
    parsed = JSON.parse(cleaned)
  } catch {
    const match = cleaned.match(/\{[\s\S]*\}/)
    if (!match) throw new Error('Model nie zwrócił JSON.')
    parsed = JSON.parse(match[0])
  }
  const root = parsed as { task?: unknown; tasks?: unknown }
  let rawTask: unknown
  if (root.task && typeof root.task === 'object') rawTask = root.task
  else if (Array.isArray(root.tasks) && root.tasks.length > 0) rawTask = root.tasks[0]
  else throw new Error('Brak pola "task" w odpowiedzi.')

  const x = rawTask as Partial<DraftTask> & Record<string, unknown>
  return {
    id: `draft-${Date.now()}-${index}`,
    title: typeof x.title === 'string' ? x.title : `Zadanie ${index + 1}`,
    content: typeof x.content === 'string' ? x.content : '',
    answerKey: Array.isArray(x.answerKey)
      ? x.answerKey.map((a) => ({
          answer:
            typeof (a as { answer?: unknown }).answer === 'string'
              ? (a as { answer: string }).answer
              : '',
          points: Number((a as { points?: unknown }).points) || 1,
          explanation:
            typeof (a as { explanation?: unknown }).explanation === 'string'
              ? (a as { explanation: string }).explanation
              : undefined,
        }))
      : [],
    specification:
      x.specification && typeof x.specification === 'object'
        ? {
            method: (x.specification as { method?: string }).method,
            answer: (x.specification as { answer?: string }).answer,
            conclusions: (x.specification as { conclusions?: string }).conclusions,
          }
        : undefined,
    tags: Array.isArray(x.tags) ? (x.tags as string[]).filter((t) => typeof t === 'string') : [],
  }
}
