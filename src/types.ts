export type Language = 'en' | 'ur' | 'tr' | 'fr' | 'id' | 'es' | 'bn';

export type Verse = {
  arabic: string;
  english: string;
  transliteration: string;
  translations: Record<Exclude<Language, 'en'>, string>;
};

export type Surah = {
  id: number;
  name: string;
  transliteration: string;
  translation: string;
  type: string;
  verses: Verse[];
};
export type SurahSummary = Omit<Surah, 'verses'> & {
  verseCount: number;
};
