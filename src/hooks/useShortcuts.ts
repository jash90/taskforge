import { useEffect, useRef } from 'react';

export interface Shortcut {
  /** "mod" maps to ⌘ on macOS, Ctrl elsewhere. Combine with "+" — e.g. "mod+k", "mod+s". */
  combo: string;
  handler: (e: KeyboardEvent) => void;
  /** When true, ignores the shortcut while the user is typing in an input/textarea/select. */
  allowInInputs?: boolean;
}

const isMac = () =>
  typeof navigator !== 'undefined' && /Mac|iPhone|iPad|iPod/.test(navigator.platform);

const isTypingTarget = (el: EventTarget | null): boolean => {
  if (!(el instanceof HTMLElement)) return false;
  const tag = el.tagName;
  if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return true;
  if (el.isContentEditable) return true;
  return false;
};

interface ParsedCombo {
  mod: boolean;
  shift: boolean;
  alt: boolean;
  key: string;
}

const parseCombo = (combo: string): ParsedCombo => {
  const parts = combo.toLowerCase().split('+').map((p) => p.trim());
  return {
    mod: parts.includes('mod') || parts.includes('cmd') || parts.includes('ctrl'),
    shift: parts.includes('shift'),
    alt: parts.includes('alt') || parts.includes('option'),
    key: parts[parts.length - 1],
  };
};

const matches = (e: KeyboardEvent, parsed: ParsedCombo): boolean => {
  const modPressed = isMac() ? e.metaKey : e.ctrlKey;
  if (parsed.mod !== modPressed) return false;
  // Only enforce shift/alt when the combo explicitly opts in. Many character
  // keys can only be produced WITH shift on common layouts (e.g. "?", "!",
  // "@") — requiring shift=false on the combo would make those shortcuts
  // impossible to trigger from a real keyboard.
  if (parsed.shift && !e.shiftKey) return false;
  if (parsed.alt && !e.altKey) return false;
  return e.key.toLowerCase() === parsed.key;
};

/**
 * Register keyboard shortcuts for the lifetime of the calling component.
 * Listeners are bound to `window` capture phase to win over inputs.
 */
export function useShortcuts(shortcuts: Shortcut[]): void {
  const shortcutsRef = useRef(shortcuts);
  shortcutsRef.current = shortcuts;

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const typing = isTypingTarget(e.target);
      for (const s of shortcutsRef.current) {
        if (typing && !s.allowInInputs) continue;
        const parsed = parseCombo(s.combo);
        if (matches(e, parsed)) {
          e.preventDefault();
          s.handler(e);
          return;
        }
      }
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, []);
}

/**
 * Sequence shortcut like "g t" — first key, then second within a short window.
 */
export function useSequenceShortcuts(
  sequences: { keys: [string, string]; handler: () => void }[],
  windowMs = 800
): void {
  const seqRef = useRef(sequences);
  seqRef.current = sequences;

  useEffect(() => {
    let firstKey: string | null = null;
    let timer: ReturnType<typeof setTimeout> | null = null;

    const reset = () => {
      firstKey = null;
      if (timer) { clearTimeout(timer); timer = null; }
    };

    const onKey = (e: KeyboardEvent) => {
      if (isTypingTarget(e.target)) { reset(); return; }
      if (e.metaKey || e.ctrlKey || e.altKey) { reset(); return; }
      const k = e.key.toLowerCase();
      if (!firstKey) {
        const candidates = seqRef.current.filter((s) => s.keys[0] === k);
        if (candidates.length === 0) return;
        firstKey = k;
        timer = setTimeout(reset, windowMs);
        return;
      }
      const match = seqRef.current.find((s) => s.keys[0] === firstKey && s.keys[1] === k);
      if (match) {
        e.preventDefault();
        match.handler();
      }
      reset();
    };

    window.addEventListener('keydown', onKey);
    return () => { window.removeEventListener('keydown', onKey); reset(); };
  }, [windowMs]);
}
