import type { ProgramPoint } from '@shared/types'
import ConfirmDialog from '@shared/ui/ConfirmDialog'

interface ImportPreview {
  file: File
  points: ProgramPoint[]
}

interface Props {
  confirmDelete: ProgramPoint | null
  importPreview: ImportPreview | null
  onConfirmDelete: () => void
  onCancelDelete: () => void
  onConfirmImport: () => void
  onCancelImport: () => void
}

export default function ProgramBaseConfirmDialogs({
  confirmDelete,
  importPreview,
  onConfirmDelete,
  onCancelDelete,
  onConfirmImport,
  onCancelImport,
}: Props) {
  return (
    <>
      <ConfirmDialog
        open={!!confirmDelete}
        title="Usunąć punkt podstawy?"
        description={
          confirmDelete
            ? `${confirmDelete.code}: ${confirmDelete.description.slice(0, 100)}${confirmDelete.description.length > 100 ? '…' : ''}`
            : ''
        }
        confirmLabel="Usuń"
        destructive
        onConfirm={onConfirmDelete}
        onCancel={onCancelDelete}
      />
      <ConfirmDialog
        open={!!importPreview}
        title="Zaimportować podstawę programową?"
        description={
          importPreview
            ? `Plik „${importPreview.file.name}" zawiera ${importPreview.points.length} punktów. Istniejące rekordy o tym samym ID zostaną nadpisane.`
            : ''
        }
        confirmLabel="Importuj"
        cancelLabel="Anuluj"
        onConfirm={onConfirmImport}
        onCancel={onCancelImport}
      />
    </>
  )
}
