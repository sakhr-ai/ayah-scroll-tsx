# Rebuild report

## What was recreated

The supplied Ayah Scroll repository is a static HTML app assembled by a Python build script. It takes Quran text and translations from `quran-json` and inlines the dataset into a roughly 10 MB HTML file. The original interface has chapter and verse feeds, saved verses, language selection, reading plans, dark mode, recitation, copy, and tafsir links.

This archive recreates that reading experience in React + TypeScript (`.tsx`), CSS, and JavaScript tooling (Vite and the dataset preparation script).

## Clickable interaction changes

- Verse text is now a real, labeled button that opens its action sheet.
- Previous/next controls and keyboard arrow keys move through the feed.
- The surah drawer has search, chapter navigation, and bookmark shortcuts.
- Save/remove bookmark, copy, audio play/pause, tafsir, language, theme, and reading plan controls are wired to app state.
- Interactive controls have visible focus styles, minimum touch sizing, responsive layouts, and reduced-motion support.
- Position, bookmarks, translation, theme, reading plan, and daily progress persist in local storage.

## Run

```bash
npm install
npm run dev
```

The `predev` and `prebuild` scripts generate the local dataset from the `quran-json` package. Then run `npm run build` for a static production build in `dist/`.

## Scope and notes

- This is a functional web rebuild, not a pixel-identical copy of every source detail.
- Recitation loads audio from everyayah.com; preview hosts may block it.
- Quran text and translation datasets have distinct source terms. Review the dataset and translation terms before redistribution or public deployment. The archive does not bundle generated Quran data.
- The production JavaScript bundle is large because it contains the full text/translations at build time, consistent with the source app's single-file design.
- `wrangler.jsonc` declares a static-assets Worker and points Wrangler at `dist/`, preventing framework auto-detection from choosing Hydrogen.
