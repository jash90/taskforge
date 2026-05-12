# Plan: dostosowanie aplikacji do CLAUDE/AGENTS i migracja CSS do Tailwind

## Context

- Aplikacja `taskforge` to React 19 + Vite 6 + TypeScript, z buildami web/desktop/mobile przez Tauri/Capacitor.
- Projekt używa obecnie jednego dużego arkusza `src/styles.css` (~2299 linii, 174 selektory, 23 media queries, 9 keyframes, 120 CSS custom properties).
- Tailwind nie jest jeszcze skonfigurowany: brak `tailwind.config.*`, `postcss.config.*`, brak zależności Tailwind w `package.json`.
- Decyzja produktowa: migracja ma przenieść całość custom CSS do Tailwind; nie zostawiamy resztek własnych selektorów w `src/styles.css`.
- `CLAUDE.md`/`AGENTS.md` wymagają świadomego audytu driftu, zachowania SOLID, feature-first oraz niewykonywania cichych refaktorów bez planu.

## Approach

- Wprowadzić konfigurację Tailwind dla Vite/React i zachować obecne zachowanie wizualne.
- Przenieść wszystkie style z `src/styles.css` do klas Tailwind, konfiguracji Tailwind i/lub pluginu Tailwind (`addBase`, `addUtilities`, `theme.extend`).
- `src/styles.css` ma zostać zredukowany wyłącznie do entrypointu Tailwind wymaganego przez narzędzie (np. dyrektywy `@tailwind`/import Tailwind), bez własnych selektorów, tokenów, keyframes ani custom utilities poza Tailwind configiem.
- Dla dotychczasowych nietypowych stylów użyć: arbitrary values/classes, theme tokens, custom animations w `tailwind.config.*`, wariantów `data-*`, `dark`, `motion-reduce`, `focus-visible` oraz responsive utilities.
- Przy okazji uporządkować największe komponenty zgodnie z wytycznymi z `CLAUDE.md`/`AGENTS.md`, ale bez niepotrzebnej zmiany zachowania i bez zmiany nazw katalogów `screens/` na `hooks/`.
- Utrzymać istniejące polskie copy, dostępność (`skip-link`, `aria-*`, focus states) oraz responsywność mobile/bottom-nav.

## Files to modify

- `package.json` / `package-lock.json` — dodać Tailwind/PostCSS/Autoprefixer oraz ewentualne skrypty weryfikacyjne, jeśli zdecydujemy się je dopisać.
- `tailwind.config.*` — nowa konfiguracja content paths, theme tokens, dark mode przez atrybut, animacje/keyframes i ewentualne własne utilities w pluginie Tailwind.
- `postcss.config.*` — nowa konfiguracja Tailwind dla Vite.
- `src/styles.css` — usunąć custom CSS; zostawić tylko entrypoint Tailwind wymagany przez build.
- `src/main.tsx` — utrzymać import globalnego CSS.
- `src/App.tsx` oraz komponenty w `src/components/**` — zamiana klas semantycznych CSS na klasy Tailwind.

## Reuse

- `src/styles.css` — źródło obecnych tokenów kolorów, spacingu, radii, cieni, breakpoints, animacji i stanów focus/hover.
- `src/hooks/useTheme.ts` — prawdopodobny punkt integracji z `darkMode`/atrybutem motywu Tailwind.
- `src/hooks/useFontScale.ts` oraz `src/components/FontSizeToggle.tsx` — zachować istniejące skalowanie fontu.
- `src/App.tsx` — zachować obecną strukturę nawigacji desktop/mobile, keep-alive i dostępność.
- `src/components/ThemeToggle.tsx`, `Toaster.tsx`, `ConfirmDialog.tsx`, `Pagination.tsx` — zachować wzorce interakcji i przepisać jedynie warstwę stylów.

## Steps

- [x] Dokończyć audyt: zmapować największe użycia klas z `src/styles.css` do konkretnych komponentów i wykryć klasy dynamiczne.
- [x] Dodać konfigurację Tailwind dla Vite, content paths `./index.html` i `./src/**/*.{ts,tsx}` oraz tryb dark zgodny z obecnym mechanizmem motywu.
- [x] Przenieść tokeny z CSS do Tailwind config: kolory, radiusy, shadow, font scale, breakpoints, animacje i keyframes.
- [x] Przenieść globalne style elementów (`body`, focus, inputs, scrollbar, sr-only, skip-link) do Tailwind utilities/classes lub pluginu `addBase`/`addUtilities`, nie do `src/styles.css`.
- [x] Przepisać layout aplikacji (`App.tsx`) na Tailwind: header, nav, main, bottom nav, sheet/drawer, loading states.
- [x] Przepisać komponenty formularzy, kart, list, badge, przycisków i paneli na Tailwind, preferując małe lokalne helpery/className constants tam, gdzie powtarzalność jest wysoka.
- [x] Zredukować `src/styles.css` do samego entrypointu Tailwind i usunąć wszystkie własne selektory/custom properties/keyframes z tego pliku.
- [x] Sprawdzić zgodność z `CLAUDE.md`: komponenty tylko renderują UI, logika pozostaje w hookach/serwisach, importy bez łamania warstw.
- [x] Uruchomić weryfikację i poprawić regresje wizualne/responsywne.

## Verification

- `npm run build:web` — build Vite musi przejść bez błędów.
- Manualnie w przeglądarce: główna nawigacja, edytor zadania, lista zadań, ustawienia, import/export, generator AI/testów.
- Sprawdzić motyw jasny/ciemny, skalowanie fontu, mobile viewport i bottom nav.
- Sprawdzić focus-visible, skip link, dialogi/toasty i stany loading/skeleton.
- Sprawdzić, że `src/styles.css` nie zawiera już własnych selektorów, custom properties ani keyframes — tylko entrypoint Tailwind.

## Decisions

- Dodanie Tailwind i aktualizacja lockfile są zaakceptowane.
- Celem jest pełne przeniesienie custom CSS do Tailwind/configu, bez pozostawiania resztek własnego CSS w `src/styles.css`.
