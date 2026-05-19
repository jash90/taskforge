import { useEffect, useRef } from 'react'
import { toast } from '@shared/hooks/useToast'

const STARTUP_DELAY_MS = 5_000

export const isUpdaterAvailable = (): boolean =>
  typeof window !== 'undefined' && '__TAURI_INTERNALS__' in window

const formatVersion = (v: string): string => (v.startsWith('v') ? v : `v${v}`)

interface CheckOptions {
  /** When true (default), suppress "up-to-date" and error toasts. Used by the startup probe. */
  silent?: boolean
}

/**
 * Runs the updater check once. Returns true if an update was found and offered to the user.
 * Throws on transport failures so callers can decide whether to surface them.
 */
export const checkForUpdate = async ({ silent = true }: CheckOptions = {}): Promise<boolean> => {
  if (!isUpdaterAvailable()) {
    if (!silent) {
      toast.info({
        title: 'Aktualizacje niedostępne',
        description: 'Auto-update działa tylko w aplikacji desktopowej (Windows MSI / Linux AppImage).',
      })
    }
    return false
  }

  const [{ check }, { relaunch }] = await Promise.all([
    import('@tauri-apps/plugin-updater'),
    import('@tauri-apps/plugin-process'),
  ])

  const update = await check()
  if (!update) {
    if (!silent) {
      toast.success({ title: 'Masz najnowszą wersję' })
    }
    return false
  }

  const remoteVersion = formatVersion(update.version)

  toast.info({
    title: `Dostępna aktualizacja ${remoteVersion}`,
    description: update.body?.trim() || 'Kliknij „Zainstaluj", aby pobrać i uruchomić nową wersję.',
    duration: 0,
    action: {
      label: 'Zainstaluj',
      onPress: () => {
        const progressId = toast.info({
          title: `Pobieranie aktualizacji ${remoteVersion}…`,
          description: 'Aplikacja uruchomi się ponownie po zakończeniu.',
          duration: 0,
        })

        update
          .downloadAndInstall()
          .then(() => relaunch())
          .catch((err) => {
            toast.dismiss(progressId)
            toast.error({
              title: 'Nie udało się zainstalować aktualizacji',
              description: err instanceof Error ? err.message : String(err),
            })
          })
      },
    },
  })

  return true
}

export function useUpdater(): void {
  const startedRef = useRef(false)

  useEffect(() => {
    if (startedRef.current) return
    if (!isUpdaterAvailable()) return
    startedRef.current = true

    const timer = setTimeout(() => {
      checkForUpdate({ silent: true }).catch((err) => {
        // Network errors / no release published yet — silent in the background.
        if (import.meta.env.DEV) {
          console.warn('[updater] check failed', err)
        }
      })
    }, STARTUP_DELAY_MS)

    return () => clearTimeout(timer)
  }, [])
}
