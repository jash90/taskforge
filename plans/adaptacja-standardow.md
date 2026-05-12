# Plan: pełna adaptacja TaskForge do CLAUDE.md i AGENTS.md

## Context

Użytkownik chce pełnej migracji aplikacji do standardów z `CLAUDE.md` i `AGENTS.md`, nawet kosztem dużej reorganizacji plików. Dozwolone jest dodanie zależności developerskich dla lintowania, formatowania i testów.

Ustalenia:

- Docelowo projekt ma mieć strukturę `src/features/*` + `src/shared/*`, bez zachowywania płaskiego układu jako odstępstwa.
- Migracja ma objąć architekturę, importy, narzędzia jakości i największe naruszenia limitów plików.
- Zachowanie aplikacji ma pozostać takie samo; refaktor dotyczy organizacji i utrzymania kodu.

Audyt:

- Projekt: React 19 + TypeScript + Vite, Dexie/IndexedDB, Tauri, Capacitor.
- `tsconfig.json` ma `strict: true` i alias `@/*`.
- `package.json` nie ma `type-check`, `lint`, `format`, `test`; CI buduje Tauri przez `npm ci`.
- Obecne katalogi źródeł: `components`, `hooks`, `db`, `types`, `utils`.
- Największe pliki przekraczają limit 500 linii: `TaskEditor.tsx`, `AITaskGenerator.tsx`, `TestGenerator.tsx`, `ProgramBaseViewer.tsx`; blisko limitu są `TaskList.tsx`, `utils/export.ts`, `CategoryManager.tsx`.

## Approach

Wykonać migrację warstwowo, ale w ramach jednego spójnego refaktoru:

1. Najpierw dodać standardy narzędziowe: skrypty `type-check`, `lint`, `format`, konfiguracje ESLint/Prettier i zależności dev.
2. Następnie zbudować docelowy szkielet `features/` i `shared/`.
3. Przenieść istniejący kod bez zmiany zachowania, wprowadzając baryłki `index.ts` jako publiczne API feature’ów.
4. Rozbić największe komponenty na ekrany, komponenty lokalne i hooki/orchestratory zgodnie z Clean Architecture.
5. Na końcu przepiąć importy na aliasy, usunąć stary płaski układ i uruchomić weryfikację.

## Files to modify

Konfiguracja i dokumentacja:

- `package.json`
- `package-lock.json`
- `tsconfig.json`
- `vite.config.ts`
- nowe pliki: `eslint.config.js` albo odpowiednik, `.prettierrc`, `.prettierignore`
- `README.md`
- opcjonalnie `.github/workflows/release.yml`, jeśli trzeba dołożyć kroki `type-check`/`lint`

Kod aplikacji:

- `src/App.tsx`
- `src/main.tsx`
- `src/styles.css`
- `src/components/**` — do przeniesienia i podziału
- `src/hooks/**` — do przeniesienia do `shared/hooks` albo feature-local `screens`/`hooks`
- `src/db/**` — do przeniesienia do `shared/services/db` albo feature-local services, z zachowaniem Dexie
- `src/utils/**` — do podziału między `shared/utils`, `shared/services` i feature-local utils
- `src/types/**` — do podziału między `shared/types` i typy domenowe

Docelowa struktura:

- `src/app/` — cienka powłoka aplikacji, routing zakładek, layout
- `src/features/tasks/`
- `src/features/tests/`
- `src/features/program-base/`
- `src/features/categories/`
- `src/features/settings/`
- `src/features/ai-generation/`
- `src/features/export-import/`
- `src/shared/ui/`
- `src/shared/components/`
- `src/shared/hooks/`
- `src/shared/services/`
- `src/shared/utils/`
- `src/shared/types/`

## Reuse

Zachować i przenieść zamiast pisać od zera:

- `src/db/index.ts` — Dexie schema, migracje i seedowanie jako baza dla `shared/services/db`.
- `src/db/seedPoints.ts`, `src/db/seedCategories.ts`, parsery — dane/seedy do zachowania.
- `src/hooks/useRoute.ts` — logika routingu do `src/app` lub `shared/hooks`, zależnie od finalnego podziału.
- `src/hooks/useTheme.ts`, `src/hooks/useFontScale.ts`, `src/hooks/useShortcuts.ts`, `src/hooks/useToast.ts` — przekrojowe hooki do `shared/hooks`.
- `src/hooks/useSettings.ts` — do `features/settings` lub `shared/hooks`, jeśli pozostaje globalne API ustawień.
- `src/utils/parameters.ts` — domenowa logika parametryzacji do `features/tasks` albo `shared/utils`, jeśli używana przez testy i losowanie.
- `src/utils/export.ts` — rozdzielić na eksport zadań/testów oraz wspólne helpery pobierania plików.
- `src/utils/openrouter.ts` — serwis AI do `features/ai-generation/services` albo `shared/services/ai`, bez logiki UI.
- `src/utils/categoryTree.ts` — logika domenowa kategorii do `features/categories/utils`.
- `src/components/ConfirmDialog.tsx`, `Pagination.tsx`, `OverflowMenu.tsx`, `Toaster.tsx`, `ThemeToggle.tsx`, `FontSizeToggle.tsx` — kandydaci do `shared/ui`/`shared/components`.

## Steps

- [x] Utworzyć gałąź roboczą poza `main` i sprawdzić baseline `npm run build:web`.
- [x] Dodać narzędzia jakości: ESLint, Prettier, skrypty `type-check`, `lint`, `format`, opcjonalnie prosty `test` placeholder lub realny runner, jeśli zostanie od razu skonfigurowany.
- [x] Dodać aliasy TypeScript/Vite dla `@app/*`, `@features/*`, `@shared/*` przy zachowaniu `@/*` tylko przejściowo lub usunięciu po migracji.
- [x] Utworzyć `src/app`, `src/features`, `src/shared` i baryłki `index.ts` dla feature’ów.
- [x] Przenieść globalny shell aplikacji z `App.tsx` do `src/app`, a `src/App.tsx` zostawić jako cienki eksport/adapter albo usunąć po aktualizacji importów.
- [x] Przenieść wspólne UI i hooki do `shared`, aktualizując importy na aliasy.
- [x] Wydzielić feature `tasks`: lista, edytor, parametryzacja, typy zadań i lokalne komponenty edytora.
- [x] Wydzielić feature `tests`: generator testów, eksport DOCX testów i typ `Test`.
- [x] Wydzielić feature `program-base`: przeglądarka/picker podstawy programowej, typ `ProgramPoint`, seedy punktów.
- [x] Wydzielić feature `categories`: manager, picker, tree node, `categoryTree` utils i typ `Category`.
- [x] Wydzielić feature `settings`: ekran ustawień, model picker i logikę przechowywania ustawień.
- [x] Wydzielić feature `ai-generation`: ekran generatora AI i serwis OpenRouter.
- [x] Wydzielić feature `export-import`: ekran importu/eksportu i serwisy plików; wspólne helpery pobierania zostawić w `shared`.
- [x] Rozbić pliki powyżej 500 linii na komponenty lokalne, hooki/orchestratory i serwisy, bez zmiany zachowania użytkownika.
- [x] Usunąć stare puste katalogi `src/components`, `src/hooks`, `src/db`, `src/utils`, `src/types` po przepięciu importów.
- [x] Zaktualizować `README.md` o nową strukturę i komendy weryfikacji.
- [x] Opcjonalnie dodać kroki `npm run type-check` i `npm run lint` do workflow CI przed buildem Tauri.

## Verification

- `npm run type-check`
- `npm run lint`
- `npm run format -- --check` albo odpowiednik zgodny z wybraną konfiguracją
- `npm run build:web`
- jeśli zostanie skonfigurowany runner: `npm run test`
- ręczny smoke test w dev serwerze:
  - przejście przez wszystkie zakładki,
  - dodanie i edycja zadania,
  - losowanie wariantu zadania,
  - wygenerowanie testu,
  - przypisanie podstawy programowej i kategorii,
  - eksport/import JSON,
  - zmiana ustawień, motywu i rozmiaru fontu,
  - generator AI z zachowaniem obecnego sposobu konfiguracji klucza/modelu.
- sprawdzić, że Dexie zachowuje nazwę bazy `TaskForgeDB`, migracje wersji 2–5 i seedowanie działają po przeniesieniu plików.
