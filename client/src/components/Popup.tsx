import { useCallback, useEffect, useLayoutEffect, useRef, useState } from 'react';
import { CheckIcon, SparkleIcon, XIcon } from './Icons';
import PronunciationButton from './PronunciationButton';

const LANGUAGE_NAMES: Record<string, string> = {
  ar: 'Arabic',
  fr: 'French',
  es: 'Spanish',
  de: 'German',
  tr: 'Turkish',
  ur: 'Urdu'
};

type LookupData = {
  meaning: string;
  translation: string;
  partOfSpeech?: string;
  note?: string;
};

type PopupProps = {
  x: number;
  y: number;
  word: string;
  sentence: string;
  targetLang: string;
  apiBase: string;
  onClose: () => void;
};

type Position = {
  left: number;
  top: number;
};

export default function Popup({ x, y, word, sentence, targetLang, apiBase, onClose }: PopupProps) {
  const cardRef = useRef<HTMLDivElement>(null);
  const controllerRef = useRef<AbortController | null>(null);
  const [position, setPosition] = useState<Position>({ left: x + 12, top: y + 16 });
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [data, setData] = useState<LookupData | null>(null);
  const [saved, setSaved] = useState(false);
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [attempt, setAttempt] = useState(0);

  useEffect(() => {
    function handlePointerDown(event: MouseEvent) {
      if (cardRef.current && !cardRef.current.contains(event.target as Node)) onClose();
    }
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key === 'Escape') onClose();
    }
    document.addEventListener('mousedown', handlePointerDown);
    document.addEventListener('keydown', handleKeyDown);
    return () => {
      document.removeEventListener('mousedown', handlePointerDown);
      document.removeEventListener('keydown', handleKeyDown);
    };
  }, [onClose]);

  useEffect(() => {
    controllerRef.current?.abort();
    const controller = new AbortController();
    controllerRef.current = controller;

    setLoading(true);
    setError('');
    setData(null);
    setSaved(false);
    setSaveError('');

    fetch(`${apiBase}/lookup`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ word, sentence, targetLang }),
      signal: controller.signal
    })
      .then(async (response) => {
        const payload = (await response.json().catch(() => ({}))) as {
          message?: string;
          meaning?: string;
          translation?: string;
          partOfSpeech?: string;
          note?: string;
        };
        if (!response.ok) {
          throw new Error(payload.message || 'Could not look up this word.');
        }
        return payload as LookupData;
      })
      .then((payload) => {
        setData(payload);
        setLoading(false);
      })
      .catch((caught: unknown) => {
        if (caught instanceof DOMException && caught.name === 'AbortError') return;
        setError(caught instanceof Error ? caught.message : 'Could not look up this word.');
        setLoading(false);
      });

    return () => controller.abort();
  }, [word, sentence, targetLang, apiBase, attempt]);

  useLayoutEffect(() => {
    const card = cardRef.current;
    if (!card) return;
    const margin = 12;
    const width = card.offsetWidth;
    const height = card.offsetHeight;

    let left = x + 14;
    if (left + width > window.innerWidth - margin) left = window.innerWidth - width - margin;
    left = Math.max(margin, left);

    let top = y + 18;
    if (top + height > window.innerHeight - margin) top = y - height - 14;
    top = Math.max(margin, top);

    setPosition({ left, top });
  }, [x, y, loading, data, error, saved, saveError]);

  const save = useCallback(async () => {
    if (!data || saving || saved) return;
    setSaving(true);
    setSaveError('');
    try {
      const response = await fetch(`${apiBase}/vocab`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          word,
          meaning: data.meaning,
          translation: data.translation,
          sentence
        })
      });
      if (!response.ok) throw new Error('Could not save this word.');
      setSaved(true);
    } catch (caught) {
      setSaveError(caught instanceof Error ? caught.message : 'Could not save this word.');
    } finally {
      setSaving(false);
    }
  }, [apiBase, data, saved, saving, sentence, word]);

  const languageName = LANGUAGE_NAMES[targetLang] ?? targetLang.toUpperCase();

  return (
    <div
      ref={cardRef}
      role="dialog"
      aria-label={`Definition of ${word}`}
      className="animate-pop fixed z-50 w-[23rem] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-2xl border border-stone-200/90 bg-white shadow-[0_24px_60px_-18px_rgba(41,37,36,0.45)]"
      style={{ left: position.left, top: position.top }}
    >
      <div className="flex items-start justify-between gap-3 border-b border-stone-100 px-5 pt-4 pb-3">
        <div className="min-w-0">
          <div className="flex items-center gap-1">
            <h2 className="truncate font-serif text-xl capitalize leading-snug text-stone-900">{word}</h2>
            <PronunciationButton word={word} />
          </div>
          <p className="mt-1 line-clamp-2 text-xs italic leading-relaxed text-stone-400">{sentence}</p>
        </div>
        <button
          type="button"
          onClick={onClose}
          aria-label="Close"
          className="mt-0.5 grid h-7 w-7 shrink-0 place-items-center rounded-full text-stone-400 transition hover:bg-stone-100 hover:text-stone-700"
        >
          <XIcon />
        </button>
      </div>

      <div className="px-5 py-4">
        {loading && (
          <div className="space-y-3" aria-busy="true">
            <div className="skeleton h-3 w-20 rounded-full" />
            <div className="skeleton h-3 w-full rounded-full" />
            <div className="skeleton h-3 w-11/12 rounded-full" />
            <div className="skeleton mt-4 h-14 w-full rounded-xl" />
            <div className="skeleton h-8 w-full rounded-lg" />
          </div>
        )}

        {!loading && error && (
          <div className="rounded-xl border border-amber-200 bg-amber-50 p-3.5">
            <p className="text-sm leading-relaxed text-amber-900">{error}</p>
            <button
              type="button"
              onClick={() => setAttempt((value) => value + 1)}
              className="mt-2.5 text-xs font-semibold text-amber-900 underline decoration-amber-400 underline-offset-2 hover:text-amber-950"
            >
              Try again
            </button>
          </div>
        )}

        {!loading && !error && data && (
          <div className="space-y-4">
            <div className="flex flex-wrap items-center gap-2">
              {data.partOfSpeech && (
                <span className="rounded-full bg-amber-100 px-2.5 py-0.5 text-[11px] font-medium uppercase tracking-wide text-amber-800">
                  {data.partOfSpeech}
                </span>
              )}
              <span className="text-[11px] uppercase tracking-wide text-stone-300">in context</span>
            </div>

            <section>
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">Meaning</h3>
              <p className="mt-1 text-sm leading-relaxed text-stone-700">{data.meaning}</p>
            </section>

            <section className="rounded-xl border border-stone-100 bg-stone-50/80 px-3.5 py-3">
              <h3 className="text-[10px] font-semibold uppercase tracking-[0.14em] text-stone-400">{languageName}</h3>
              <p dir="auto" className="mt-1 text-lg leading-relaxed text-stone-800">
                {data.translation}
              </p>
            </section>

            {data.note && (
              <section className="flex gap-2.5 rounded-xl border border-amber-200/70 bg-amber-50 px-3.5 py-2.5">
                <SparkleIcon className="mt-0.5 h-4 w-4 shrink-0 text-amber-600" />
                <p className="text-xs leading-relaxed text-amber-900">{data.note}</p>
              </section>
            )}

            <button
              type="button"
              onClick={save}
              disabled={saving || saved}
              className={`flex w-full items-center justify-center gap-2 rounded-xl px-4 py-2.5 text-sm font-semibold transition ${
                saved
                  ? 'bg-emerald-50 text-emerald-700 ring-1 ring-inset ring-emerald-200'
                  : 'bg-stone-900 text-white hover:bg-stone-800 disabled:opacity-60'
              }`}
            >
              {saved ? (
                <>
                  <CheckIcon /> Saved to vocabulary
                </>
              ) : saving ? (
                'Saving…'
              ) : (
                'Save word'
              )}
            </button>
            {saveError && <p className="text-center text-xs text-red-600">{saveError}</p>}
          </div>
        )}
      </div>
    </div>
  );
}
