import { useSyncExternalStore } from 'react'

export interface AppSettings {
  openrouterApiKey: string | null
  openrouterModel: string
  /** Cached human-readable label for the selected model (id alone is opaque). */
  openrouterModelLabel: string
  /** Optional override for the AI generator system prompt. Empty = use default. */
  aiSystemPrompt: string
}

const STORAGE_KEY = 'taskforge.settings'

export const DEFAULT_SETTINGS: AppSettings = {
  openrouterApiKey: null,
  openrouterModel: 'meta-llama/llama-3.3-70b-instruct:free',
  openrouterModelLabel: 'Meta · Llama 3.3 70B Instruct (free)',
  aiSystemPrompt: '',
}

const read = (): AppSettings => {
  if (typeof window === 'undefined') return DEFAULT_SETTINGS
  try {
    const raw = window.localStorage.getItem(STORAGE_KEY)
    if (!raw) return DEFAULT_SETTINGS
    const parsed = JSON.parse(raw) as Partial<AppSettings>
    return { ...DEFAULT_SETTINGS, ...parsed }
  } catch {
    return DEFAULT_SETTINGS
  }
}

const write = (settings: AppSettings) => {
  try {
    window.localStorage.setItem(STORAGE_KEY, JSON.stringify(settings))
  } catch {
    /* ignore */
  }
}

const subscribers = new Set<() => void>()
let cachedSettings = typeof window !== 'undefined' ? read() : DEFAULT_SETTINGS

const subscribe = (fn: () => void) => {
  subscribers.add(fn)
  return () => subscribers.delete(fn)
}

const getSnapshot = () => cachedSettings

const emit = () => subscribers.forEach((fn) => fn())

const update = (patch: Partial<AppSettings>): AppSettings => {
  cachedSettings = { ...cachedSettings, ...patch }
  write(cachedSettings)
  emit()
  return cachedSettings
}

const reset = () => {
  cachedSettings = DEFAULT_SETTINGS
  write(cachedSettings)
  emit()
}

export function useSettings() {
  const settings = useSyncExternalStore(subscribe, getSnapshot, getSnapshot)
  return { settings, update, reset }
}

/** Read settings synchronously outside of React (e.g. inside event handlers). */
export function getSettings(): AppSettings {
  return cachedSettings
}

/** Subscribe to localStorage changes from other tabs (rare but supported). */
if (typeof window !== 'undefined') {
  window.addEventListener('storage', (e) => {
    if (e.key !== STORAGE_KEY) return
    cachedSettings = read()
    emit()
  })
}
