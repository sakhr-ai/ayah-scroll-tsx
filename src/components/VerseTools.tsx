import { useEffect, useState } from 'react';
import type { Language, SurahSummary, Verse } from '../types';
import {
  TAFSIRS,
  fetchTafsir,
  fetchWords,
  type TafsirBlock,
  type WordInfo,
} from '../lib/api';
import { LANGUAGES, isRtl } from '../lib/languages';
import { findWordVerses } from '../lib/search';
import { isValidKey, verseTextOf } from '../lib/verses';

type Props = {
  verseKey: string;
  verse: Verse;
  language: Language;
  surahList: SurahSummary[];
  onJump: (key: string) => void;
};

type Tab = 'tafsir' | 'words' | 'compare';
type Load<T> = { status: 'loading' } | { status: 'error' } | { status: 'ok'; data: T };

const PREVIEW_BLOCKS = 5;

/** Renders text with "2:255"-style references turned into jump buttons. */
function LinkedText({
  text,
  surahList,
  onJump,
}: {
  text: string;
  surahList: SurahSummary[];
  onJump: (key: string) => void;
}) {
  const parts = text.split(/(\b\d{1,3}:\d{1,3}\b)/g);
  return (
    <>
      {parts.map((part, i) =>
        isValidKey(surahList, part) ? (
          <button
            key={i}
            type="button"
            className="ref-link"
            onClick={() => onJump(part)}
            aria-label={`Go to verse ${part}`}
          >
            {part}
          </button>
        ) : (
          <span key={i}>{part}</span>
        ),
      )}
    </>
  );
}

function TafsirTab({ verseKey, surahList, onJump }: Omit<Props, 'verse' | 'language'>) {
  const [tafsirId, setTafsirId] = useState<number>(TAFSIRS[0].id);
  const [state, setState] = useState<Load<{ name: string; blocks: TafsirBlock[] }>>({
    status: 'loading',
  });
  const [expanded, setExpanded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    setExpanded(false);
    fetchTafsir(verseKey, tafsirId)
      .then((data) => !cancelled && setState({ status: 'ok', data }))
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [verseKey, tafsirId]);

  const blocks = state.status === 'ok' ? state.data.blocks : [];
  const shown = expanded ? blocks : blocks.slice(0, PREVIEW_BLOCKS);

  return (
    <div>
      <label className="tool-field">
        <span>Commentary</span>
        <select value={tafsirId} onChange={(e) => setTafsirId(Number(e.target.value))}>
          {TAFSIRS.map((item) => (
            <option key={item.id} value={item.id}>
              {item.label}
            </option>
          ))}
        </select>
      </label>

      {state.status === 'loading' && <p className="tool-note" role="status">Loading commentary…</p>}
      {state.status === 'error' && (
        <p className="tool-note" role="alert">
          Commentary could not be loaded. You may be offline; the Quran.com link
          below still works.
        </p>
      )}
      {state.status === 'ok' && blocks.length === 0 && (
        <p className="tool-note">No commentary is available for this verse in this source.</p>
      )}

      {shown.map((block, i) =>
        block.heading ? (
          <h4 className="tafsir-heading" key={i}>{block.text}</h4>
        ) : (
          <p className="tafsir-text" key={i}>
            <LinkedText text={block.text} surahList={surahList} onJump={onJump} />
          </p>
        ),
      )}

      {blocks.length > PREVIEW_BLOCKS && (
        <button type="button" className="action-button" onClick={() => setExpanded((v) => !v)}>
          {expanded ? 'Show less' : 'Read full commentary'}
        </button>
      )}
      {state.status === 'ok' && state.data.name && (
        <p className="tool-credit">Source: {state.data.name}, via Quran.com. Not part of the Qur’anic text.</p>
      )}
    </div>
  );
}

function WordsTab({ verseKey, surahList, onJump }: Omit<Props, 'verse' | 'language'>) {
  const [state, setState] = useState<Load<WordInfo[]>>({ status: 'loading' });
  const [picked, setPicked] = useState<WordInfo | null>(null);
  const [related, setRelated] = useState<Load<string[]> | null>(null);

  useEffect(() => {
    let cancelled = false;
    setState({ status: 'loading' });
    setPicked(null);
    setRelated(null);
    fetchWords(verseKey)
      .then((data) => !cancelled && setState({ status: 'ok', data }))
      .catch(() => !cancelled && setState({ status: 'error' }));
    return () => {
      cancelled = true;
    };
  }, [verseKey]);

  function pick(word: WordInfo) {
    setPicked(word);
    setRelated({ status: 'loading' });
    findWordVerses(word.arabic, surahList, verseKey)
      .then((data) => setRelated({ status: 'ok', data }))
      .catch(() => setRelated({ status: 'error' }));
  }

  return (
    <div>
      {state.status === 'loading' && <p className="tool-note" role="status">Loading words…</p>}
      {state.status === 'error' && (
        <p className="tool-note" role="alert">Word-by-word data could not be loaded. You may be offline.</p>
      )}

      {state.status === 'ok' && (
        <>
          <p className="tool-note">Tap a word to see where else it appears.</p>
          <div className="word-grid" dir="rtl">
            {state.data.map((word) => (
              <button
                key={word.position}
                type="button"
                className={`word-card ${picked?.position === word.position ? 'active' : ''}`}
                aria-pressed={picked?.position === word.position}
                onClick={() => pick(word)}
                dir="ltr"
              >
                <span className="word-ar" lang="ar" dir="rtl">{word.arabic}</span>
                <span className="word-tr">{word.transliteration}</span>
                <span className="word-en">{word.translation}</span>
              </button>
            ))}
          </div>
        </>
      )}

      {picked && (
        <div className="related-box" aria-live="polite">
          <p className="tool-note">
            Other verses with <span lang="ar" dir="rtl" className="word-inline">{picked.arabic}</span>{' '}
            (same spelling):
          </p>
          {related?.status === 'loading' && <p className="tool-note">Searching…</p>}
          {related?.status === 'error' && <p className="tool-note">Search could not be prepared.</p>}
          {related?.status === 'ok' && related.data.length === 0 && (
            <p className="tool-note">No other verse uses this exact spelling.</p>
          )}
          {related?.status === 'ok' && (
            <div className="ref-row">
              {related.data.map((key) => (
                <button key={key} type="button" className="ref-link" onClick={() => onJump(key)}>
                  {key}
                </button>
              ))}
            </div>
          )}
        </div>
      )}
      <p className="tool-credit">Word data from Quran.com.</p>
    </div>
  );
}

function CompareTab({ verse, language }: Pick<Props, 'verse' | 'language'>) {
  return (
    <ul className="compare-list">
      {LANGUAGES.map((item) => (
        <li key={item.value} className={item.value === language ? 'current' : ''}>
          <span className="compare-label">{item.label}</span>
          <span
            className="compare-text"
            lang={item.value}
            dir={isRtl(item.value) ? 'rtl' : 'ltr'}
          >
            {verseTextOf(verse, item.value)}
          </span>
        </li>
      ))}
    </ul>
  );
}

export default function VerseTools(props: Props) {
  const [open, setOpen] = useState(false);
  const [tab, setTab] = useState<Tab>('tafsir');
  const tabs: { id: Tab; label: string }[] = [
    { id: 'tafsir', label: 'Commentary' },
    { id: 'words', label: 'Word by word' },
    { id: 'compare', label: 'Compare translations' },
  ];

  return (
    <div className="verse-tools">
      <button
        type="button"
        className="action-button tools-toggle"
        aria-expanded={open}
        onClick={() => setOpen((v) => !v)}
      >
        {open ? 'Hide study tools' : 'Study this verse'}
      </button>

      {open && (
        <div className="tools-body">
          <div className="tool-tabs" role="tablist" aria-label="Study tools">
            {tabs.map((item) => (
              <button
                key={item.id}
                type="button"
                role="tab"
                aria-selected={tab === item.id}
                className={tab === item.id ? 'active' : ''}
                onClick={() => setTab(item.id)}
              >
                {item.label}
              </button>
            ))}
          </div>
          <div role="tabpanel">
            {tab === 'tafsir' && (
              <TafsirTab verseKey={props.verseKey} surahList={props.surahList} onJump={props.onJump} />
            )}
            {tab === 'words' && (
              <WordsTab verseKey={props.verseKey} surahList={props.surahList} onJump={props.onJump} />
            )}
            {tab === 'compare' && <CompareTab verse={props.verse} language={props.language} />}
          </div>
        </div>
      )}
    </div>
  );
}
