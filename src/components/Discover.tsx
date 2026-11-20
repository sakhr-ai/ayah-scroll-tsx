import { useEffect, useRef, useState } from 'react';
import type { Language, Surah, SurahSummary } from '../types';
import { loadSurah } from '../quranData';
import { isRtl } from '../lib/languages';
import { parseKey, randomKeys, verseTextOf } from '../lib/verses';
import VerseTools from './VerseTools';

type Props = {
  surahList: SurahSummary[];
  language: Language;
  saved: Set<string>;
  onToggleSave: (key: string) => void;
  onRead: (key: string) => void;
  onClose: () => void;
};

function DiscoverCard({
  verseKey,
  surahList,
  language,
  saved,
  onToggleSave,
  onRead,
}: Omit<Props, 'onClose'> & { verseKey: string }) {
  const [surah, setSurah] = useState<Surah | null>(null);
  const [failed, setFailed] = useState(false);
  const parts = parseKey(verseKey);

  useEffect(() => {
    let cancelled = false;
    if (!parts) return;
    loadSurah(parts[0])
      .then((data) => !cancelled && setSurah(data))
      .catch(() => !cancelled && setFailed(true));
    return () => {
      cancelled = true;
    };
  }, [verseKey]);

  const verse = surah && parts ? surah.verses[parts[1] - 1] : null;

  return (
    <section className="feed-page verse-page" aria-label={`Verse ${verseKey}`}>
      <div className="verse-content">
        <div className="verse-meta">
          <span>{surah?.transliteration ?? ''}</span>
          <span className="meta-dot">·</span>
          <span>{verseKey}</span>
        </div>

        {failed && <p role="alert">This verse could not be loaded.</p>}
        {!verse && !failed && <p role="status">Loading…</p>}

        {verse && (
          <>
            <div className="verse-text static">
              <span className="arabic" lang="ar" dir="rtl">{verse.arabic}</span>
              <span
                className={`translation ${isRtl(language) ? 'rtl-translation' : ''}`}
                lang={language}
                dir={isRtl(language) ? 'rtl' : 'ltr'}
              >
                {verseTextOf(verse, language)}
              </span>
            </div>

            <div className="action-row">
              <button
                type="button"
                className="action-button"
                aria-pressed={saved.has(verseKey)}
                onClick={() => onToggleSave(verseKey)}
              >
                {saved.has(verseKey) ? 'Saved' : 'Save verse'}
              </button>
              <button type="button" className="action-button" onClick={() => onRead(verseKey)}>
                Read in context
              </button>
            </div>

            <VerseTools
              verseKey={verseKey}
              verse={verse}
              language={language}
              surahList={surahList}
              onJump={onRead}
            />
          </>
        )}
      </div>
    </section>
  );
}

export default function Discover(props: Props) {
  const { surahList, onClose } = props;
  const seen = useRef(new Set<string>());
  const [keys, setKeys] = useState<string[]>(() => randomKeys(surahList, 10, seen.current));
  const sentinelRef = useRef<HTMLDivElement>(null);
  const scrollerRef = useRef<HTMLDivElement>(null);

  // Keep the feed endless: add more random verses when the end comes into view.
  useEffect(() => {
    const sentinel = sentinelRef.current;
    if (!sentinel) return;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((entry) => entry.isIntersecting)) {
          setKeys((old) => [...old, ...randomKeys(surahList, 8, seen.current)]);
        }
      },
      { root: scrollerRef.current, rootMargin: '600px 0px' },
    );
    observer.observe(sentinel);
    return () => observer.disconnect();
  }, [surahList]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') onClose();
    };
    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [onClose]);

  return (
    <div className="discover" role="region" aria-label="Discover random verses">
      <div className="discover-feed" ref={scrollerRef}>
        {keys.map((key) => (
          <DiscoverCard key={key} verseKey={key} {...props} />
        ))}
        <div ref={sentinelRef} aria-hidden="true" style={{ height: 1 }} />
      </div>
      <button type="button" className="discover-back" onClick={onClose}>
        Back to reading
      </button>
    </div>
  );
}
