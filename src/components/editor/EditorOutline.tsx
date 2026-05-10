import { useEffect, useState } from 'react';

export interface OutlineEntry {
  id: string;
  label: string;
  filled: boolean;
}

interface Props {
  entries: OutlineEntry[];
  scrollContainer: HTMLElement | null;
}

export default function EditorOutline({ entries, scrollContainer }: Props) {
  const [activeId, setActiveId] = useState<string>(entries[0]?.id ?? '');

  useEffect(() => {
    if (!scrollContainer) return;
    const sections = entries
      .map((e) => document.getElementById(e.id))
      .filter((el): el is HTMLElement => !!el);
    if (sections.length === 0) return;

    const observer = new IntersectionObserver(
      (records) => {
        const visible = records
          .filter((r) => r.isIntersecting)
          .sort((a, b) => a.boundingClientRect.top - b.boundingClientRect.top);
        if (visible[0]) setActiveId(visible[0].target.id);
      },
      { root: scrollContainer, rootMargin: '0px 0px -65% 0px', threshold: 0.01 },
    );
    sections.forEach((s) => observer.observe(s));
    return () => observer.disconnect();
  }, [entries, scrollContainer]);

  const goTo = (id: string) => {
    const el = document.getElementById(id);
    if (!el) return;
    el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    setActiveId(id);
  };

  return (
    <aside className="editor-rail" aria-label="Sekcje edytora">
      {entries.map((e) => (
        <button
          key={e.id}
          type="button"
          className={`rail-item ${activeId === e.id ? 'active' : ''}`}
          onClick={() => goTo(e.id)}
          aria-current={activeId === e.id ? 'true' : undefined}
        >
          <span className={`rail-dot ${e.filled ? 'filled' : ''}`} aria-hidden="true" />
          <span>{e.label}</span>
        </button>
      ))}
    </aside>
  );
}
