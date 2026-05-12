import type { Category } from '@shared/types'

export interface CategoryNode extends Category {
  children: CategoryNode[]
  depth: number
}

const sortNodes = (a: CategoryNode, b: CategoryNode) => {
  const ap = a.position ?? a.createdAt
  const bp = b.position ?? b.createdAt
  return ap - bp
}

export function buildTree(categories: Category[]): CategoryNode[] {
  const map = new Map<string, CategoryNode>()
  for (const c of categories) {
    map.set(c.id, { ...c, children: [], depth: 0 })
  }
  const roots: CategoryNode[] = []
  for (const c of categories) {
    const node = map.get(c.id)!
    if (c.parentId && map.has(c.parentId)) {
      map.get(c.parentId)!.children.push(node)
    } else {
      roots.push(node)
    }
  }
  const setDepth = (node: CategoryNode, depth: number) => {
    node.depth = depth
    node.children.sort(sortNodes)
    for (const child of node.children) setDepth(child, depth + 1)
  }
  roots.sort(sortNodes)
  for (const r of roots) setDepth(r, 0)
  return roots
}

/** Flatten the visible tree honoring expanded state, depth-first. */
export function flattenTree(roots: CategoryNode[], expanded: Set<string>): CategoryNode[] {
  const out: CategoryNode[] = []
  const walk = (n: CategoryNode) => {
    out.push(n)
    if (expanded.has(n.id)) {
      for (const c of n.children) walk(c)
    }
  }
  for (const r of roots) walk(r)
  return out
}

/** Collect all descendant ids (not including the node itself). */
export function descendantIds(node: CategoryNode): string[] {
  const out: string[] = []
  const walk = (n: CategoryNode) => {
    for (const c of n.children) {
      out.push(c.id)
      walk(c)
    }
  }
  walk(node)
  return out
}

/** Path from root to node, joined by " / " — for breadcrumbs/labels. */
export function pathLabel(categories: Category[], id: string): string {
  const byId = new Map(categories.map((c) => [c.id, c] as const))
  const parts: string[] = []
  let cur: Category | undefined = byId.get(id)
  let safety = 0
  while (cur && safety < 100) {
    parts.unshift(cur.name)
    cur = cur.parentId ? byId.get(cur.parentId) : undefined
    safety += 1
  }
  return parts.join(' / ')
}

export function findNode(roots: CategoryNode[], id: string): CategoryNode | null {
  for (const r of roots) {
    if (r.id === id) return r
    const child = findNode(r.children, id)
    if (child) return child
  }
  return null
}

/** Returns true if `parentId` is `id` itself or any descendant of `id` — used to prevent cycles when re-parenting. */
export function isDescendantOf(roots: CategoryNode[], id: string, parentId: string): boolean {
  if (id === parentId) return true
  const node = findNode(roots, id)
  if (!node) return false
  return descendantIds(node).includes(parentId)
}
