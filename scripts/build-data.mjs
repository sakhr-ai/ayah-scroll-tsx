import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = path.join(root, 'node_modules/quran-json/dist');
const read = (name) => JSON.parse(fs.readFileSync(path.join(source, name), 'utf8'));
const english = read('quran_en.json');
const transliteration = read('quran_transliteration.json');
const languages = ['ur', 'tr', 'fr', 'id', 'es', 'bn'].map((code) => read(`quran_${code}.json`));
const result = english.map((surah, i) => ({
  id: surah.id,
  name: surah.name,
  transliteration: surah.transliteration,
  translation: surah.translation,
  type: surah.type,
  verses: surah.verses.map((verse, j) => ({
    arabic: verse.text,
    english: verse.translation,
    transliteration: transliteration[i].verses[j].transliteration,
    translations: Object.fromEntries(languages.map((data, k) => [['ur', 'tr', 'fr', 'id', 'es', 'bn'][k], data[i].verses[j].translation])),
  })),
}));
// Keep the current file temporarily so the app still builds during this step.
fs.mkdirSync(path.join(root, 'src'), { recursive: true });
fs.writeFileSync(
  path.join(root, 'src/quran-data.json'),
  JSON.stringify(result),
);

// Create one small surah list and one data file per surah.
const publicDataDir = path.join(root, 'public/data');
const surahDataDir = path.join(publicDataDir, 'surahs');

fs.mkdirSync(surahDataDir, { recursive: true });

const surahList = result.map(({ verses, ...surah }) => ({
  ...surah,
  verseCount: verses.length,
}));

fs.writeFileSync(
  path.join(publicDataDir, 'surahs.json'),
  JSON.stringify(surahList),
);

for (const surah of result) {
  fs.writeFileSync(
    path.join(surahDataDir, `${surah.id}.json`),
    JSON.stringify(surah),
  );
}

console.log(
  `Prepared ${result.length} surahs and ${result.reduce(
    (count, surah) => count + surah.verses.length,
    0,
  )} verses.`,
);
