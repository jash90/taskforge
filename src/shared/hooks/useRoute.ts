import { useCallback, useEffect, useState } from 'react'

export type Tab =
  | 'tasks'
  | 'editor'
  | 'ai'
  | 'randomizer'
  | 'tests'
  | 'program'
  | 'categories'
  | 'export'
  | 'settings'

/** Hash routing — works on Capacitor (file://), Vercel, and static hosts
 *  with no rewrite rules. Maps each tab to a human-readable URL fragment. */
export const TAB_TO_HASH: Record<Tab, string> = {
  tasks: '/zadania',
  editor: '/edytor',
  ai: '/ai',
  randomizer: '/losowanie',
  tests: '/testy',
  program: '/podstawa',
  categories: '/kategorie',
  export: '/eksport',
  settings: '/ustawienia',
}

const HASH_TO_TAB: Record<string, Tab> = Object.fromEntries(
  (Object.entries(TAB_TO_HASH) as [Tab, string][]).map(([tab, hash]) => [hash, tab]),
)

const DEFAULT_TAB: Tab = 'tasks'

export interface RouteState {
  tab: Tab
  /** Optional URL segment after the tab slug, e.g. a task id for the
   *  editor (`#/edytor/<id>`) or randomizer (`#/losowanie/<id>`). */
  param?: string
}

const parseHash = (): RouteState => {
  if (typeof window === 'undefined') return { tab: DEFAULT_TAB }
  const raw = window.location.hash.replace(/^#/, '')
  if (!raw) return { tab: DEFAULT_TAB }
  // Split into "/slug" + optional "/extra". The slug includes its leading "/"
  // (see TAB_TO_HASH values) so we rebuild it before the second-slash split.
  const idx = raw.indexOf('/', 1)
  const slug = idx === -1 ? raw : raw.slice(0, idx)
  const tab = HASH_TO_TAB[slug]
  if (!tab) return { tab: DEFAULT_TAB }
  const param = idx === -1 ? undefined : decodeURIComponent(raw.slice(idx + 1)) || undefined
  return param ? { tab, param } : { tab }
}

const buildHash = ({ tab, param }: RouteState): string => {
  const base = '#' + TAB_TO_HASH[tab]
  return param ? `${base}/${encodeURIComponent(param)}` : base
}

const writeHash = (state: RouteState, replace = false) => {
  const target = buildHash(state)
  if (window.location.hash === target) return
  if (replace) {
    const url = window.location.pathname + window.location.search + target
    window.history.replaceState(null, '', url)
    // replaceState doesn't fire hashchange — caller must sync state itself.
  } else {
    window.location.hash = target
  }
}

const sameRoute = (a: RouteState, b: RouteState) => a.tab === b.tab && a.param === b.param

export function useRoute() {
  const [state, setState] = useState<RouteState>(parseHash)

  useEffect(() => {
    // Normalize the initial URL: if we landed on '/' or an unknown hash,
    // rewrite it to the canonical hash for the current state.
    const raw = window.location.hash.replace(/^#/, '')
    if (raw !== buildHash(state).slice(1)) writeHash(state, true)

    const onHashChange = () => {
      const next = parseHash()
      setState((prev) => (sameRoute(prev, next) ? prev : next))
    }
    window.addEventListener('hashchange', onHashChange)
    return () => window.removeEventListener('hashchange', onHashChange)
    // Intentionally only run on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  /** Navigate to a tab with an optional parameter (e.g. task id).
   *  When `replace` is true, rewrites the current history entry instead of
   *  pushing a new one — useful when normalising bad URLs so the user can
   *  press Back without landing on the broken state again. */
  const setRoute = useCallback((tab: Tab, param?: string, options?: { replace?: boolean }) => {
    const next: RouteState = param ? { tab, param } : { tab }
    writeHash(next, options?.replace ?? false)
    setState((prev) => (sameRoute(prev, next) ? prev : next))
  }, [])

  /** Convenience: navigate to a tab without a parameter. */
  const setTab = useCallback((tab: Tab) => setRoute(tab), [setRoute])

  return { tab: state.tab, param: state.param, setTab, setRoute }
}
