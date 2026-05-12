import { useCallback, useEffect, useState } from 'react';

export type Tab =
  | 'tasks' | 'editor' | 'ai' | 'randomizer' | 'tests'
  | 'program' | 'categories' | 'export' | 'settings';

/** Hash routing — works on Capacitor (file://), Vercel, and static hosts
 *  with no rewrite rules. Maps each tab to a human-readable URL fragment. */
export const TAB_TO_HASH: Record<Tab, string> = {
  tasks:      '/zadania',
  editor:     '/edytor',
  ai:         '/ai',
  randomizer: '/losowanie',
  tests:      '/testy',
  program:    '/podstawa',
  categories: '/kategorie',
  export:     '/eksport',
  settings:   '/ustawienia',
};

const HASH_TO_TAB: Record<string, Tab> = Object.fromEntries(
  (Object.entries(TAB_TO_HASH) as [Tab, string][]).map(([tab, hash]) => [hash, tab]),
);

const DEFAULT_TAB: Tab = 'tasks';

const readHash = (): Tab => {
  if (typeof window === 'undefined') return DEFAULT_TAB;
  const raw = window.location.hash.replace(/^#/, '');
  return HASH_TO_TAB[raw] ?? DEFAULT_TAB;
};

const writeHash = (tab: Tab, replace = false) => {
  const target = '#' + TAB_TO_HASH[tab];
  if (window.location.hash === target) return;
  if (replace) {
    const url = window.location.pathname + window.location.search + target;
    window.history.replaceState(null, '', url);
    // replaceState doesn't fire hashchange — caller must sync state itself.
  } else {
    window.location.hash = target;
  }
};

export function useRoute() {
  const [tab, setTabState] = useState<Tab>(readHash);

  useEffect(() => {
    // Normalize the initial URL: if we landed on '/' or an unknown hash,
    // rewrite it to the default tab's hash so deep links and reloads agree.
    const raw = window.location.hash.replace(/^#/, '');
    if (raw !== TAB_TO_HASH[tab]) writeHash(tab, true);

    const onHashChange = () => setTabState(readHash());
    window.addEventListener('hashchange', onHashChange);
    return () => window.removeEventListener('hashchange', onHashChange);
    // Intentionally only run on mount.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const setTab = useCallback((t: Tab) => {
    writeHash(t);
    setTabState(t);
  }, []);

  return { tab, setTab };
}
