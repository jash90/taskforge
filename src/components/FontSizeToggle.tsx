import { useEffect, useRef, useState } from 'react';
import { Type, RotateCcw } from 'lucide-react';
import {
  useFontScale,
  FONT_SCALE_MIN,
  FONT_SCALE_MAX,
  FONT_SCALE_STEP,
  FONT_SCALE_DEFAULT,
  FONT_SCALE_PRESETS,
  presetKey,
} from '../hooks/useFontScale';

export default function FontSizeToggle() {
  const { scale, setScale, reset } = useFontScale();
  const [open, setOpen] = useState(false);
  const wrapperRef = useRef<HTMLDivElement>(null);
  const triggerLabel = `Rozmiar czcionki: ${Math.round(scale * 100)}%`;

  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent | TouchEvent) => {
      if (!wrapperRef.current?.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDown);
    document.addEventListener('touchstart', onDown);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onDown);
      document.removeEventListener('touchstart', onDown);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  const currentKey = presetKey(scale);
  const shortLabel = FONT_SCALE_PRESETS.find((p) => presetKey(p.value) === currentKey)?.short ?? 'A';

  return (
    <div className="font-size-wrapper" ref={wrapperRef}>
      <button
        type="button"
        className="theme-toggle font-size-toggle"
        onClick={() => setOpen((v) => !v)}
        aria-label={triggerLabel}
        aria-haspopup="dialog"
        aria-expanded={open}
        title={triggerLabel}
        data-scale={currentKey}
      >
        <Type size={18} aria-hidden="true" />
        <span className="font-size-toggle-label" aria-hidden="true">{shortLabel}</span>
      </button>

      {open && (
        <div className="font-size-popover" role="dialog" aria-label="Rozmiar czcionki">
          <div className="font-size-popover-header">
            <span className="text-sm font-semibold">Rozmiar czcionki</span>
            <span className="badge badge-primary">{Math.round(scale * 100)}%</span>
          </div>

          <input
            type="range"
            className="font-size-slider"
            min={FONT_SCALE_MIN}
            max={FONT_SCALE_MAX}
            step={FONT_SCALE_STEP}
            value={scale}
            onChange={(e) => setScale(parseFloat(e.target.value))}
            aria-label="Suwak rozmiaru czcionki"
          />

          <div className="font-size-popover-marks" aria-hidden="true">
            <span>{Math.round(FONT_SCALE_MIN * 100)}%</span>
            <span>100%</span>
            <span>{Math.round(FONT_SCALE_MAX * 100)}%</span>
          </div>

          <div className="font-size-popover-presets">
            {FONT_SCALE_PRESETS.map((p) => (
              <button
                key={p.value}
                type="button"
                className={`btn btn-secondary btn-sm ${Math.abs(scale - p.value) < 0.01 ? 'active' : ''}`}
                onClick={() => setScale(p.value)}
                title={p.label}
              >
                {p.short}
              </button>
            ))}
            <button
              type="button"
              className="btn btn-ghost btn-sm"
              onClick={reset}
              title="Przywróć domyślny"
              disabled={Math.abs(scale - FONT_SCALE_DEFAULT) < 0.01}
            >
              <RotateCcw size={12} aria-hidden="true" /> Reset
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
