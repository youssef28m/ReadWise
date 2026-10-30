import { useCallback, useEffect, useRef, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertIcon, BookIcon, CheckIcon, SparkleIcon, UndoIcon } from '../components/Icons';
import PronunciationButton from '../components/PronunciationButton';
import { isEnglishOnly } from '../utils/preferences';
import { useTheme } from '../theme';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type SavedWord = {
  id: string;
  word: string;
  meaning: string;
  translation: string;
  sentence: string;
  repetition: number;
  intervalDays: number;
  easeFactor: number;
};

type Rating = 'again' | 'hard' | 'good' | 'easy' | 'learned';

type Counts = { new: number; learning: number; review: number };

type UndoState = {
  logId: string;
  cards: SavedWord[];
  dueCount: number;
  counts: Counts;
};

const reviewButtons: Array<{ rating: Exclude<Rating, 'learned'>; label: string; className: string }> = [
  { rating: 'again', label: 'Again', className: 'border-red-200 bg-red-50 text-red-700 hover:bg-red-100 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300 dark:hover:bg-red-500/20' },
  { rating: 'hard', label: 'Hard', className: 'border-orange-200 bg-orange-50 text-orange-700 hover:bg-orange-100 dark:border-orange-500/30 dark:bg-orange-500/10 dark:text-orange-300 dark:hover:bg-orange-500/20' },
  { rating: 'good', label: 'Good', className: 'border-amber-200 bg-amber-50 text-amber-800 hover:bg-amber-100 dark:border-amber-500/30 dark:bg-amber-500/10 dark:text-amber-300 dark:hover:bg-amber-500/20' },
  { rating: 'easy', label: 'Easy', className: 'border-emerald-200 bg-emerald-50 text-emerald-700 hover:bg-emerald-100 dark:border-emerald-500/30 dark:bg-emerald-500/10 dark:text-emerald-300 dark:hover:bg-emerald-500/20' }
];

function nextInterval(card: SavedWord, rating: Exclude<Rating, 'learned'>): string {
  if (rating === 'again') return '10 min';
  const ease = rating === 'hard' ? Math.max(1.3, card.easeFactor - 0.15) : rating === 'easy' ? card.easeFactor + 0.15 : card.easeFactor;
  const days = rating === 'hard'
    ? Math.max(1, card.intervalDays ? Math.ceil(card.intervalDays * 1.2) : 1)
    : rating === 'easy'
      ? card.repetition === 0 ? 4 : Math.max(2, Math.ceil(card.intervalDays * ease * 1.3))
      : card.repetition === 0 ? 1 : Math.max(1, Math.ceil(card.intervalDays * ease));
  return `${days} ${days === 1 ? 'day' : 'days'}`;
}

export default function Review() {
  const [cards, setCards] = useState<SavedWord[]>([]);
  const [dueCount, setDueCount] = useState(0);
  const [counts, setCounts] = useState<Counts>({ new: 0, learning: 0, review: 0 });
  const [loading, setLoading] = useState(true);
  const [revealed, setRevealed] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState('');
  const [undoState, setUndoState] = useState<UndoState | null>(null);
  const loadId = useRef(0);
  const { theme } = useTheme();
  const night = theme === 'night';
  const englishOnly = isEnglishOnly();

  const load = useCallback(async (options?: { preserveUndo?: boolean }) => {
    const requestId = ++loadId.current;
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/vocab/review/due`);
      if (!response.ok) throw new Error('Could not load your review cards.');
      const data = (await response.json()) as { items: SavedWord[]; dueCount: number; counts: Counts };
      if (requestId !== loadId.current) return;
      setCards(data.items);
      setDueCount(data.dueCount);
      setCounts(data.counts);
      setRevealed(false);
      if (!options?.preserveUndo) setUndoState(null);
    } catch (caught) {
      if (requestId === loadId.current) setError(caught instanceof Error ? caught.message : 'Could not load your review cards.');
    } finally {
      if (requestId === loadId.current) setLoading(false);
    }
  }, []);

  useEffect(() => { void load(); }, [load]);

  async function rate(rating: Rating) {
    const card = cards[0];
    if (!card || submitting) return;
    const previousCards = cards;
    const previousDueCount = dueCount;
    const previousCounts = counts;
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/vocab/${card.id}/review`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ rating })
      });
      if (!response.ok) throw new Error('Could not save this review.');
      const data = (await response.json()) as { logId?: string; dueCount: number; counts: Counts };
      const rest = cards.slice(1);
      const nextCards = rating === 'again' ? [...rest, card] : rest;
      setCards(nextCards);
      setRevealed(false);
      setCounts(data.counts);
      setDueCount(data.dueCount);
      setUndoState(data.logId ? { logId: data.logId, cards: previousCards, dueCount: previousDueCount, counts: previousCounts } : null);
      if (nextCards.length === 0 && data.dueCount > 0) void load({ preserveUndo: true });
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not save this review.');
    } finally {
      setSubmitting(false);
    }
  }

  async function undo() {
    if (!undoState || submitting) return;
    loadId.current += 1;
    setLoading(false);
    setSubmitting(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/vocab/review/undo`, {
        method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ logId: undoState.logId })
      });
      if (!response.ok) throw new Error('Could not undo this review.');
      const data = (await response.json()) as { dueCount: number; counts: Counts };
      setCards(undoState.cards);
      setCounts(data.counts);
      setDueCount(data.dueCount);
      setRevealed(true);
      setUndoState(null);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not undo this review.');
    } finally {
      setSubmitting(false);
    }
  }

  const card = cards[0];
  const sessionRemaining = cards.length;
  const statusText = loading
    ? 'Loading your cards…'
    : dueCount > 0
      ? `${dueCount} ${dueCount === 1 ? 'card' : 'cards'} due today`
      : sessionRemaining > 0
        ? `${sessionRemaining} ${sessionRemaining === 1 ? 'card' : 'cards'} left in this session`
        : 'All caught up';

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, textarea, select, [contenteditable="true"]') || event.metaKey || event.ctrlKey || event.altKey) return;
      if ((event.key === 'z' || event.key === 'Z') && undoState && !submitting) {
        event.preventDefault();
        void undo();
        return;
      }
      if (event.key === ' ' && card && !revealed) {
        event.preventDefault();
        setRevealed(true);
        return;
      }
      if (!card || !revealed || submitting) return;
      const ratings: Record<string, Exclude<Rating, 'learned'> | undefined> = { '1': 'again', '2': 'hard', '3': 'good', '4': 'easy' };
      const rating = ratings[event.key];
      if (rating) {
        event.preventDefault();
        void rate(rating);
      }
    }
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [card, revealed, submitting, undoState]);

  return (
    <main className="mx-auto w-full max-w-3xl px-4 pb-20 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700 dark:text-amber-400"><SparkleIcon className="h-4 w-4" /> Spaced repetition</p>
          <h1 className="mt-2 font-serif text-4xl text-stone-900 dark:text-stone-100">Review</h1>
          <p className="mt-1 text-sm text-stone-500 dark:text-stone-400">{statusText}</p>
        </div>
        <Link to="/vocab" className="rounded-xl border border-stone-200 bg-white px-3.5 py-2 text-sm font-medium text-stone-600 shadow-sm transition hover:bg-stone-50 dark:border-stone-700 dark:bg-[#2b2824] dark:text-stone-300 dark:hover:bg-stone-800">View vocabulary</Link>
      </div>

      {error && <p className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700 dark:border-red-500/30 dark:bg-red-500/10 dark:text-red-300"><AlertIcon className="h-4 w-4" /> {error}</p>}

      {!loading && dueCount > 0 && <div className="mt-6 grid grid-cols-3 gap-2 text-center text-xs"><div className="rounded-xl border border-stone-200 bg-white px-3 py-2 dark:border-stone-700 dark:bg-[#26231f]"><strong className="block text-base text-stone-900 dark:text-stone-100">{counts.new}</strong><span className="text-stone-400 dark:text-stone-500">New</span></div><div className="rounded-xl border border-stone-200 bg-white px-3 py-2 dark:border-stone-700 dark:bg-[#26231f]"><strong className="block text-base text-stone-900 dark:text-stone-100">{counts.learning}</strong><span className="text-stone-400 dark:text-stone-500">Learning</span></div><div className="rounded-xl border border-stone-200 bg-white px-3 py-2 dark:border-stone-700 dark:bg-[#26231f]"><strong className="block text-base text-stone-900 dark:text-stone-100">{counts.review}</strong><span className="text-stone-400 dark:text-stone-500">Review</span></div></div>}

      {loading ? <div className="skeleton mt-8 h-[28rem] rounded-3xl" /> : !card ? (
        <section className="mt-8 rounded-3xl border border-dashed border-stone-300 bg-white/55 px-6 py-16 text-center dark:border-stone-700 dark:bg-[#26231f]/70">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-emerald-100 text-emerald-700 dark:bg-emerald-500/15 dark:text-emerald-400"><CheckIcon className="h-7 w-7" /></div>
          <h2 className="mt-5 font-serif text-2xl text-stone-900 dark:text-stone-100">You&apos;re all caught up.</h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stone-500 dark:text-stone-400">New saved words will appear here when they are ready to review.</p>
          <Link to="/vocab" className="mt-6 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 dark:bg-amber-500 dark:text-stone-950 dark:hover:bg-amber-400"><BookIcon className="h-4 w-4" /> Go to vocabulary</Link>
        </section>
      ) : (
        <section className="mt-8">
          <div className="overflow-hidden rounded-3xl border border-stone-200 bg-white shadow-[0_20px_55px_-35px_rgba(41,37,36,0.5)] dark:border-stone-700 dark:bg-[#26231f] dark:shadow-[0_20px_55px_-25px_rgba(0,0,0,0.7)]">
            <div className="h-1.5 bg-gradient-to-r from-amber-400 via-orange-300 to-amber-400" />
            <div className="flex min-h-[25rem] flex-col justify-center px-7 py-10 text-center sm:px-14">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-stone-400 dark:text-stone-500">
                {revealed ? 'Answer' : 'Front'}
              </p>
              <div className="mt-4 flex items-center justify-center gap-2">
                <h2 className="font-serif text-5xl capitalize text-stone-900 dark:text-stone-100 sm:text-6xl">{card.word}</h2>
                <PronunciationButton word={card.word} night={night} className="h-9 w-9" />
              </div>
              {card.sentence && (
                <p className="mx-auto mt-5 max-w-xl rounded-xl border border-stone-100 bg-stone-50/80 px-4 py-3 text-sm italic leading-relaxed text-stone-500 dark:border-stone-700 dark:bg-stone-800/50 dark:text-stone-400">
                  {card.sentence}
                </p>
              )}
              {revealed ? (
                <div className="mt-7 animate-pop border-t border-stone-100 pt-6 dark:border-stone-700">
                  {!englishOnly && (
                    <p dir="auto" className="text-center font-serif text-3xl text-stone-900 dark:text-stone-100">{card.translation}</p>
                  )}
                  <p className={`text-center text-sm leading-relaxed text-stone-600 dark:text-stone-300 ${englishOnly ? '' : 'mt-4'}`}>
                    {card.meaning}
                  </p>
                </div>
              ) : (
                <p className="mt-5 text-sm italic text-stone-400 dark:text-stone-500">Guess the meaning, then reveal the answer.</p>
              )}
            </div>
          </div>

          {!revealed ? <button type="button" onClick={() => setRevealed(true)} className="mt-5 w-full rounded-xl bg-stone-900 px-4 py-3 text-sm font-semibold text-white transition hover:bg-stone-800 dark:bg-amber-500 dark:text-stone-950 dark:hover:bg-amber-400">Reveal answer <span className="ml-1 text-stone-300 dark:text-stone-800/70">Space</span></button> : <>
            <div className="mt-5 grid grid-cols-2 gap-3 sm:grid-cols-4">
              {reviewButtons.map((button, index) => <button key={button.rating} type="button" disabled={submitting} onClick={() => void rate(button.rating)} className={`rounded-xl border px-3 py-3 text-sm font-semibold transition disabled:opacity-50 ${button.className}`}><span className="block">{button.label} <span className="text-xs opacity-60">{index + 1}</span></span><span className="mt-0.5 block text-[11px] font-normal opacity-75">{nextInterval(card, button.rating)}</span></button>)}
            </div>
            <button type="button" disabled={submitting} onClick={() => void rate('learned')} className="mt-4 w-full rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-500 transition hover:border-emerald-200 hover:bg-emerald-50 hover:text-emerald-700 disabled:opacity-50 dark:border-stone-700 dark:bg-[#2b2824] dark:text-stone-400 dark:hover:border-emerald-500/30 dark:hover:bg-emerald-500/10 dark:hover:text-emerald-300">I know this word — remove it from vocabulary</button>
          </>}
        </section>
      )}

      {undoState && (
        <button type="button" disabled={submitting} onClick={() => void undo()} className="mt-4 inline-flex w-full items-center justify-center gap-2 rounded-xl border border-stone-200 bg-white px-4 py-2.5 text-sm font-medium text-stone-500 transition hover:border-amber-200 hover:bg-amber-50 hover:text-amber-800 disabled:opacity-50 dark:border-stone-700 dark:bg-[#2b2824] dark:text-stone-400 dark:hover:border-amber-500/30 dark:hover:bg-amber-500/10 dark:hover:text-amber-300">
          <UndoIcon className="h-4 w-4" /> Undo last rating <span className="text-xs opacity-60">Z</span>
        </button>
      )}
    </main>
  );
}
