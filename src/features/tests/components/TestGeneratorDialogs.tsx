import { X } from 'lucide-react'

import { CategoryPicker } from '@features/categories'
import { pathLabel } from '@features/categories'
import { ProgramPointPicker } from '@features/program-base'
import { renderParameterized } from '@features/tasks'
import { taskPoints } from '@features/export-import'
import type { Category, ProgramPoint, Task } from '@shared/types'

interface CategoryFilterDialogProps {
  open: boolean
  categories: Category[] | undefined
  selectedIds: string[]
  onChange: (ids: string[]) => void
  onClose: () => void
}

export function CategoryFilterDialog({
  open,
  categories,
  selectedIds,
  onChange,
  onClose,
}: CategoryFilterDialogProps) {
  if (!open) return null
  return (
    <div className="overlay" onMouseDown={onClose} role="presentation">
      <div
        className="overlay-content max-w-720"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="cat-filter-title-tg"
      >
        <div className="flex justify-between items-center mb-2">
          <h2 id="cat-filter-title-tg" className="card-title mb-0">
            Filtruj zadania po kategoriach
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={14} aria-hidden="true" /> Zamknij
          </button>
        </div>
        <p className="text-muted text-sm mb-2">
          Wybór kategorii nadrzędnej dopasowuje też zadania przypisane do jej podkategorii. Test
          złożysz z zadań pasujących do co najmniej jednej z wybranych kategorii.
        </p>
        <CategoryPicker
          categories={categories || []}
          selectedIds={selectedIds}
          onChange={onChange}
        />
        <div className="flex gap-1 justify-end mt-2">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Gotowe ({selectedIds.length})
          </button>
        </div>
      </div>
    </div>
  )
}

interface ProgramPointFilterDialogProps {
  open: boolean
  programPoints: ProgramPoint[] | undefined
  selectedIds: Set<string>
  taskCountByPpId: Map<string, number>
  onToggle: (id: string) => void
  onClear: () => void
  onClose: () => void
}

export function ProgramPointFilterDialog({
  open,
  programPoints,
  selectedIds,
  taskCountByPpId,
  onToggle,
  onClear,
  onClose,
}: ProgramPointFilterDialogProps) {
  if (!open) return null
  return (
    <div className="overlay" onMouseDown={onClose} role="presentation">
      <div
        className="overlay-content max-w-880"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="pp-picker-title"
      >
        <div className="flex justify-between items-center mb-2">
          <h2 id="pp-picker-title" className="card-title mb-0">
            Filtruj zadania po podstawie programowej
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={14} aria-hidden="true" /> Zamknij
          </button>
        </div>
        <p className="text-muted text-sm mb-2">
          Zaznacz punkty, których ma dotyczyć test. Pokażemy tylko zadania powiązane z którymkolwiek
          z wybranych punktów.
        </p>
        <ProgramPointPicker
          programPoints={programPoints || []}
          selectedIds={selectedIds}
          onToggle={onToggle}
          onClear={onClear}
          taskCountByPpId={taskCountByPpId}
        />
        <div className="flex gap-1 justify-end mt-2">
          <button type="button" className="btn btn-primary" onClick={onClose}>
            Gotowe ({selectedIds.size})
          </button>
        </div>
      </div>
    </div>
  )
}

interface TestPreviewDialogProps {
  title: string
  tasks: Task[]
  onClose: () => void
}

export function TestPreviewDialog({ title, tasks, onClose }: TestPreviewDialogProps) {
  return (
    <div className="overlay" onMouseDown={onClose} role="presentation">
      <div
        className="overlay-content"
        onMouseDown={(e) => e.stopPropagation()}
        role="dialog"
        aria-modal="true"
        aria-labelledby="preview-title"
      >
        <div className="flex justify-between items-center mb-2">
          <h2 id="preview-title" className="card-title mb-0">
            Podgląd: {title}
          </h2>
          <button type="button" className="btn btn-ghost btn-sm" onClick={onClose}>
            <X size={14} aria-hidden="true" /> Zamknij
          </button>
        </div>
        <p className="text-muted text-sm mb-2">
          Parametry zostały wylosowane na potrzeby podglądu.
        </p>
        <div className="task-list">
          {tasks.map((t, i) => (
            <div key={t.id} className="card card-tight">
              <div className="flex justify-between items-center">
                <strong>Zadanie {i + 1}</strong>
                <span className="badge badge-success">{taskPoints(t)} pkt</span>
              </div>
              <div className="preview-box mt-1">
                {renderParameterized(t.content, t.parameters)}
                {t.taskType === 'closed' && t.choices && t.choices.length > 0 && (
                  <ol className="preview-list is-tight">
                    {t.choices.map((c, ci) => (
                      <li key={c.id}>
                        <strong>{String.fromCharCode(97 + ci)})</strong>{' '}
                        {renderParameterized(c.content, t.parameters)}
                      </li>
                    ))}
                  </ol>
                )}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  )
}

export { pathLabel }
