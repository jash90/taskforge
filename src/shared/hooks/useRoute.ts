import { useCallback, useEffect, useMemo } from 'react'
import { useLocation, useNavigate } from 'react-router-dom'

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
  | 'download'

/** Hash routing (react-router HashRouter) — works on Capacitor (file://), Vercel,
 *  and static hosts with no rewrite rules. Maps each tab to a human-readable
 *  URL fragment. */
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
  download: '/pobierz',
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

/** HashRouter exposes the fragment as a pathname: `#/edytor/abc` → `/edytor/abc`.
 *  The router does not decode pathname, so param decoding stays manual. */
const parsePath = (pathname: string): RouteState => {
  if (!pathname || pathname === '/') return { tab: DEFAULT_TAB }
  const idx = pathname.indexOf('/', 1)
  const slug = idx === -1 ? pathname : pathname.slice(0, idx)
  const tab = HASH_TO_TAB[slug]
  if (!tab) return { tab: DEFAULT_TAB }
  const param = idx === -1 ? undefined : decodeURIComponent(pathname.slice(idx + 1)) || undefined
  return param ? { tab, param } : { tab }
}

const buildPath = ({ tab, param }: RouteState): string =>
  param ? `${TAB_TO_HASH[tab]}/${encodeURIComponent(param)}` : TAB_TO_HASH[tab]

export function useRoute() {
  const { pathname } = useLocation()
  const navigate = useNavigate()
  const state = useMemo(() => parsePath(pathname), [pathname])

  // Normalize `#`, `#/` and unknown slugs to the canonical hash once on mount.
  // Mount-only on purpose: mid-session manual hash edits fall back to the
  // default tab without rewriting the URL, same as the pre-router hook.
  useEffect(() => {
    const canonical = buildPath(parsePath(pathname))
    if (pathname !== canonical) navigate(canonical, { replace: true })
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [])

  const setRoute = useCallback(
    (tab: Tab, param?: string, options?: { replace?: boolean }) => {
      const path = buildPath(param ? { tab, param } : { tab })
      // Same-route guard: without it, clicking the already-active tab pushes
      // duplicate history entries and the back button appears broken.
      if (window.location.hash === '#' + path) return
      navigate(path, { replace: options?.replace ?? false })
    },
    [navigate],
  )

  const setTab = useCallback((tab: Tab) => setRoute(tab), [setRoute])

  return { tab: state.tab, param: state.param, setTab, setRoute }
}
