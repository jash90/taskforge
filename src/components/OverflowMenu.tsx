import { useEffect, useRef, useState, type ReactNode } from 'react';
import { MoreHorizontal } from 'lucide-react';

export interface OverflowItem {
  id: string;
  label: string;
  icon?: ReactNode;
  onSelect: () => void;
  variant?: 'default' | 'danger';
  divider?: boolean;
}

interface Props {
  items: OverflowItem[];
  ariaLabel: string;
}

export default function OverflowMenu({ items, ariaLabel }: Props) {
  const [open, setOpen] = useState(false);
  const rootRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!open) return;
    const onDoc = (e: MouseEvent) => {
      if (!rootRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDoc);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDoc);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  return (
    <div className="overflow-menu-anchor" ref={rootRef}>
      <button
        type="button"
        className="btn btn-ghost btn-icon"
        aria-label={ariaLabel}
        aria-haspopup="menu"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        <MoreHorizontal size={16} aria-hidden="true" />
      </button>
      {open && (
        <div className="overflow-menu" role="menu">
          {items.map((it) => (
            <div key={it.id}>
              {it.divider && <div className="overflow-menu-divider" role="separator" />}
              <button
                type="button"
                role="menuitem"
                className={`overflow-menu-item ${it.variant === 'danger' ? 'danger' : ''}`}
                onClick={() => { setOpen(false); it.onSelect(); }}
              >
                {it.icon}
                <span>{it.label}</span>
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
