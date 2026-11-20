import type { Language, Surah, SurahSummary, Verse } from '../types';

export function verseTextOf(verse: Verse, language: Language) {
  return language === 'en' ? verse.english : verse.translations[language];
}

export function verseText(surah: Surah, verseNo: number, language: Language) {
  return verseTextOf(surah.verses[verseNo - 1], language);
}

export function totalVerses(list: SurahSummary[]) {
  return list.reduce((sum, surah) => sum + surah.verseCount, 0);
}

/** Parses "2:255" into [2, 255]; returns null for anything else. */
export function parseKey(key: string): [number, number] | null {
  const match = /^(\d{1,3}):(\d{1,3})$/.exec(key.trim());
  if (!match) return null;
  return [Number(match[1]), Number(match[2])];
}

export function isValidKey(list: SurahSummary[], key: string) {
  const parts = parseKey(key);
  if (!parts) return false;
  const surah = list.find((item) => item.id === parts[0]);
  return Boolean(surah && parts[1] >= 1 && parts[1] <= surah.verseCount);
}

/** Maps a 0-based index across all 6,236 verses to a "surah:verse" key. */
export function keyFromVerseIndex(list: SurahSummary[], index: number) {
  let remaining = index;
  for (const surah of list) {
    if (remaining < surah.verseCount) return `${surah.id}:${remaining + 1}`;
    remaining -= surah.verseCount;
  }
  return '1:1';
}

/** Same verse for everyone on a given calendar day (Verse of the Day). */
export function verseOfTheDayKey(list: SurahSummary[], isoDate: string) {
  const total = totalVerses(list);
  if (!total) return '1:1';
  let hash = 2166136261;
  for (let i = 0; i < isoDate.length; i++) {
    hash ^= isoDate.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return keyFromVerseIndex(list, (hash >>> 0) % total);
}

export function randomKeys(
  list: SurahSummary[],
  count: number,
  exclude: Set<string>,
) {
  const total = totalVerses(list);
  const keys: string[] = [];
  let guard = 0;
  while (keys.length < count && total > 0 && guard++ < count * 20) {
    const key = keyFromVerseIndex(list, Math.floor(Math.random() * total));
    if (exclude.has(key)) continue;
    exclude.add(key);
    keys.push(key);
  }
  return keys;
}
