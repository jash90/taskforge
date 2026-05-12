import { CheckCircle, AlertTriangle, Info, X } from 'lucide-react'
import { dismissToast, useToasts, type ToastVariant } from '@shared/hooks/useToast'

const iconFor = (v: ToastVariant) =>
  v === 'success' ? CheckCircle : v === 'error' ? AlertTriangle : Info

export default function Toaster() {
  const toasts = useToasts()
  if (toasts.length === 0) return null

  return (
    <div className="toaster" aria-live="polite" aria-atomic="false">
      {toasts.map((t) => {
        const Icon = iconFor(t.variant)
        return (
          <div
            key={t.id}
            className={`toast ${t.variant}`}
            role={t.variant === 'error' ? 'alert' : 'status'}
          >
            <Icon className="toast-icon" size={18} aria-hidden="true" />
            <div className="toast-body">
              <div className="toast-title">{t.title}</div>
              {t.description && <div className="toast-desc">{t.description}</div>}
              {t.action && (
                <button
                  type="button"
                  className="toast-action"
                  onClick={() => {
                    t.action!.onPress()
                    dismissToast(t.id)
                  }}
                >
                  {t.action.label}
                </button>
              )}
            </div>
            <button
              type="button"
              className="toast-close"
              onClick={() => dismissToast(t.id)}
              aria-label="Zamknij powiadomienie"
            >
              <X size={14} aria-hidden="true" />
            </button>
          </div>
        )
      })}
    </div>
  )
}
