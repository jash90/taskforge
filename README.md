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

## Auto-aktualizacje (Tauri Updater)

Aplikacja desktopowa po starcie (z 5-sekundowym opóźnieniem) sprawdza
endpoint `https://github.com/jash90/taskforge/releases/latest/download/latest.json`
i — jeśli jest nowsza wersja — pokazuje toast z przyciskiem **Zainstaluj**.
Pobranie + instalacja + restart dzieje się w aplikacji bez ręcznego ściągania
instalatora. Działa dla **Windows MSI** i **Linux AppImage**. Portable `.zip`
oraz `.deb` nie są wspierane przez updater — tam pozostaje ręczne pobranie z
GitHub Releases.

### Wymagana jednorazowa konfiguracja (pierwszy release)

1. **Wygeneruj klucze updatera lokalnie:**

   ```bash
   npx tauri signer generate -w ~/.tauri/taskforge.key
   ```

   - Wpisz mocne hasło (zapisz w menedżerze haseł — bez niego nie podpiszesz aktualizacji).
   - Powstaną dwa pliki: `~/.tauri/taskforge.key` (prywatny, NIGDY do gita)
     i `~/.tauri/taskforge.key.pub` (publiczny, można commitować).

2. **Wklej klucz publiczny** z `~/.tauri/taskforge.key.pub` do
   `src-tauri/tauri.conf.json`, w polu `plugins.updater.pubkey` (zastępując
   placeholder `REPLACE_WITH_TAURI_SIGNER_PUBKEY`).

3. **Dodaj dwa sekrety do repozytorium GitHub**
   (Settings → Secrets and variables → Actions):

   - `TAURI_SIGNING_PRIVATE_KEY` — pełna zawartość pliku `~/.tauri/taskforge.key`
   - `TAURI_SIGNING_PRIVATE_KEY_PASSWORD` — hasło wpisane w kroku 1

4. **Wytagguj release** (`git tag v1.0.4 && git push --tags`). CI:
   - podpisze MSI / AppImage kluczem prywatnym,
   - wygeneruje `latest.json` (manifest updatera) i wgra go do release draftu,
   - po opublikowaniu draftu aplikacje na komputerach użytkowników wykryją update.

### Uwagi

- Klucz publiczny jest częścią binarki — **utrata klucza prywatnego = nowa
  aplikacja z nowym kluczem + reinstalacja u wszystkich użytkowników**.
  Trzymaj backup w bezpiecznym miejscu (1Password, vault, itp.).
- `releases/latest/...` wskazuje tylko **opublikowane** release'y. Draft trzeba
  ręcznie opublikować, żeby updater go zobaczył.
- Wersja w `tauri.conf.json` jest porównywana semver z manifestem — niższa
  lokalna wersja = updater uznaje, że jest aktualizacja.

## Licencja

MIT
