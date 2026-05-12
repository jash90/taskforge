import { X } from 'lucide-react'

import { CategoryPicker } from '@features/categories'
import { ProgramPointPicker } from '@features/program-base'
import type { Category, ProgramPoint } from '@shared/types'

interface Props {
  ppPickerOpen: boolean
  catPickerOpen: boolean
  programPoints: ProgramPoint[] | undefined
  categories: Category[] | undefined
  selectedPP: Set<string>
  selectedCategories: string[]
  taskCountByPpId: Map<string, number>
  onClosePP: () => void
  onCloseCategories: () => void
  onTogglePP: (id: string) => void
  onClearPP: () => void
  onCategoriesChange: (ids: string[]) => void
}

export default function AIPickers({
  ppPickerOpen,
  catPickerOpen,
  programPoints,
  categories,
  selectedPP,
  selectedCategories,
  taskCountByPpId,
  onClosePP,
  onCloseCategories,
  onTogglePP,
  onClearPP,
  onCategoriesChange,
}: Props) {
  return (
    <>
      {ppPickerOpen && (
        <div className="overlay" onMouseDown={onClosePP} role="presentation">
          <div
            className="overlay-content max-w-880"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center mb-2">
              <h2 className="card-title mb-0">Punkty podstawy programowej</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onClosePP}>
                <X size={14} aria-hidden="true" /> Zamknij
              </button>
            </div>
            <ProgramPointPicker
              programPoints={programPoints || []}
              selectedIds={selectedPP}
              onToggle={onTogglePP}
              onClear={onClearPP}
              taskCountByPpId={taskCountByPpId}
            />
            <div className="flex justify-end mt-2">
              <button type="button" className="btn btn-primary" onClick={onClosePP}>
                Gotowe ({selectedPP.size})
              </button>
            </div>
          </div>
        </div>
      )}

      {catPickerOpen && (
        <div className="overlay" onMouseDown={onCloseCategories} role="presentation">
          <div
            className="overlay-content max-w-720"
            onMouseDown={(e) => e.stopPropagation()}
            role="dialog"
            aria-modal="true"
          >
            <div className="flex justify-between items-center mb-2">
              <h2 className="card-title mb-0">Kategorie</h2>
              <button type="button" className="btn btn-ghost btn-sm" onClick={onCloseCategories}>
                <X size={14} aria-hidden="true" /> Zamknij
              </button>
            </div>
            <CategoryPicker
              categories={categories || []}
              selectedIds={selectedCategories}
              onChange={onCategoriesChange}
            />
            <div className="flex justify-end mt-2">
              <button type="button" className="btn btn-primary" onClick={onCloseCategories}>
                Gotowe ({selectedCategories.length})
              </button>
            </div>
          </div>
        </div>
      )}
    </>
  )
}
