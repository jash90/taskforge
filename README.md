# TaskForge

System zarządzania **parametryzowanymi zadaniami edukacyjnymi** z klasyfikacją podstawy programowej, kluczem odpowiedzi, generowaniem testów i eksportem do Word.

## Architektura: One-File Multi-System

| System      | Build                   | Wynik                                               |
| ----------- | ----------------------- | --------------------------------------------------- |
| **Web**     | `npm run build:web`     | `dist/index.html` – jeden plik HTML (JS+CSS inline) |
| **Desktop** | `npm run build:desktop` | Pojedynczy plik binarny przez Tauri                 |
| **Mobile**  | `npm run build:mobile`  | APK (Android) / IPA (iOS) przez Capacitor           |

## Struktura źródeł

Kod aplikacji jest zorganizowany feature-first:

```text
src/
├── app/                  # shell aplikacji, routing zakładek i komponenty aplikacyjne
├── features/             # domeny biznesowe eksportowane przez index.ts
│   ├── ai-generation/    # generator AI i OpenRouter
│   ├── categories/       # kategorie, picker i drzewo kategorii
│   ├── export-import/    # import/eksport JSON, DOCX i helpery pobierania
│   ├── program-base/     # podstawa programowa i picker punktów
│   ├── settings/         # ustawienia oraz wybór modelu
│   ├── tasks/            # baza zadań, edytor, losowanie i parametryzacja
│   └── tests/            # generator testów
└── shared/               # wspólne UI, hooki, typy i serwisy techniczne
```

Zasady importów:

- kod między feature’ami importuje wyłącznie publiczne API z `@features/<feature>`,
- kod wspólny jest pod `@shared/*` i nie importuje z `@features/*`,
- `@app/*` obejmuje shell aplikacji,
- alias `@/*` zostaje tylko jako przejściowy alias do `src/*`.

## Funkcje

- 📝 **Baza zadań** – tworzenie, edycja, filtrowanie, tagi
- 🎲 **Parametryzacja** – automatyczne wykrywanie liczb i jednostek w treści zadania, możliwość losowania wariantów
- 📋 **Podstawa programowa** – przypisywanie punktów ze szkoły podstawowej / liceum / technikum
- 🔑 **Klucz odpowiedzi + punktacja** – szczegółowy klucz z wyjaśnieniami
- 📄 **Specyfikacja** – cel dydaktyczny, metoda, czas, trudność, kryteria oceny
- 📤 **Export/Import JSON** – pełna przenośność bazy
- 🧾 **Kopiowanie do Word** – format HTML clipboard z pełnym formatowaniem
- 🧪 **Generator testów** – komponowanie testów z zadań, losowanie kolejności, limit czasu, klucz odpowiedzi

## Stack

- React 19 + TypeScript
- Vite + vite-plugin-singlefile (inline wszystkiego do jednego HTML)
- Dexie.js + IndexedDB (lokalna baza)
- Tauri (desktop)
- Capacitor (Android + iOS)
- ESLint + Prettier

## Komendy

```bash
# Instalacja
npm install

# Dev serwer
npm run dev

# TypeScript bez emisji plików
npm run type-check

# Lint
npm run lint

# Formatowanie
npm run format
npm run format:check

# Szybka weryfikacja jakości
npm run test

# Web – jeden plik HTML
npm run build:web

# Desktop (Tauri – wymaga Rust)
npm run build:desktop

# Mobile – build + sync + otwórz Android Studio
npm run build:mobile

# iOS
npx cap open ios
```

## Weryfikacja przed PR

```bash
npm run type-check
npm run lint
npm run build:web
```

## Licencja

MIT
