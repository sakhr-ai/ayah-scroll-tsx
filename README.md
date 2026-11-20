# Ayah Scroll · React + TypeScript

A responsive rebuild of the Ayah Scroll repository as a Vite, React, TypeScript, and CSS app. The reading flow is one chapter or verse per screen, with explicit buttons and keyboard-accessible controls.

## Run it

```bash
npm install
npm run dev
```

Vite prints a local address (usually `http://localhost:5173`). For a production build, run `npm run build`; serve the generated `dist/` folder with any static host.

## Cloudflare deployment

This project includes `wrangler.jsonc` so Wrangler serves the built Vite assets from `dist/` instead of guessing a framework. In **Workers > Settings > Build**, set **Build command** to `npm run build` and **Deploy command** to `npx wrangler deploy`. Set the root directory to this project folder (the folder containing `package.json` and `wrangler.jsonc`). The Worker name should be `ayah-scroll`, matching the config.

For Cloudflare Pages, connect it as a Pages project instead: use `npm run build` as the build command and `dist` as the build output directory. Pages projects do not use the Workers deploy command.

The data preparation script reads the same `quran-json` package used by the source repo and generates the local data file before development or production builds. The generated data file is intentionally not committed to this archive; `npm install` and the lifecycle scripts recreate it.

## Interactions

- Swipe or scroll through the chapters and verses; use the previous/next controls or keyboard arrow keys as alternatives.
- Tap a verse to open bookmark, recitation, copy, and tafsir actions.
- Open the top-left menu to search all 114 surahs or jump to a saved verse.
- Tap the title for the reading home, daily progress, reading plan, and translation language.
- Change light/dark appearance with the top-right control. Bookmarks, reading position, language, plan, theme, and progress are saved in local storage.

Recitation streams per-verse audio from everyayah.com and requires network access. Audio may be blocked in preview environments.

## Text and translation credits

This project follows the reference repo's data sources and does not provide its own interpretation. Arabic text, transliteration, and translations are supplied through `quran-json` (CC BY 4.0 package metadata). Check the original dataset and each translation's terms before redistribution or public hosting. The original README notes that Tanzil asks that its text not be modified. Tafsir links lead to Quran.com.

The interface code is MIT licensed; see `LICENSE`.
