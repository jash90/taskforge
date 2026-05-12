import { Download, Eye, FileSpreadsheet, FileText, Trash2 } from 'lucide-react'

import { taskPoints } from '@features/export-import'
import type { Task, Test } from '@shared/types'
import OverflowMenu from '@shared/ui/OverflowMenu'

interface Props {
  tests: Test[] | undefined
  tasks: Task[] | undefined
  onPreview: (test: Test) => void
  onExport: (test: Test, withKey: boolean) => void
  onDelete: (test: Test) => void
}

export default function SavedTestsPanel({ tests, tasks, onPreview, onExport, onDelete }: Props) {
  return (
    <div className="panel">
      <div className="panel-title">Zapisane testy</div>
      <div className="task-list">
        {tests === undefined ? (
          [0, 1].map((i) => <div key={i} className="skeleton skeleton-card" />)
        ) : tests.length === 0 ? (
          <div className="empty-state empty-state-padded">
            <FileText size={32} aria-hidden="true" />
            <p>Brak zapisanych testów. Wybierz zadania i kliknij „Utwórz test".</p>
          </div>
        ) : (
          tests.map((test) => {
            const testTasks = (tasks || []).filter((t) => test.tasks.includes(t.id))
            const totalPoints = testTasks.reduce((sum, t) => sum + taskPoints(t), 0)
            return (
              <div key={test.id} className="card card-tight">
                <div className="flex justify-between items-center gap-1">
                  <div className="grow">
                    <strong>{test.title}</strong>
                    <div className="text-muted text-sm">
                      {test.tasks.length} zadań · {totalPoints} pkt ·{' '}
                      {new Date(test.generatedAt).toLocaleDateString('pl-PL')}
                    </div>
                  </div>
                  <div className="flex gap-1">
                    <button
                      type="button"
                      className="btn btn-secondary btn-sm"
                      onClick={() => onPreview(test)}
                      aria-label={`Podgląd ${test.title}`}
                    >
                      <Eye size={14} aria-hidden="true" />
                    </button>
                    <OverflowMenu
                      ariaLabel={`Więcej akcji dla ${test.title}`}
                      items={[
                        {
                          id: 'export',
                          label: 'Eksportuj test',
                          icon: <Download size={14} aria-hidden="true" />,
                          onSelect: () => onExport(test, false),
                        },
                        {
                          id: 'key',
                          label: 'Eksportuj klucz',
                          icon: <FileSpreadsheet size={14} aria-hidden="true" />,
                          onSelect: () => onExport(test, true),
                        },
                        {
                          id: 'del',
                          label: 'Usuń test',
                          icon: <Trash2 size={14} aria-hidden="true" />,
                          variant: 'danger',
                          divider: true,
                          onSelect: () => onDelete(test),
                        },
                      ]}
                    />
                  </div>
                </div>
              </div>
            )
          })
        )}
      </div>
    </div>
  )
}
