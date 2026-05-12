import { Save, X } from 'lucide-react'

interface Props {
  dirty: boolean
  saving: boolean
  onSave: () => void
  onCancel: () => void
}

export default function EditorSaveBar({ dirty, saving, onSave, onCancel }: Props) {
  return (
    <div className="save-bar" role="region" aria-label="Pasek zapisu">
      <button type="button" className="btn btn-ghost" onClick={onCancel}>
        <X size={16} aria-hidden="true" /> Anuluj
      </button>
      <span className={`save-status ${dirty ? 'dirty' : ''}`} aria-live="polite">
        {dirty ? 'Niezapisane zmiany' : 'Brak zmian'}
      </span>
      <button type="button" className="btn btn-primary" onClick={onSave} disabled={saving}>
        <Save size={16} aria-hidden="true" /> {saving ? 'Zapisywanie…' : 'Zapisz'}
      </button>
    </div>
  )
}
