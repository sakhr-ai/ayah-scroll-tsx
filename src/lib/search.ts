import type { Language, Surah, SurahSummary } from '../types';
import { loadSurah } from '../quranData';
import { verseTextOf } from './verses';

type Entry = {
  key: string;
  surah: Surah;
  index: number;
  arabicNorm: string;
  english: string;
  transliteration: string;
};

const ARABIC_RE = /[؀-ۿ]/;
let indexRequest: Promise<Entry[]> | null = null;

/** Folds Arabic so a plain typed word matches the fully voweled Uthmani text. */
export function normalizeArabic(text: string) {
  return text
    .normalize('NFKD')
    .replace(/[ؐ-ًؚ-ٰٟۖ-ۭـ]/g, '')
    .replace(/[ٱ]/g, 'ا')
    .replace(/ى/g, 'ي')
    .replace(/ة/g, 'ه')
    .replace(/\s+/g, ' ')
    .trim();
}

export const isArabicQuery = (query: string) => ARABIC_RE.test(query);

async function buildIndex(list: SurahSummary[]): Promise<Entry[]> {
  const surahs: Surah[] = new Array(list.length);
  let next = 0;

  async function worker() {
    while (next < list.length) {
      const i = next++;
      surahs[i] = await loadSurah(list[i].id);
    }
  }

  await Promise.all(Array.from({ length: 6 }, worker));

  const entries: Entry[] = [];
  for (const surah of surahs) {
    surah.verses.forEach((verse, i) => {
      entries.push({
        key: `${surah.id}:${i + 1}`,
        surah,
        index: i,
        arabicNorm: normalizeArabic(verse.arabic),
        english: verse.english.toLowerCase(),
        transliteration: verse.transliteration.toLowerCase(),
      });
    });
  }
  return entries;
}

function getIndex(list: SurahSummary[]) {
  if (!indexRequest) {
    indexRequest = buildIndex(list).catch((error) => {
      indexRequest = null;
      throw error;
    });
  }
  return indexRequest;
}

export type VerseHit = { key: string; text: string; arabic: boolean };

export async function searchVerses(
  query: string,
  language: Language,
  list: SurahSummary[],
  limit = 50,
): Promise<VerseHit[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const entries = await getIndex(list);
  const hits: VerseHit[] = [];

  if (isArabicQuery(trimmed)) {
    const needle = normalizeArabic(trimmed);
    for (const entry of entries) {
      if (!entry.arabicNorm.includes(needle)) continue;
      hits.push({
        key: entry.key,
        text: entry.surah.verses[entry.index].arabic,
        arabic: true,
      });
      if (hits.length >= limit) break;
    }
    return hits;
  }

  const tokens = trimmed.toLowerCase().split(/\s+/).filter(Boolean);
  for (const entry of entries) {
    const verse = entry.surah.verses[entry.index];
    const translated = verseTextOf(verse, language).toLowerCase();
    const haystack = `${entry.english} ${entry.transliteration} ${translated}`;
    if (!tokens.every((token) => haystack.includes(token))) continue;
    hits.push({ key: entry.key, text: verseTextOf(verse, language), arabic: false });
    if (hits.length >= limit) break;
  }
  return hits;
}

/** Other verses that contain the exact same Arabic word (same spelling). */
export async function findWordVerses(
  arabicWord: string,
  list: SurahSummary[],
  excludeKey: string,
  limit = 30,
): Promise<string[]> {
  const needle = ` ${normalizeArabic(arabicWord)} `;
  if (needle.trim().length < 2) return [];

  const entries = await getIndex(list);
  const keys: string[] = [];
  for (const entry of entries) {
    if (entry.key === excludeKey) continue;
    if (` ${entry.arabicNorm} `.includes(needle)) keys.push(entry.key);
    if (keys.length >= limit) break;
  }
  return keys;
}
