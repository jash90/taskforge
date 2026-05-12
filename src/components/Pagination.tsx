import { ChevronLeft, ChevronRight, ChevronsLeft, ChevronsRight } from 'lucide-react';

interface Props {
  page: number;            // 1-based
  pageSize: number;        // 0 means "all"
  total: number;
  pageSizeOptions?: number[]; // 0 = all
  onPageChange: (page: number) => void;
  onPageSizeChange: (pageSize: number) => void;
  /** Polish noun for what's being paginated, e.g. ['punkt', 'punkty', 'punktów'] */
  itemNouns?: [string, string, string];
}

const polishCount = (n: number, [one, few, many]: [string, string, string]) => {
  if (n === 1) return one;
  const mod10 = n % 10;
  const mod100 = n % 100;
  if (mod10 >= 2 && mod10 <= 4 && (mod100 < 12 || mod100 > 14)) return few;
  return many;
};

const pageRange = (current: number, totalPages: number): (number | 'gap')[] => {
  if (totalPages <= 7) return Array.from({ length: totalPages }, (_, i) => i + 1);
  const out: (number | 'gap')[] = [1];
  const start = Math.max(2, current - 1);
  const end = Math.min(totalPages - 1, current + 1);
  if (start > 2) out.push('gap');
  for (let i = start; i <= end; i++) out.push(i);
  if (end < totalPages - 1) out.push('gap');
  out.push(totalPages);
  return out;
};

export default function Pagination({
  page,
  pageSize,
  total,
  pageSizeOptions = [50, 100, 250, 500, 0],
  onPageChange,
  onPageSizeChange,
  itemNouns = ['punkt', 'punkty', 'punktów'],
}: Props) {
  const showAll = pageSize === 0;
  const effectiveSize = showAll ? total : pageSize;
  const totalPages = Math.max(1, Math.ceil(total / Math.max(1, effectiveSize)));
  const safePage = Math.min(Math.max(1, page), totalPages);
  const start = total === 0 ? 0 : (safePage - 1) * effectiveSize + 1;
  const end = Math.min(safePage * effectiveSize, total);

  const range = pageRange(safePage, totalPages);

  return (
    <div className="flex items-center justify-between wrap pagination-bar">
      <div className="flex items-center gap-1 wrap min-w-0">
        <span className="text-sm text-muted">
          {total === 0
            ? `0 ${polishCount(0, itemNouns)}`
            : <>Wyświetlam <strong>{start}</strong>–<strong>{end}</strong> z <strong>{total}</strong> {polishCount(total, itemNouns)}</>}
        </span>
        <span className="text-faint" aria-hidden="true">·</span>
        <label className="flex items-center gap-1 mb-0 label-plain text-muted">
          Na stronę
          <select
            value={pageSize}
            onChange={(e) => onPageSizeChange(parseInt(e.target.value))}
            className="select-inline"
            aria-label="Rozmiar strony"
          >
            {pageSizeOptions.map((opt) => (
              <option key={opt} value={opt}>{opt === 0 ? 'Wszystkie' : opt}</option>
            ))}
          </select>
        </label>
      </div>

      {!showAll && totalPages > 1 && (
        <nav className="flex items-center gap-1" aria-label="Paginacja">
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => onPageChange(1)}
            disabled={safePage === 1}
            aria-label="Pierwsza strona"
          >
            <ChevronsLeft size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => onPageChange(safePage - 1)}
            disabled={safePage === 1}
            aria-label="Poprzednia strona"
          >
            <ChevronLeft size={14} aria-hidden="true" />
          </button>
          {range.map((n, i) =>
            n === 'gap' ? (
              <span key={`gap-${i}`} className="text-faint pagination-gap">…</span>
            ) : (
              <button
                key={n}
                type="button"
                className={`btn btn-sm btn-page ${n === safePage ? 'btn-primary' : 'btn-ghost'}`}
                onClick={() => onPageChange(n)}
                aria-current={n === safePage ? 'page' : undefined}
                aria-label={`Strona ${n}`}
              >
                {n}
              </button>
            ),
          )}
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => onPageChange(safePage + 1)}
            disabled={safePage === totalPages}
            aria-label="Następna strona"
          >
            <ChevronRight size={14} aria-hidden="true" />
          </button>
          <button
            type="button"
            className="btn btn-ghost btn-icon"
            onClick={() => onPageChange(totalPages)}
            disabled={safePage === totalPages}
            aria-label="Ostatnia strona"
          >
            <ChevronsRight size={14} aria-hidden="true" />
          </button>
        </nav>
      )}
    </div>
  );
}
