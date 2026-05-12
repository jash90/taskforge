import { useCallback, useEffect, useState } from 'react';

const STORAGE_KEY = 'taskforge.fontScale';

export const FONT_SCALE_MIN = 0.85;
export const FONT_SCALE_MAX = 1.4;
export const FONT_SCALE_STEP = 0.05;
export const FONT_SCALE_DEFAULT = 1.0;

export interface FontScalePreset {
  value: number;
  label: string;
  short: string;
}

export const FONT_SCALE_PRESETS: FontScalePreset[] = [
  { value: 0.9,  label: 'Małe',         short: 'A−'  },
  { value: 1.0,  label: 'Średnie',      short: 'A'   },
  { value: 1.15, label: 'Duże',         short: 'A+'  },
  { value: 1.3,  label: 'Bardzo duże',  short: 'A++' },
];

const LEGACY_ENUM_MAP: Record<string, number> = {
  sm: 0.9,
  md: 1.0,
  lg: 1.15,
  xl: 1.3,
};

const clamp = (n: number) => Math.min(FONT_SCALE_MAX, Math.max(FONT_SCALE_MIN, n));
const snap  = (n: number) => Math.round(n / FONT_SCALE_STEP) * FONT_SCALE_STEP;

const read = (): number => {
  if (typeof window === 'undefined') return FONT_SCALE_DEFAULT;
  const v = window.localStorage.getItem(STORAGE_KEY);
  if (v === null) return FONT_SCALE_DEFAULT;
  if (v in LEGACY_ENUM_MAP) return LEGACY_ENUM_MAP[v];
  const n = parseFloat(v);
  return Number.isFinite(n) ? clamp(n) : FONT_SCALE_DEFAULT;
};

const formatScale = (n: number) => {
  // Round to step grid so 1.1500000001 doesn't appear.
  return +snap(n).toFixed(2);
};

const apply = (n: number) => {
  const v = formatScale(n);
  document.documentElement.style.setProperty('--font-scale', String(v));
  document.documentElement.dataset.fontScale = String(v);
};

/** Returns the matching preset key (sm/md/lg/xl) for a given numeric scale,
 *  or empty string for in-between values. Used by CSS hooks like `[data-font-scale-key="xl"]`. */
const presetKey = (n: number): string => {
  const v = formatScale(n);
  if (v <= 0.95) return 'sm';
  if (v < 1.07)  return 'md';
  if (v < 1.22)  return 'lg';
  return 'xl';
};

export function useFontScale() {
  const [scale, setScaleState] = useState<number>(() => read());

  useEffect(() => {
    apply(scale);
    document.documentElement.dataset.fontScaleKey = presetKey(scale);
    window.localStorage.setItem(STORAGE_KEY, String(formatScale(scale)));
  }, [scale]);

  const setScale = useCallback((n: number) => {
    setScaleState(clamp(n));
  }, []);

  const reset = useCallback(() => setScaleState(FONT_SCALE_DEFAULT), []);

  return { scale: formatScale(scale), setScale, reset };
}

export { presetKey };
