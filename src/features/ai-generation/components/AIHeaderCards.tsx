import { AlertTriangle, Bot, Settings as SettingsIcon } from 'lucide-react'

interface Props {
  hasKey: boolean
  model: string
  modelLabel?: string
  onOpenSettings: () => void
}

export default function AIHeaderCards({ hasKey, model, modelLabel, onOpenSettings }: Props) {
  return (
    <>
      {!hasKey && (
        <div role="alert" className="card card-warning mb-2">
          <div className="flex items-center gap-1 mb-1">
            <AlertTriangle size={16} aria-hidden="true" className="color-warning" />
            <strong>Brak klucza API OpenRouter</strong>
          </div>
          <p className="text-sm mb-2">
            Aby generować zadania, dodaj klucz OpenRouter w Ustawieniach. Klucz jest przechowywany
            lokalnie w przeglądarce.
          </p>
          <button type="button" className="btn btn-primary btn-sm" onClick={onOpenSettings}>
            <SettingsIcon size={14} aria-hidden="true" /> Otwórz ustawienia
          </button>
        </div>
      )}

      <div className="card mb-2 flex items-center justify-between wrap gap-1">
        <div className="flex items-center gap-1">
          <Bot size={16} aria-hidden="true" className="color-accent" />
          <div>
            <div className="text-sm font-semibold">{modelLabel || 'Domyślny model'}</div>
            <div className="text-xs text-faint font-mono">{model}</div>
          </div>
        </div>
        <button type="button" className="btn btn-ghost btn-sm" onClick={onOpenSettings}>
          <SettingsIcon size={14} aria-hidden="true" /> Zmień model / klucz
        </button>
      </div>
    </>
  )
}
