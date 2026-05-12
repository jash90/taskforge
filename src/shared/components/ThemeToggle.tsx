import { Sun, Moon, MonitorCog } from 'lucide-react'
import { useTheme, type ThemePref } from '@shared/hooks/useTheme'

const labelFor = (pref: ThemePref) =>
  pref === 'light'
    ? 'Motyw jasny — kliknij, aby przełączyć na ciemny'
    : pref === 'dark'
      ? 'Motyw ciemny — kliknij, aby przełączyć na systemowy'
      : 'Motyw systemowy — kliknij, aby przełączyć na jasny'

export default function ThemeToggle() {
  const { pref, cycle } = useTheme()
  const Icon = pref === 'light' ? Sun : pref === 'dark' ? Moon : MonitorCog
  return (
    <button
      type="button"
      className="theme-toggle"
      onClick={cycle}
      aria-label={labelFor(pref)}
      title={labelFor(pref)}
    >
      <Icon size={18} aria-hidden="true" />
    </button>
  )
}
