# Ayah Scroll · React + TypeScript

A responsive rebuild of the Ayah Scroll repository as a Vite, React, TypeScript, and CSS app. The reading flow is one chapter or verse per screen, with explicit buttons and keyboard-accessible controls.

## Run it

```bash
npm install
npm run dev
```

Vite prints a local address (usually `http://localhost:5173`). For a production build, run `npm run build`; serve the generated `dist/` folder with any static host.

## Added features

- **Auto Scroll:** hands-free paging from the bottom bar, speed 6, 10, 15 or 25 seconds per page. It pauses while a panel is open or recitation plays, and keeps the screen awake where the browser allows.
- **Finished surahs:** tick surahs off in the menu; the count shows on the home screen.
- **Share:** native share sheet with a deep link (`/?v=2:255` opens at that verse); falls back to copying.
- **Verse of the Day:** the same verse for everyone on a given date, on the home screen.
- **Verse search:** search the whole Qur’an in Arabic (without vowel marks), transliteration or your chosen translation from the menu; type `2:255` to jump.
- **Study this verse:** commentary (Ibn Kathir, Ma’arif al-Qur’an), word by word, and a side-by-side comparison of all translations. Commentary and word data are fetched from the Quran.com API; the Qur’anic text itself is never changed. Tapping a word lists other verses with the same spelling, and verse references inside commentary are tappable.
- **Discover:** an endless shuffled feed of verses, each with the same study tools.
- **Offline:** installable PWA. Use “Save for offline reading” on the home screen to cache all 114 surahs.

Set `VITE_QURAN_API_BASE` to point the study tools at a different Quran.com API host or proxy.

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
