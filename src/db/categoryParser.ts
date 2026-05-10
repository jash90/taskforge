import type { Category } from '../types';

export interface NestedCategoryFile {
  kategorie: NestedCategoryRoot[];
}

interface NestedCategoryRoot {
  nazwa: string;
  poddzialy?: NestedSub[];
}

interface NestedSub {
  nazwa: string;
  podpunkty?: string[];
}

export function isNestedCategoryFile(data: unknown): data is NestedCategoryFile {
  if (!data || typeof data !== 'object') return false;
  const d = data as Record<string, unknown>;
  if (!Array.isArray(d.kategorie)) return false;
  return d.kategorie.every((r) => !!r && typeof r === 'object' && typeof (r as { nazwa?: unknown }).nazwa === 'string');
}

interface ParseOptions {
  /** Prefix used for deterministic IDs (lets re-imports be idempotent). */
  idPrefix?: string;
}

export function parseNestedCategories(
  data: NestedCategoryFile,
  { idPrefix = 'fiz' }: ParseOptions = {},
): Category[] {
  const out: Category[] = [];
  const now = Date.now();
  data.kategorie.forEach((root, ri) => {
    const rootId = `cat-${idPrefix}-r${ri + 1}`;
    out.push({
      id: rootId,
      name: root.nazwa.trim(),
      parentId: null,
      position: ri + 1,
      createdAt: now,
      updatedAt: now,
    });
    (root.poddzialy ?? []).forEach((sub, si) => {
      const subId = `cat-${idPrefix}-r${ri + 1}-s${si + 1}`;
      out.push({
        id: subId,
        name: sub.nazwa.trim(),
        parentId: rootId,
        position: si + 1,
        createdAt: now,
        updatedAt: now,
      });
      (sub.podpunkty ?? []).forEach((leaf, li) => {
        out.push({
          id: `cat-${idPrefix}-r${ri + 1}-s${si + 1}-p${li + 1}`,
          name: leaf.trim(),
          parentId: subId,
          position: li + 1,
          createdAt: now,
          updatedAt: now,
        });
      });
    });
  });
  return out;
}
