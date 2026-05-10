# TaskForge

System zarządzania **parametryzowanymi zadaniami edukacyjnymi** z klasyfikacją podstawy programowej, kluczem odpowiedzi, generowaniem testów i eksportem do Word.

## Architektura: One-File Multi-System

| System | Build | Wynik |
|--------|-------|-------|
| **Web** | `npm run build:web` | `dist/index.html` – jeden plik HTML (JS+CSS inline) |
| **Desktop** | `npm run build:desktop` | Pojedynczy plik binarny przez Tauri |
| **Mobile** | `npm run build:mobile` | APK (Android) / IPA (iOS) przez Capacitor |

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

## Komendy

```bash
# Instalacja
npm install

# Dev serwer
npm run dev

# Web – jeden plik HTML
npm run build:web

# Desktop (Tauri – wymaga Rust)
npm run build:desktop

# Mobile – build + sync + otwórz Android Studio
npm run build:mobile

# iOS
npx cap open ios
```

## Licencja

MIT