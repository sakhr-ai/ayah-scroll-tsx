import type { Surah, SurahSummary } from './types';

let surahListRequest: Promise<SurahSummary[]> | null = null;
const surahRequests = new Map<number, Promise<Surah>>();

export function loadSurahList(): Promise<SurahSummary[]> {
  if (!surahListRequest) {
    surahListRequest = fetch('/data/surahs.json')
      .then(async (response) => {
        if (!response.ok) {
          throw new Error(`Could not load surah list: ${response.status}`);
        }

        return (await response.json()) as SurahSummary[];
      })
      .catch((error) => {
        surahListRequest = null;
        throw error;
      });
  }

  return surahListRequest;
}

export function loadSurah(id: number): Promise<Surah> {
  const cached = surahRequests.get(id);
  if (cached) return cached;

  const request = fetch(`/data/surahs/${id}.json`)
    .then(async (response) => {
      if (!response.ok) {
        throw new Error(`Could not load surah ${id}: ${response.status}`);
      }

      return (await response.json()) as Surah;
    })
    .catch((error) => {
      surahRequests.delete(id);
      throw error;
    });

  surahRequests.set(id, request);
  return request;
}
