import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import type { Language, Surah, SurahSummary } from './types';
import { loadSurah, loadSurahList } from './quranData';
import Discover from './components/Discover';
import VerseTools from './components/VerseTools';
import { LANGUAGES, isRtl } from './lib/languages';
import { read, today, write } from './lib/storage';
import { searchVerses, type VerseHit } from './lib/search';
import { isValidKey, parseKey, verseOfTheDayKey, verseText } from './lib/verses';

const TOTAL_VERSES = 6236;
const AUDIO_BASE = 'https://everyayah.com/data/Alafasy_128kbps/';
const PLANS = [
  { days: 30, label: '30 days' },
  { days: 90, label: '3 months' },
  { days: 365, label: '1 year' },
];


// React 18 has no typed `inert` prop; spread it only when needed.
const inertWhen = (on: boolean) => (on ? ({ inert: '' } as Record<string, string>) : {});

function prefersReducedMotion() {
  return window.matchMedia?.('(prefers-reduced-motion: reduce)').matches ?? false;
}

const AUTO_SPEEDS = [6, 10, 15, 25];

// A shared link such as /?v=2:255 opens straight at that verse.
const DEEP_LINK = (() => {
  try {
    const value = new URLSearchParams(window.location.search).get('v');
    return value && parseKey(value) ? value : null;
  } catch {
    return null;
  }
})();

function Icon({
  name,
}: {
  name:
    | 'menu' | 'moon' | 'close' | 'back' | 'next' | 'play' | 'pause' | 'bookmark' | 'copy'
    | 'scroll' | 'check' | 'share' | 'shuffle' | 'download';
}) {
  const paths: Record<typeof name, React.ReactNode> = {
    menu: <path d="M4 7h16M4 12h16M4 17h16" />,
    moon: <path d="M20.8 13A8.5 8.5 0 0 1 11 3.2 8.5 8.5 0 1 0 20.8 13Z" />,
    close: <path d="m6 6 12 12M18 6 6 18" />,
    back: <path d="m15 18-6-6 6-6" />,
    next: <path d="m9 18 6-6-6-6" />,
    play: <path d="m8 5 12 7-12 7z" />,
    pause: <path d="M8 5h3v14H8zM15 5h3v14h-3z" />,
    bookmark: <path d="M6 4.8A1.8 1.8 0 0 1 7.8 3h8.4A1.8 1.8 0 0 1 18 4.8V21l-6-4-6 4z" />,
    scroll: <path d="M12 4v13m0 0-5-5m5 5 5-5M5 21h14" />,
    check: <path d="m5 12 5 5L20 7" />,
    share: <path d="M12 3v12M8 7l4-4 4 4M5 12v7a2 2 0 0 0 2 2h10a2 2 0 0 0 2-2v-7" />,
    shuffle: <path d="M16 3h5v5M4 20 21 3M21 16v5h-5M15 15l6 6M4 4l5 5" />,
    download: <path d="M12 3v12m0 0-4-4m4 4 4-4M5 21h14" />,
    copy: (
      <>
        <rect x="8" y="8" width="12" height="13" rx="2" />
        <path d="M16 8V5a2 2 0 0 0-2-2H6a2 2 0 0 0-2 2v11a2 2 0 0 0 2 2h2" />
      </>
    ),
  };

  return (
    <svg
      aria-hidden="true"
      viewBox="0 0 24 24"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.8"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      {paths[name]}
    </svg>
  );
}

export default function App() {
  const [position, setPosition] = useState(() => DEEP_LINK ?? read('pos', '1:0'));
  const [surahList, setSurahList] = useState<SurahSummary[]>([]);
  const [activeSurah, setActiveSurah] = useState<Surah | null>(null);
  const [loading, setLoading] = useState(true);
  const [loadError, setLoadError] = useState('');
  const [pendingKey, setPendingKey] = useState<string | null>(null);

  const [selected, setSelected] = useState<string | null>(null);
  const [saved, setSaved] = useState<string[]>(() => read('saved', []));
  const [theme, setTheme] = useState<'light' | 'dark'>(() => read('theme', 'light'));
  const [language, setLanguage] = useState<Language>(() => read('lang', 'en'));
  const [plan, setPlan] = useState(() => read('plan', 365));
  const [log, setLog] = useState<Record<string, number>>(() => read('log', {}));
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [homeOpen, setHomeOpen] = useState(!DEEP_LINK);
  const [discoverOpen, setDiscoverOpen] = useState(false);
  const [done, setDone] = useState<number[]>(() => read('done', []));
  const [autoScroll, setAutoScroll] = useState(false);
  const [autoSeconds, setAutoSeconds] = useState<number>(() => read('autoSecs', 10));
  const [verseHits, setVerseHits] = useState<VerseHit[]>([]);
  const [searching, setSearching] = useState(false);
  const [offline, setOffline] = useState<{ done: number; total: number } | null>(null);
  const [votd, setVotd] = useState<{ key: string; surah: Surah } | null>(null);
  const [query, setQuery] = useState('');
  const [toast, setToast] = useState('');
  const [playing, setPlaying] = useState(false);
  const [recitationChoiceOpen, setRecitationChoiceOpen] = useState(false);
  const [playbackMode, setPlaybackMode] = useState<'verse' | 'surah' | null>(null);

  const feedRef = useRef<HTMLElement>(null);
  const sheetRef = useRef<HTMLElement>(null);
  const drawerRef = useRef<HTMLElement>(null);
  const returnFocusRef = useRef<HTMLElement | null>(null);
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const loadRequestRef = useRef(0);
  const savedSet = useMemo(() => new Set(saved), [saved]);
  const doneSet = useMemo(() => new Set(done), [done]);

  const [currentSurahId, currentVerseNo] = position.split(':').map(Number);
  const currentSummary = surahList.find((surah) => surah.id === currentSurahId);
  const selectedParts = selected?.split(':').map(Number);
  const selectedSurah =
    activeSurah?.id === selectedParts?.[0] ? activeSurah : null;
  const selectedVerseNo = selectedParts?.[1] ?? 0;
  const todayCount = log[today()] ?? 0;
  const dailyGoal = Math.ceil(TOTAL_VERSES / plan);

  const currentIndex = useMemo(() => {
    const versesBefore = surahList
      .filter((surah) => surah.id < currentSurahId)
      .reduce((sum, surah) => sum + surah.verseCount + 1, 0);

    return versesBefore + currentVerseNo;
  }, [surahList, currentSurahId, currentVerseNo]);

  useEffect(() => {
    let cancelled = false;

    async function initialize() {
      try {
        const list = await loadSurahList();
        if (cancelled) return;
        setSurahList(list);

        const [savedSurahId] = position.split(':').map(Number);
        const firstSurah = await loadSurah(savedSurahId || 1);
        if (cancelled) return;

        setActiveSurah(firstSurah);
        setPendingKey(position);
        setLoadError('');
      } catch {
        if (!cancelled) setLoadError('Could not load Quran data. Please refresh.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    void initialize();
    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    document.documentElement.dataset.theme = theme;
    document
      .querySelector('meta[name="theme-color"]')
      ?.setAttribute('content', theme === 'dark' ? '#0a0e24' : '#f3eee3');
    write('theme', theme);
  }, [theme]);

  useEffect(() => write('saved', saved), [saved]);
  useEffect(() => write('lang', language), [language]);
  useEffect(() => write('plan', plan), [plan]);
  useEffect(() => write('done', done), [done]);
  useEffect(() => write('autoSecs', autoSeconds), [autoSeconds]);
  useEffect(() => write('log', log), [log]);

  const goTo = useCallback(
    async (key: string) => {
      const [surahId] = key.split(':').map(Number);
      setPosition(key);
      write('pos', key);
      setPendingKey(key);
      setSelected(null);
      setDiscoverOpen(false);

      if (activeSurah?.id === surahId) return;

      const requestId = ++loadRequestRef.current;
      setActiveSurah(null);
      setLoading(true);
      setLoadError('');

      try {
        const surah = await loadSurah(surahId);
        if (requestId !== loadRequestRef.current) return;
        setActiveSurah(surah);
      } catch {
        if (requestId === loadRequestRef.current) {
          setLoadError(`Could not load surah ${surahId}. Please try again.`);
        }
      } finally {
        if (requestId === loadRequestRef.current) setLoading(false);
      }
    },
    [activeSurah],
  );

  useEffect(() => {
    if (!activeSurah || !pendingKey) return;

    const [surahId] = pendingKey.split(':').map(Number);
    if (surahId !== activeSurah.id) return;

    requestAnimationFrame(() => {
      const target = feedRef.current?.querySelector<HTMLElement>(
        `[data-key="${pendingKey}"]`,
      );
      target?.scrollIntoView({
        behavior: prefersReducedMotion() ? 'auto' : 'smooth',
        block: 'start',
      });
      setPendingKey(null);
    });
  }, [activeSurah, pendingKey]);

  useEffect(() => {
    const feed = feedRef.current;
    if (!feed || !activeSurah) return;

    const observer = new IntersectionObserver(
      (entries) =>
        entries.forEach((entry) => {
          if (!entry.isIntersecting) return;

          const element = entry.target as HTMLElement;
          const key = element.dataset.key;
          if (!key) return;

          setPosition(key);
          write('pos', key);

          const [surahId, verseNo] = key.split(':').map(Number);
          if (verseNo > 0) {
            setLog((old) => {
              const seen = read<string[]>('seen', []);
              const index = element.dataset.index ?? '';
              if (seen.includes(index)) return old;

              write('seen', [...seen, index]);
              return { ...old, [today()]: (old[today()] ?? 0) + 1 };
            });
          }

          const summary = surahList.find((item) => item.id === surahId);
          if (summary) document.title = `${summary.transliteration} · Ayah Scroll`;
        }),
      { root: feed, threshold: 0.65 },
    );

    feed.querySelectorAll('[data-key]').forEach((element) => {
      observer.observe(element);
    });

    return () => observer.disconnect();
  }, [activeSurah, surahList]);

  useEffect(() => {
    const onKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        setDrawerOpen(false);
        setSelected(null);
        setRecitationChoiceOpen(false);
      }

      if (event.key === 'ArrowDown' && !selected && !drawerOpen && !homeOpen) {
        goToIndex(currentIndex + 1);
      }

      if (event.key === 'ArrowUp' && !selected && !drawerOpen && !homeOpen) {
        goToIndex(currentIndex - 1);
      }
    };

    window.addEventListener('keydown', onKey);
    return () => window.removeEventListener('keydown', onKey);
  }, [selected, drawerOpen, homeOpen, currentIndex]);

  const panelOpen = drawerOpen || Boolean(selected);

  // Verse of the Day: the same verse for everyone on a given date.
  useEffect(() => {
    if (!surahList.length) return;
    const key = verseOfTheDayKey(surahList, today());
    const [surahId] = key.split(':').map(Number);
    let cancelled = false;
    loadSurah(surahId)
      .then((surah) => !cancelled && setVotd({ key, surah }))
      .catch(() => undefined);
    return () => {
      cancelled = true;
    };
  }, [surahList]);

  // Search every verse (Arabic, transliteration and the chosen translation).
  useEffect(() => {
    const term = query.trim();
    if (term.length < 2 || !drawerOpen) {
      setVerseHits([]);
      setSearching(false);
      return;
    }
    let cancelled = false;
    setSearching(true);
    const timer = window.setTimeout(() => {
      searchVerses(term, language, surahList)
        .then((hits) => {
          if (cancelled) return;
          setVerseHits(hits);
          setSearching(false);
        })
        .catch(() => {
          if (cancelled) return;
          setVerseHits([]);
          setSearching(false);
        });
    }, 250);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [query, language, surahList, drawerOpen]);

  // Move focus into a panel when it opens and give it back to the opener on close.
  useEffect(() => {
    if (!panelOpen) return;

    returnFocusRef.current = document.activeElement as HTMLElement | null;
    const panel = drawerOpen ? drawerRef.current : sheetRef.current;
    const frame = requestAnimationFrame(() => {
      (
        panel?.querySelector<HTMLElement>('input') ??
        panel?.querySelector<HTMLElement>('.action-button, button')
      )?.focus({ preventScroll: true });
    });

    return () => {
      cancelAnimationFrame(frame);
      returnFocusRef.current?.focus?.({ preventScroll: true });
    };
  }, [panelOpen, drawerOpen]);

  // Auto Scroll: advance one page every few seconds. The timer restarts whenever
  // the position changes, so manual swipes always get a full interval.
  const stepRef = useRef<() => void>(() => undefined);
  stepRef.current = () => {
    if (currentIndex + 1 >= TOTAL_VERSES + surahList.length) {
      setAutoScroll(false);
      return;
    }
    goToIndex(currentIndex + 1);
  };

  const autoActive =
    autoScroll && !panelOpen && !homeOpen && !discoverOpen && !playing && !loading;

  useEffect(() => {
    if (!autoActive) return;
    const id = window.setInterval(() => stepRef.current(), autoSeconds * 1000);
    return () => window.clearInterval(id);
  }, [autoActive, autoSeconds, position]);

  // Keep the screen awake while auto scrolling (where the browser allows it).
  useEffect(() => {
    if (!autoActive || !('wakeLock' in navigator)) return;
    let lock: WakeLockSentinel | null = null;
    let cancelled = false;
    navigator.wakeLock
      .request('screen')
      .then((sentinel) => {
        if (cancelled) void sentinel.release();
        else lock = sentinel;
      })
      .catch(() => undefined);
    return () => {
      cancelled = true;
      void lock?.release();
    };
  }, [autoActive]);

  useEffect(() => () => audioRef.current?.pause(), []);

  function goToIndex(index: number) {
    let offset = 0;

    for (const surah of surahList) {
      const pageCount = surah.verseCount + 1;

      if (index < offset + pageCount) {
        const pageInSurah = index - offset;
        void goTo(`${surah.id}:${pageInSurah}`);
        return;
      }

      offset += pageCount;
    }
  }

  function closePanels() {
    setDrawerOpen(false);
    setSelected(null);
    setRecitationChoiceOpen(false);
  }

  function toggleSaved(key: string) {
    setSaved((items) =>
      items.includes(key)
        ? items.filter((item) => item !== key)
        : [...items, key],
    );
    setSelected(null);
  }

  async function copyVerse() {
    if (!selectedSurah || !selectedVerseNo || !selected) return;

    const verse = selectedSurah.verses[selectedVerseNo - 1];
    const text = `${verse.arabic}\n\n${verseText(
      selectedSurah,
      selectedVerseNo,
      language,
    )}\n— Qur’an ${selected}`;

    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement('textarea');
      textarea.value = text;
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand('copy');
      textarea.remove();
    }

    setToast('Verse copied');
    window.setTimeout(() => setToast(''), 1800);
  }

  function playVerseAudio(
    surahNo: number,
    verseNo: number,
    mode: 'verse' | 'surah',
  ) {
    const summary = surahList.find((item) => item.id === surahNo);
    if (!summary || verseNo < 1 || verseNo > summary.verseCount) {
      setPlaying(false);
      setPlaybackMode(null);
      return;
    }

    const audio = new Audio(
      `${AUDIO_BASE}${String(surahNo).padStart(3, '0')}${String(
        verseNo,
      ).padStart(3, '0')}.mp3`,
    );

    audioRef.current = audio;
    setPlaybackMode(mode);
    setPlaying(true);
    void goTo(`${surahNo}:${verseNo}`);

    audio.onended = () => {
  if (mode === 'surah' && verseNo < summary.verseCount) {
    playVerseAudio(surahNo, verseNo + 1, 'surah');
    return;
  }

  setPlaying(false);
  setPlaybackMode(null);

  if (mode === 'surah') {
    setToast('Surah recitation complete');
    window.setTimeout(() => setToast(''), 2200);
  }
};

    audio.onerror = () => {
      setPlaying(false);
      setPlaybackMode(null);
      setToast('Audio could not be loaded');
      window.setTimeout(() => setToast(''), 2200);
    };

    audio.play().catch(() => {
      setPlaying(false);
      setPlaybackMode(null);
      setToast('Audio is unavailable in this preview');
      window.setTimeout(() => setToast(''), 2200);
    });
  }

  function showToast(message: string, ms = 1800) {
    setToast(message);
    window.setTimeout(() => setToast(''), ms);
  }

  function toggleDone(surahId: number) {
    setDone((items) =>
      items.includes(surahId)
        ? items.filter((id) => id !== surahId)
        : [...items, surahId],
    );
  }

  async function shareVerse() {
    if (!selectedSurah || !selectedVerseNo || !selected) return;

    const verse = selectedSurah.verses[selectedVerseNo - 1];
    const url = `${window.location.origin}/?v=${selected}`;
    const text = `${verse.arabic}\n\n${verseText(
      selectedSurah,
      selectedVerseNo,
      language,
    )}\n— Qur’an ${selected}`;

    if (typeof navigator.share === 'function') {
      try {
        await navigator.share({ title: `Qur’an ${selected}`, text, url });
      } catch {
        // The person closed the share sheet; nothing to do.
      }
      return;
    }

    try {
      await navigator.clipboard.writeText(`${text}\n${url}`);
      showToast('Verse and link copied');
    } catch {
      void copyVerse();
    }
  }

  async function saveOffline() {
    if (offline || !surahList.length) return;
    const ids = surahList.map((surah) => surah.id);
    let finished = 0;
    let failed = 0;
    setOffline({ done: 0, total: ids.length });

    let next = 0;
    async function worker() {
      while (next < ids.length) {
        const id = ids[next++];
        try {
          const response = await fetch(`/data/surahs/${id}.json`);
          if (!response.ok) failed++;
        } catch {
          failed++;
        }
        finished++;
        setOffline({ done: finished, total: ids.length });
      }
    }

    await Promise.all(Array.from({ length: 4 }, worker));
    setOffline(null);
    showToast(
      failed
        ? `Saved with ${failed} errors. Try again online.`
        : 'All 114 surahs saved for offline reading',
      2600,
    );
  }

  function startRecitation(mode: 'verse' | 'surah') {
    if (!selectedParts) return;

    const [surahNo, verseNo] = selectedParts;
    const startVerse = mode === 'surah' ? 1 : verseNo;

    audioRef.current?.pause();
    setRecitationChoiceOpen(false);
    setSelected(null);
    playVerseAudio(surahNo, startVerse, mode);
  }

  function stopRecitation() {
    audioRef.current?.pause();
    setPlaying(false);
    setPlaybackMode(null);
    setRecitationChoiceOpen(false);
  }

  const visibleSurahs = surahList.filter(
    (surah) =>
      !query ||
      `${surah.id} ${surah.transliteration} ${surah.name} ${surah.translation}`
        .toLowerCase()
        .includes(query.toLowerCase()),
  );

  const streak = useMemo(() => {
    let count = 0;
    const date = new Date();

    if (!log[today()]) date.setDate(date.getDate() - 1);

    for (let i = 0; i < 4000; i++) {
      const key = new Date(
        date.getTime() - date.getTimezoneOffset() * 60_000,
      )
        .toISOString()
        .slice(0, 10);

      if ((log[key] ?? 0) < dailyGoal) break;

      count++;
      date.setDate(date.getDate() - 1);
    }

    return count;
  }, [log, dailyGoal]);

  const currentBaseIndex = currentIndex - currentVerseNo;

  return (
    <div className="app-shell">
      <header className="topbar" {...inertWhen(panelOpen)}>
        <button
          className="icon-button"
          aria-label="Open surah and bookmarks menu"
          onClick={() => {
            setQuery('');
            setDrawerOpen(true);
          }}
        >
          <Icon name="menu" />
        </button>

        <button
          className="top-title"
          onClick={() => {
            setDiscoverOpen(false);
            setHomeOpen(true);
          }}
          aria-label="Open reading home"
        >
          <span>{currentSummary?.transliteration ?? 'Ayah Scroll'}</span>
          <small>
            {currentVerseNo
              ? `Verse ${currentVerseNo} of ${currentSummary?.verseCount ?? '…'}`
              : currentSummary?.translation ?? ''}
          </small>
        </button>

        <button
          className="icon-button"
          aria-label="Dark mode"
          aria-pressed={theme === 'dark'}
          onClick={() =>
            setTheme((value) => (value === 'dark' ? 'light' : 'dark'))
          }
        >
          <Icon name="moon" />
        </button>

        <div
          className="progress-line"
          aria-hidden="true"
          style={{
            width: `${Math.min(
              100,
              (currentIndex / (TOTAL_VERSES + surahList.length)) * 100,
            )}%`,
          }}
        />
      </header>

      <main
        className="feed"
        ref={feedRef}
        aria-label="Qur’an verses"
        {...inertWhen(panelOpen || homeOpen || discoverOpen)}
      >
        {activeSurah && (
          <>
            <section
              className="feed-page chapter-page"
              data-key={`${activeSurah.id}:0`}
              data-index={currentBaseIndex}
            >
              <div className="chapter-content">
                <span className="eyebrow">
                  {activeSurah.type === 'meccan' ? 'Meccan' : 'Medinan'} ·{' '}
                  {activeSurah.verses.length} verses
                </span>
                <div className="ornament" aria-hidden="true">۞</div>
                <h1 className="chapter-ar" lang="ar" dir="rtl">
                  {activeSurah.name}
                </h1>
                <h2>{activeSurah.transliteration}</h2>
                <p className="chapter-translation">{activeSurah.translation}</p>

                {activeSurah.id !== 1 && activeSurah.id !== 9 && (
                  <p className="bismillah" lang="ar" dir="rtl">
                    بِسۡمِ ٱللَّهِ ٱلرَّحۡمَٰنِ ٱلرَّحِيمِ
                  </p>
                )}

                <button
                  className="chapter-start"
                  onClick={() => void goTo(`${activeSurah.id}:1`)}
                >
                  Begin this surah <Icon name="next" />
                </button>
              </div>
            </section>

            {activeSurah.verses.map((verse, index) => {
              const verseNo = index + 1;
              const key = `${activeSurah.id}:${verseNo}`;

              return (
                <section
                  className="feed-page verse-page"
                  data-key={key}
                  data-index={currentBaseIndex + verseNo}
                  key={key}
                >
                  <div className="verse-content">
                    <div className="verse-meta">
                      <span>{activeSurah.transliteration}</span>
                      <span className="meta-dot">·</span>
                      <span>{key}</span>
                      {savedSet.has(key) && <Icon name="bookmark" />}
                    </div>

                    <button
                      className="verse-text"
                      onClick={() => setSelected(key)}
                      aria-label={`Open actions for ${activeSurah.transliteration}, verse ${verseNo}`}
                    >
                      <span className="arabic" lang="ar" dir="rtl">
                        {verse.arabic}
                      </span>
                      <span
                        className={`translation ${
                          isRtl(language) ? 'rtl-translation' : ''
                        }`}
                        lang={language}
                        dir={isRtl(language) ? 'rtl' : 'ltr'}
                      >
                        {verseText(activeSurah, verseNo, language)}
                      </span>
                      <span className="tap-hint">Tap verse for options</span>
                    </button>
                  </div>
                </section>
              );
            })}
          </>
        )}

        {loading && (
          <p className="chapter-content" role="status">
            Loading surah…
          </p>
        )}
        {!loading && loadError && (
          <p className="chapter-content" role="alert">
            {loadError}
          </p>
        )}
      </main>

      <nav
        className="feed-controls"
        aria-label="Verse navigation"
        {...inertWhen(panelOpen || homeOpen || discoverOpen)}
      >
        <button
          className="round-control"
          aria-label="Previous verse"
          onClick={() => goToIndex(currentIndex - 1)}
          disabled={!surahList.length || currentIndex <= 0}
        >
          <Icon name="back" />
        </button>
        <span>
          {currentIndex + 1} / {TOTAL_VERSES + surahList.length}
        </span>
        <button
          className="round-control"
          aria-label="Next verse"
          onClick={() => goToIndex(currentIndex + 1)}
          disabled={!surahList.length}
        >
          <Icon name="next" />
        </button>
        <span className="control-divider" aria-hidden="true" />
        <button
          className={`round-control ${autoScroll ? 'on' : ''}`}
          aria-label={autoScroll ? 'Pause auto scroll' : 'Start auto scroll'}
          aria-pressed={autoScroll}
          onClick={() => setAutoScroll((value) => !value)}
          disabled={!surahList.length}
        >
          <Icon name={autoScroll ? 'pause' : 'scroll'} />
        </button>
        <button
          className="speed-control"
          aria-label={`Auto scroll speed: one page every ${autoSeconds} seconds. Change speed`}
          onClick={() =>
            setAutoSeconds(
              (value) =>
                AUTO_SPEEDS[(AUTO_SPEEDS.indexOf(value) + 1) % AUTO_SPEEDS.length] ??
                AUTO_SPEEDS[0],
            )
          }
        >
          {autoSeconds}s
        </button>
      </nav>

      {(drawerOpen || selected) && (
        <button
          className="scrim"
          aria-label="Close panel"
          onClick={closePanels}
        />
      )}

      <aside
        className={`drawer ${drawerOpen ? 'open' : ''}`}
        ref={drawerRef}
        role="dialog"
        aria-modal="true"
        aria-label="Surahs and saved verses"
        {...inertWhen(!drawerOpen)}
      >
        <div className="drawer-heading">
          <div>
            <span className="eyebrow">AYAH SCROLL</span>
            <h2>Find your place</h2>
          </div>
          <button
            className="icon-button"
            aria-label="Close menu"
            onClick={() => setDrawerOpen(false)}
          >
            <Icon name="close" />
          </button>
        </div>

        <label className="search-box">
          <span className="sr-only">Search surahs</span>
          <input
            type="search"
            enterKeyHint="search"
            autoComplete="off"
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search surah name or number"
          />
        </label>

        <div className="surah-list">
          {!query && saved.length > 0 && (
            <>
              <p className="list-label">BOOKMARKS</p>
              {saved.map((key) => {
                const [id] = key.split(':').map(Number);
                const summary = surahList.find((surah) => surah.id === id);

                return (
                  <button
                    className="surah-row saved-row"
                    key={key}
                    onClick={() => {
                      void goTo(key);
                      setDrawerOpen(false);
                    }}
                  >
                    <span className="surah-number">{key}</span>
                    <span>{summary?.transliteration}</span>
                    <span className="surah-ar" lang="ar" dir="rtl">
                      {summary?.name}
                    </span>
                  </button>
                );
              })}
            </>
          )}

          {query.trim().length >= 2 && (
            <>
              {parseKey(query) && isValidKey(surahList, query.trim()) && (
                <button
                  className="surah-row"
                  onClick={() => {
                    void goTo(query.trim());
                    setDrawerOpen(false);
                  }}
                >
                  <span className="surah-number">→</span>
                  <span>Go to verse {query.trim()}</span>
                </button>
              )}
              <p className="list-label" role="status">
                {searching
                  ? 'SEARCHING ALL VERSES…'
                  : `VERSE RESULTS · ${verseHits.length}${verseHits.length >= 50 ? '+' : ''}`}
              </p>
              {verseHits.map((hit) => (
                <button
                  className="surah-row hit-row"
                  key={hit.key}
                  onClick={() => {
                    void goTo(hit.key);
                    setDrawerOpen(false);
                  }}
                >
                  <span className="surah-number">{hit.key}</span>
                  <span
                    className="hit-text"
                    lang={hit.arabic ? 'ar' : language}
                    dir={hit.arabic || isRtl(language) ? 'rtl' : 'ltr'}
                  >
                    {hit.text}
                  </span>
                </button>
              ))}
            </>
          )}

          <p className="list-label">
            ALL SURAHS · 114 · {done.length} FINISHED
          </p>
          {query && visibleSurahs.length === 0 && verseHits.length === 0 && !searching && (
            <p className="list-label" role="status">
              No surah matches “{query}”.
            </p>
          )}
          {visibleSurahs.map((surah) => (
            <div className="surah-row-wrap" key={surah.id}>
              <button
                className="surah-row"
                aria-current={surah.id === currentSurahId ? 'true' : undefined}
                onClick={() => {
                  void goTo(`${surah.id}:0`);
                  setDrawerOpen(false);
                }}
              >
                <span className="surah-number">{surah.id}</span>
                <span>
                  {surah.transliteration}
                  <small>{surah.translation}</small>
                </span>
                <span className="surah-ar" lang="ar" dir="rtl">
                  {surah.name}
                </span>
              </button>
              <button
                className="done-toggle"
                aria-pressed={doneSet.has(surah.id)}
                aria-label={`${surah.transliteration}: mark as finished`}
                onClick={() => toggleDone(surah.id)}
              >
                <Icon name="check" />
              </button>
            </div>
          ))}
        </div>
      </aside>

      <section
        className={`detail-sheet ${selected ? 'open' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label="Verse actions"
        ref={sheetRef}
        {...inertWhen(!selected)}
      >
        {selectedSurah && selectedVerseNo > 0 && selected && (
          <div className="detail-inner">
            <div className="sheet-grabber" aria-hidden="true" />
            <div className="eyebrow">
              {selectedSurah.transliteration} · {selected}
            </div>
            <p className="detail-arabic" lang="ar" dir="rtl">
              {selectedSurah.verses[selectedVerseNo - 1].arabic}
            </p>
            <p className="detail-transliteration">
              {selectedSurah.verses[selectedVerseNo - 1].transliteration}
            </p>
            <p className="detail-translation">
              {verseText(selectedSurah, selectedVerseNo, language)}
            </p>

            <div className="action-row">
              <button
                className="action-button primary-action"
                onClick={() => toggleSaved(selected)}
              >
                <Icon name="bookmark" />
                {savedSet.has(selected) ? 'Remove bookmark' : 'Save verse'}
              </button>

              <button
                className="action-button"
                aria-expanded={recitationChoiceOpen && !playing}
                onClick={() => {
                  if (playing) {
                    stopRecitation();
                  } else {
                    setRecitationChoiceOpen((open) => !open);
                  }
                }}
              >
                <Icon name={playing ? 'pause' : 'play'} />
                {playing ? 'Stop recitation' : 'Recite'}
              </button>

              <button className="action-button" onClick={copyVerse}>
                <Icon name="copy" />
                Copy
              </button>

              <button className="action-button" onClick={() => void shareVerse()}>
                <Icon name="share" />
                Share
              </button>
            </div>

            {recitationChoiceOpen && !playing && (
              <div className="action-row">
                <button
                  className="action-button"
                  onClick={() => startRecitation('verse')}
                >
                  This verse only
                </button>
                <button
                  className="action-button"
                  onClick={() => startRecitation('surah')}
                >
                  Whole surah
                </button>
              </div>
            )}

            <VerseTools
              key={selected}
              verseKey={selected}
              verse={selectedSurah.verses[selectedVerseNo - 1]}
              language={language}
              surahList={surahList}
              onJump={(key) => void goTo(key)}
            />

            <a
              className="tafsir-link"
              href={`https://quran.com/${selected}/tafsirs`}
              target="_blank"
              rel="noreferrer"
            >
              Open tafsir on Quran.com <span aria-hidden="true">↗</span>
              <span className="sr-only">(opens in a new tab)</span>
            </a>
            <p className="source-note">
              For explanation and scholarly commentary, open the tafsir link.
            </p>
          </div>
        )}
      </section>

      {homeOpen && (
        <div
          className="home-overlay"
          role="region"
          aria-label="Reading home"
        >
          <div className="home-card">
            <h1>Ayah Scroll</h1>
            <p className="home-subtitle">The Qur’an, one verse at a time</p>

            <button
              className="continue-button"
              disabled={loading}
              onClick={() => {
                setHomeOpen(false);
                void goTo(position);
              }}
            >
              <span>CONTINUE READING</span>
              <strong>
                {currentSummary?.transliteration ?? 'Loading…'}
                {currentVerseNo ? ` · ${currentSurahId}:${currentVerseNo}` : ''}
              </strong>
              <span className="continue-arrow">
                <Icon name="next" />
              </span>
            </button>

            {votd && (
              <div className="votd-card">
                <span className="eyebrow">VERSE OF THE DAY · {votd.key}</span>
                <p className="votd-ar" lang="ar" dir="rtl">
                  {votd.surah.verses[Number(votd.key.split(':')[1]) - 1].arabic}
                </p>
                <p
                  className="votd-tr"
                  lang={language}
                  dir={isRtl(language) ? 'rtl' : 'ltr'}
                >
                  {verseText(votd.surah, Number(votd.key.split(':')[1]), language)}
                </p>
                <button
                  className="action-button"
                  onClick={() => {
                    setHomeOpen(false);
                    void goTo(votd.key);
                  }}
                >
                  Read in context
                </button>
              </div>
            )}

            <div className="daily-card">
              <div className="daily-copy">
                <span>DAILY READING</span>
                <b>
                  {todayCount} <small>/ {dailyGoal} verses</small>
                </b>
              </div>
              <span className="streak">
                <span aria-hidden="true">✦ </span>
                {streak}-day streak
              </span>
              <div className="goal-track">
                <i
                  style={{
                    width: `${Math.min(
                      100,
                      (todayCount / dailyGoal) * 100,
                    )}%`,
                  }}
                />
              </div>
            </div>

            <div className="setting-group">
              <p className="list-label">READING PLAN</p>
              <div className="plan-options">
                {PLANS.map((item) => (
                  <button
                    key={item.days}
                    onClick={() => setPlan(item.days)}
                    aria-pressed={plan === item.days}
                    className={plan === item.days ? 'active' : ''}
                  >
                    {item.label}
                  </button>
                ))}
              </div>
            </div>

            <label className="language-field">
              <span>Translation</span>
              <select
                value={language}
                onChange={(event) =>
                  setLanguage(event.target.value as Language)
                }
              >
                {LANGUAGES.map((item) => (
                  <option key={item.value} value={item.value}>
                    {item.label}
                  </option>
                ))}
              </select>
            </label>

            <button
              className="browse-button"
              onClick={() => {
                setHomeOpen(false);
                setDrawerOpen(true);
              }}
            >
              <Icon name="menu" />
              Browse all surahs · {done.length} / 114 finished
            </button>

            <button
              className="browse-button spaced"
              disabled={!surahList.length}
              onClick={() => {
                setHomeOpen(false);
                setDiscoverOpen(true);
              }}
            >
              <Icon name="shuffle" />
              Discover random verses
            </button>

            <button
              className="browse-button spaced"
              disabled={Boolean(offline) || !surahList.length}
              onClick={() => void saveOffline()}
            >
              <Icon name="download" />
              {offline
                ? `Saving… ${offline.done} / ${offline.total}`
                : 'Save for offline reading'}
            </button>
          </div>
        </div>
      )}

      {discoverOpen && (
        <Discover
          surahList={surahList}
          language={language}
          saved={savedSet}
          onToggleSave={(key) =>
            setSaved((items) =>
              items.includes(key) ? items.filter((item) => item !== key) : [...items, key],
            )
          }
          onRead={(key) => void goTo(key)}
          onClose={() => setDiscoverOpen(false)}
        />
      )}

      {toast && (
        <div className="toast" role="status">
          {toast}
        </div>
      )}
    </div>
  );
}
