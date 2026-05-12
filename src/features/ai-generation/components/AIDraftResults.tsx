import { Save, Sparkles, Trash2 } from 'lucide-react'

import type { DraftTask } from '../services/draftTasks'

interface Props {
  drafts: DraftTask[]
  onSaveAll: () => void
  onSave: (draft: DraftTask) => void
  onDiscard: (id: string) => void
}

export default function AIDraftResults({ drafts, onSaveAll, onSave, onDiscard }: Props) {
  if (drafts.length === 0) return null

  return (
    <section className="card">
      <div className="flex justify-between items-center mb-2">
        <div>
          <h3 className="card-title mb-0">
            Wygenerowane wersje robocze ({drafts.filter((d) => !d.saved).length})
          </h3>
          <p className="text-muted text-sm">Sprawdź każde zadanie, edycja możliwa po zapisaniu.</p>
        </div>
        <div className="flex gap-1">
          <button
            type="button"
            className="btn btn-primary"
            onClick={onSaveAll}
            disabled={drafts.every((d) => d.saved)}
          >
            <Save size={14} aria-hidden="true" /> Zapisz wszystkie
          </button>
        </div>
      </div>

      <div className="task-list">
        {drafts.map((d) => (
          <div key={d.id} className={`card card-tight ai-draft-card${d.saved ? ' is-saved' : ''}`}>
            <div className="flex justify-between items-center mb-1 wrap gap-1">
              <div className="grow">
                <div className="flex items-center gap-1 wrap">
                  <strong>{d.title}</strong>
                  <span className="badge badge-ai">
                    <Sparkles size={10} aria-hidden="true" /> AI
                  </span>
                  {d.saved && <span className="badge badge-success">zapisane</span>}
                </div>
              </div>
              <div className="flex gap-1">
                <button
                  type="button"
                  className="btn btn-primary btn-sm"
                  onClick={() => onSave(d)}
                  disabled={d.saved}
                >
                  <Save size={12} aria-hidden="true" /> {d.saved ? 'Zapisane' : 'Zapisz'}
                </button>
                <button
                  type="button"
                  className="btn btn-danger-soft btn-sm"
                  onClick={() => onDiscard(d.id)}
                >
                  <Trash2 size={12} aria-hidden="true" />
                </button>
              </div>
            </div>
            <div className="preview-box prose">{d.content}</div>
            {d.answerKey.length > 0 && (
              <div className="text-sm mt-1">
                <strong>Klucz:</strong>{' '}
                {d.answerKey.map((a, i) => (
                  <span key={i}>
                    {i > 0 && ' · '}
                    <span className="color-accent">{a.answer}</span> ({a.points} pkt)
                  </span>
                ))}
              </div>
            )}
            {d.specification?.method && (
              <div className="text-sm text-muted mt-1">
                <strong>Metoda:</strong> {d.specification.method}
              </div>
            )}
            {d.tags && d.tags.length > 0 && (
              <div className="flex gap-1 wrap mt-1">
                {d.tags.map((t) => (
                  <span key={t} className="tag">
                    {t}
                  </span>
                ))}
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  )
}
