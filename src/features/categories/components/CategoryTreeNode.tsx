import { type ReactNode } from 'react'
import { ChevronDown, ChevronRight } from 'lucide-react'
import type { CategoryNode } from '../utils/categoryTree'

interface Props {
  node: CategoryNode
  expanded: Set<string>
  onToggleExpand: (id: string) => void
  /** Render the row's leading content (checkbox, drag handle). */
  renderLeading?: (node: CategoryNode) => ReactNode
  /** Render the row's trailing content (action buttons). */
  renderTrailing?: (node: CategoryNode) => ReactNode
  /** Optional className for the row, e.g. "selected" highlight. */
  rowClassName?: (node: CategoryNode) => string
  /** Optional click handler for the label area. */
  onSelect?: (node: CategoryNode) => void
  /** Indentation in pixels per depth level. */
  indent?: number
  /** Render content immediately after this node's row (e.g. an inline form). */
  renderAfterRow?: (node: CategoryNode) => ReactNode
}

export default function CategoryTreeNode({
  node,
  expanded,
  onToggleExpand,
  renderLeading,
  renderTrailing,
  rowClassName,
  onSelect,
  indent = 18,
  renderAfterRow,
}: Props) {
  const hasChildren = node.children.length > 0
  const isExpanded = expanded.has(node.id)
  const Icon = isExpanded ? ChevronDown : ChevronRight
  const className = rowClassName?.(node) ?? ''

  return (
    <>
      <div className={`category-row ${className}`.trim()} data-depth={Math.min(node.depth, 8)}>
        <button
          type="button"
          className="category-row-toggle"
          onClick={() => hasChildren && onToggleExpand(node.id)}
          aria-label={
            hasChildren ? (isExpanded ? `Zwiń ${node.name}` : `Rozwiń ${node.name}`) : undefined
          }
          aria-expanded={hasChildren ? isExpanded : undefined}
          disabled={!hasChildren}
          tabIndex={hasChildren ? 0 : -1}
        >
          {hasChildren ? (
            <Icon size={14} aria-hidden="true" />
          ) : (
            <span className="tree-icon-placeholder" aria-hidden="true" />
          )}
        </button>

        {renderLeading?.(node)}

        <button
          type="button"
          className={`category-row-label ${onSelect ? 'cursor-pointer' : 'cursor-default'}`}
          onClick={() => onSelect?.(node)}
          tabIndex={onSelect ? 0 : -1}
        >
          <span className="category-row-name">{node.name}</span>
          {hasChildren && (
            <span className="text-faint text-xs" aria-hidden="true">
              {node.children.length}
            </span>
          )}
        </button>

        {renderTrailing?.(node)}
      </div>

      {renderAfterRow?.(node)}

      {isExpanded &&
        node.children.map((child) => (
          <CategoryTreeNode
            key={child.id}
            node={child}
            expanded={expanded}
            onToggleExpand={onToggleExpand}
            renderLeading={renderLeading}
            renderTrailing={renderTrailing}
            rowClassName={rowClassName}
            onSelect={onSelect}
            indent={indent}
            renderAfterRow={renderAfterRow}
          />
        ))}
    </>
  )
}
