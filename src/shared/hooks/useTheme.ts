import { useEffect, useState, useCallback } from 'react'

export type ThemePref = 'light' | 'dark' | 'system'
type ResolvedTheme = 'light' | 'dark'

const STORAGE_KEY = 'taskforge.theme'

const readPref = (): ThemePref => {
  if (typeof window === 'undefined') return 'system'
  const stored = window.localStorage.getItem(STORAGE_KEY)
  if (stored === 'light' || stored === 'dark' || stored === 'system') return stored
  return 'system'
}

const resolve = (pref: ThemePref): ResolvedTheme => {
  if (pref === 'light' || pref === 'dark') return pref
  if (typeof window === 'undefined') return 'light'
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light'
}

const apply = (resolved: ResolvedTheme) => {
  document.documentElement.dataset.theme = resolved
}

export function useTheme() {
  const [pref, setPref] = useState<ThemePref>(() => readPref())
  const [resolved, setResolved] = useState<ResolvedTheme>(() => resolve(readPref()))

  useEffect(() => {
    const next = resolve(pref)
    setResolved(next)
    apply(next)
    window.localStorage.setItem(STORAGE_KEY, pref)
  }, [pref])

  useEffect(() => {
    if (pref !== 'system') return
    const mq = window.matchMedia('(prefers-color-scheme: dark)')
    const onChange = () => {
      const next: ResolvedTheme = mq.matches ? 'dark' : 'light'
      setResolved(next)
      apply(next)
    }
    mq.addEventListener('change', onChange)
    return () => mq.removeEventListener('change', onChange)
  }, [pref])

  const cycle = useCallback(() => {
    setPref((p) => (p === 'light' ? 'dark' : p === 'dark' ? 'system' : 'light'))
  }, [])

  return { pref, resolved, setPref, cycle }
}
