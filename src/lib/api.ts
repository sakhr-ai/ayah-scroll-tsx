// Optional study data comes from the public Quran.com content API. Override the
// base URL with VITE_QURAN_API_BASE if you proxy it or use a different host.
const BASE: string =
  import.meta.env.VITE_QURAN_API_BASE ?? 'https://api.quran.com/api/v4';

export const TAFSIRS = [
  { id: 169, label: 'Ibn Kathir' },
  { id: 168, label: 'Ma’arif al-Qur’an' },
] as const;

export type WordInfo = {
  position: number;
  arabic: string;
  transliteration: string;
  translation: string;
};

export type TafsirBlock = { heading: boolean; text: string };

const cache = new Map<string, Promise<unknown>>();

function getJson<T>(url: string): Promise<T> {
  const hit = cache.get(url);
  if (hit) return hit as Promise<T>;

  const request = (async () => {
    const controller = new AbortController();
    const timer = window.setTimeout(() => controller.abort(), 12_000);
    try {
      const response = await fetch(url, {
        signal: controller.signal,
        headers: { Accept: 'application/json' },
      });
      if (!response.ok) throw new Error(`Request failed: ${response.status}`);
      return (await response.json()) as T;
    } finally {
      window.clearTimeout(timer);
    }
  })();

  request.catch(() => cache.delete(url));
  cache.set(url, request);
  return request;
}

/** Turns tafsir HTML into plain text blocks without ever injecting markup. */
function htmlToBlocks(html: string): TafsirBlock[] {
  const doc = new DOMParser().parseFromString(html, 'text/html');
  const selector = 'h1,h2,h3,h4,p,li,blockquote';
  const blocks: TafsirBlock[] = [];

  doc.body.querySelectorAll(selector).forEach((element) => {
    if (element.querySelector(selector)) return; // keep only the innermost block
    const text = (element.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) blocks.push({ heading: /^H[1-4]$/.test(element.tagName), text });
  });

  if (!blocks.length) {
    const text = (doc.body.textContent ?? '').replace(/\s+/g, ' ').trim();
    if (text) blocks.push({ heading: false, text });
  }
  return blocks;
}

export async function fetchTafsir(verseKey: string, tafsirId: number) {
  const data = await getJson<{
    tafsir?: { text?: string; resource_name?: string };
  }>(`${BASE}/tafsirs/${tafsirId}/by_ayah/${encodeURIComponent(verseKey)}`);

  return {
    name: data.tafsir?.resource_name ?? '',
    blocks: htmlToBlocks(data.tafsir?.text ?? ''),
  };
}

export async function fetchWords(verseKey: string): Promise<WordInfo[]> {
  const data = await getJson<{
    verse?: {
      words?: {
        position: number;
        char_type_name?: string;
        text_uthmani?: string;
        text?: string;
        translation?: { text?: string };
        transliteration?: { text?: string };
      }[];
    };
  }>(
    `${BASE}/verses/by_key/${encodeURIComponent(
      verseKey,
    )}?words=true&language=en&word_fields=text_uthmani`,
  );

  return (data.verse?.words ?? [])
    .filter((word) => (word.char_type_name ?? 'word') === 'word')
    .map((word) => ({
      position: word.position,
      arabic: word.text_uthmani ?? word.text ?? '',
      transliteration: word.transliteration?.text ?? '',
      translation: word.translation?.text ?? '',
    }));
}
