import { useEffect, useMemo, useState } from 'react'
import {
  Search,
  X,
  Bot,
  Image as ImageIcon,
  Brain,
  Star,
  Loader2,
  AlertTriangle,
  RefreshCw,
} from 'lucide-react'
import {
  fetchModels,
  formatContext,
  formatMTokPrice,
  isFreeModel,
  providerOf,
  supportsImageInput,
  supportsReasoning,
  type OpenRouterModel,
} from '@features/ai-generation'

interface Props {
  apiKey: string | null
  selectedModel: string
  onSelect: (model: OpenRouterModel) => void
  /** Display label fallback for when models list isn't loaded yet. */
  selectedLabel?: string
}

type FilterMode = 'all' | 'free' | 'cheap' | 'reasoning' | 'multimodal'

const STARRED_RECOMMENDED: string[] = [
  'meta-llama/llama-3.3-70b-instruct:free',
  'google/gemini-2.0-flash-exp:free',
  'deepseek/deepseek-chat-v3.1:free',
  'google/gemini-flash-1.5',
  'anthropic/claude-3.5-haiku',
  'openai/gpt-4o-mini',
  'anthropic/claude-3.5-sonnet',
  'openai/gpt-4o',
]

const FILTER_LABELS: Record<FilterMode, string> = {
  all: 'Wszystkie',
  free: 'Darmowe',
  cheap: 'Tanie (≤ $1/MTok)',
  reasoning: 'Reasoning',
  multimodal: 'Multimodal',
}

const matchesFilter = (m: OpenRouterModel, mode: FilterMode): boolean => {
  switch (mode) {
    case 'all':
      return true
    case 'free':
      return isFreeModel(m)
    case 'cheap': {
      const p = parseFloat(m.pricing?.prompt ?? '0') * 1_000_000
      return p <= 1
    }
    case 'reasoning':
      return supportsReasoning(m)
    case 'multimodal':
      return supportsImageInput(m)
  }
}

export default function ModelPicker({ apiKey, selectedModel, onSelect, selectedLabel }: Props) {
  const [open, setOpen] = useState(false)
  const [models, setModels] = useState<OpenRouterModel[] | null>(null)
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [query, setQuery] = useState('')
  const [filter, setFilter] = useState<FilterMode>('all')

  const load = async () => {
    setLoading(true)
    setError(null)
    try {
      const list = await fetchModels(apiKey)
      setModels(list)
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err))
    } finally {
      setLoading(false)
    }
  }

  useEffect(() => {
    if (!open || models) return
    void load()
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [open])

  const selectedFromList = useMemo(
    () => models?.find((m) => m.id === selectedModel) ?? null,
    [models, selectedModel],
  )

  const filtered = useMemo(() => {
    if (!models) return []
    const q = query.trim().toLowerCase()
    const list = models.filter((m) => {
      if (!matchesFilter(m, filter)) return false
      if (!q) return true
      return (
        m.id.toLowerCase().includes(q) ||
        m.name.toLowerCase().includes(q) ||
        providerOf(m).toLowerCase().includes(q)
      )
    })
    const recommendedIdx = (id: string) => {
      const i = STARRED_RECOMMENDED.indexOf(id)
      return i === -1 ? Number.MAX_SAFE_INTEGER : i
    }
    return [...list].sort((a, b) => {
      // Pinned recommendations first, then free, then by name
      const ar = recommendedIdx(a.id)
      const br = recommendedIdx(b.id)
      if (ar !== br) return ar - br
      const af = isFreeModel(a) ? 0 : 1
      const bf = isFreeModel(b) ? 0 : 1
      if (af !== bf) return af - bf
      return a.name.localeCompare(b.name)
    })
  }, [models, query, filter])

  const handlePick = (m: OpenRouterModel) => {
    onSelect(m)
    setOpen(false)
  }

  return (
    <>
      <button
        type="button"
        className="model-picker-trigger"
        onClick={() => setOpen(true)}
        aria-haspopup="dialog"
      >
        <Bot size={18} aria-hidden="true" className="color-accent" />
        <div className="model-picker-trigger-body">
          <span className="model-picker-trigger-name">
            {selectedFromList?.name ?? selectedLabel ?? selectedModel}
          </span>
          <span className="model-picker-trigger-id">{selectedModel}</span>
        </div>
        <span className="text-faint text-xs">Zmień ›</span>
      </button>

      {open && (
        <div className="overlay" onMouseDown={() => setOpen(false)} role="presentation">
          <div
            className="overlay-content max-w-880 modal-no-padding"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
            aria-labelledby="model-picker-title"
          >
            <div className="modal-section-padded">
              <div className="flex justify-between items-center mb-2">
                <h2 id="model-picker-title" className="card-title mb-0">
                  Wybierz model OpenRouter
                </h2>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => setOpen(false)}
                >
                  <X size={14} aria-hidden="true" /> Zamknij
                </button>
              </div>

              <div className="flex gap-1 wrap">
                <div className="search-input grow">
                  <Search size={14} aria-hidden="true" />
                  <input
                    autoFocus
                    value={query}
                    onChange={(e) => setQuery(e.target.value)}
                    placeholder="Szukaj po nazwie, providerze lub id…"
                    aria-label="Szukaj modelu"
                  />
                </div>
                <button
                  type="button"
                  className="btn btn-ghost btn-sm"
                  onClick={() => void load()}
                  aria-label="Odśwież listę modeli"
                  disabled={loading}
                  title="Odśwież listę modeli"
                >
                  <RefreshCw
                    size={14}
                    aria-hidden="true"
                    className={loading ? 'spinner' : undefined}
                  />
                </button>
              </div>

              <div className="flex gap-1 wrap mt-1">
                {(Object.keys(FILTER_LABELS) as FilterMode[]).map((f) => (
                  <button
                    key={f}
                    type="button"
                    className={`btn btn-sm ${filter === f ? 'btn-primary' : 'btn-secondary'}`}
                    onClick={() => setFilter(f)}
                    aria-pressed={filter === f}
                  >
                    {FILTER_LABELS[f]}
                  </button>
                ))}
              </div>
            </div>

            <div className="modal-bordered-list">
              {loading && (
                <div className="flex items-center gap-1 modal-state">
                  <Loader2 size={16} aria-hidden="true" className="spinner" />
                  Pobieram listę modeli…
                </div>
              )}
              {error && (
                <div role="alert" className="flex items-center gap-1 modal-state modal-state-error">
                  <AlertTriangle size={16} aria-hidden="true" />
                  {error}
                  <button
                    type="button"
                    className="btn btn-ghost btn-sm"
                    onClick={() => void load()}
                  >
                    Spróbuj ponownie
                  </button>
                </div>
              )}
              {!loading && !error && filtered.length === 0 && (
                <div className="modal-state modal-state-center">
                  Brak modeli dla wybranych filtrów.
                </div>
              )}
              {!loading &&
                !error &&
                filtered.map((m) => {
                  const recommended = STARRED_RECOMMENDED.includes(m.id)
                  const free = isFreeModel(m)
                  const provider = providerOf(m)
                  const ctx = formatContext(m.top_provider?.context_length ?? m.context_length)
                  const inPrice = formatMTokPrice(m.pricing?.prompt)
                  const outPrice = formatMTokPrice(m.pricing?.completion)
                  const isSelected = m.id === selectedModel
                  return (
                    <button
                      key={m.id}
                      type="button"
                      className={`model-row ${isSelected ? 'selected' : ''}`}
                      onClick={() => handlePick(m)}
                    >
                      <div className="model-row-head">
                        {recommended && (
                          <Star size={14} aria-label="Polecany" className="color-accent" />
                        )}
                        <span className="model-row-name">{m.name}</span>
                        <span className="badge badge-soft">{provider}</span>
                        {free && <span className="badge badge-success">free</span>}
                        {supportsReasoning(m) && (
                          <span className="badge badge-info" title="Reasoning">
                            <Brain size={10} aria-hidden="true" /> reasoning
                          </span>
                        )}
                        {supportsImageInput(m) && (
                          <span className="badge badge-info" title="Wejście obrazów">
                            <ImageIcon size={10} aria-hidden="true" /> img
                          </span>
                        )}
                      </div>
                      <div className="model-row-meta text-faint text-xs">
                        <span title="ID modelu">{m.id}</span>
                        <span aria-hidden="true">·</span>
                        <span title="Długość kontekstu">{ctx}</span>
                        <span aria-hidden="true">·</span>
                        <span title="Cena promptu">in: {inPrice}</span>
                        <span aria-hidden="true">·</span>
                        <span title="Cena odpowiedzi">out: {outPrice}</span>
                      </div>
                      {m.description && (
                        <div className="model-row-desc text-sm text-muted">
                          {m.description.slice(0, 200)}
                          {m.description.length > 200 ? '…' : ''}
                        </div>
                      )}
                    </button>
                  )
                })}
            </div>

            <div className="flex justify-between items-center modal-footer-bordered">
              <span className="text-xs text-faint">
                {models
                  ? `${models.length} modeli ogółem · ${filtered.length} po filtrze`
                  : 'Ładowanie listy z OpenRouter…'}
              </span>
              <a
                href="https://openrouter.ai/models"
                target="_blank"
                rel="noreferrer"
                className="text-xs text-muted"
              >
                Szczegóły na openrouter.ai ↗
              </a>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
