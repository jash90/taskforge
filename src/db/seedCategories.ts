import type { Category } from '../types';
import { isNestedCategoryFile, parseNestedCategories } from './categoryParser';

// Vite inlines every JSON in /kategorie at build time.
// Files use the Polish nested format: { kategorie: [{ nazwa, poddzialy: [{ nazwa, podpunkty[] }] }] }
const files = import.meta.glob<unknown>('../../kategorie/*.json', {
  eager: true,
  import: 'default',
});

/** Derive a stable file-prefix from the glob path so each file's nodes get unique ids. */
const prefixFor = (path: string): string => {
  const base = path.split('/').pop() || 'cat';
  return base.replace(/\.json$/i, '').replace(/[^a-z0-9]+/gi, '-').toLowerCase();
};

export const seedCategories: Category[] = Object.entries(files).flatMap(([path, data]) => {
  if (!isNestedCategoryFile(data)) return [];
  return parseNestedCategories(data, { idPrefix: prefixFor(path) });
});
