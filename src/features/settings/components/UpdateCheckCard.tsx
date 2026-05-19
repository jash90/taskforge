import { useEffect, useState } from 'react'
import { Download, Loader2, RefreshCw } from 'lucide-react'
import { checkForUpdate, isUpdaterAvailable } from '@shared/hooks/useUpdater'
import { toast } from '@shared/hooks/useToast'

export default function UpdateCheckCard() {
  const [version, setVersion] = useState<string | null>(null)
  const [checking, setChecking] = useState(false)

  useEffect(() => {
    if (!isUpdaterAvailable()) return
    let cancelled = false
    void import('@tauri-apps/api/app').then(({ getVersion }) =>
      getVersion().then((v) => {
        if (!cancelled) setVersion(v)
      }),
    )
    return () => {
      cancelled = true
    }
  }, [])

  if (!isUpdaterAvailable()) return null

  const handleCheck = async () => {
    setChecking(true)
    try {
      await checkForUpdate({ silent: false })
    } catch (err) {
      toast.error({
        title: 'Nie udało się sprawdzić aktualizacji',
        description: err instanceof Error ? err.message : String(err),
      })
    } finally {
      setChecking(false)
    }
  }

  return (
    <section className="card mb-2">
      <div className="section-header">
        <h3 className="text-md">
          <Download size={16} aria-hidden="true" className="icon-inline mr-half" />
          Aktualizacje
        </h3>
      </div>
      <p className="text-muted text-sm mb-1">
        {version
          ? `Aktualna wersja: ${version}. Aplikacja sama sprawdza aktualizacje przy starcie.`
          : 'Aplikacja sama sprawdza aktualizacje przy starcie.'}
      </p>
      <button type="button" className="btn btn-sm" onClick={handleCheck} disabled={checking}>
        {checking ? (
          <>
            <Loader2 size={14} aria-hidden="true" className="spinner" /> Sprawdzanie…
          </>
        ) : (
          <>
            <RefreshCw size={14} aria-hidden="true" /> Sprawdź aktualizacje
          </>
        )}
      </button>
    </section>
  )
}
