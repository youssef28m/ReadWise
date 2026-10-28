import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertIcon, BookIcon, SearchIcon, TrashIcon } from '../components/Icons';
import PronunciationButton from '../components/PronunciationButton';

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';

type SavedWord = {
  id: string;
  word: string;
  meaning: string;
  translation: string;
  sentence: string;
  createdAt: string;
};

export default function Vocab() {
  const [items, setItems] = useState<SavedWord[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [deleting, setDeleting] = useState<string | null>(null);

  const load = useCallback(async (search: string) => {
    setLoading(true);
    setError('');
    try {
      const response = await fetch(`${API_BASE}/vocab?q=${encodeURIComponent(search)}`);
      if (!response.ok) throw new Error('Could not load your vocabulary.');
      const data = (await response.json()) as SavedWord[];
      setItems(data);
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not load your vocabulary.');
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    const timer = window.setTimeout(() => {
      void load(query.trim());
    }, query ? 250 : 0);
    return () => window.clearTimeout(timer);
  }, [query, load]);

  async function remove(id: string) {
    setDeleting(id);
    try {
      const response = await fetch(`${API_BASE}/vocab/${id}`, { method: 'DELETE' });
      if (!response.ok) throw new Error('Could not delete this word.');
      setItems((current) => current.filter((item) => item.id !== id));
    } catch (caught) {
      setError(caught instanceof Error ? caught.message : 'Could not delete this word.');
    } finally {
      setDeleting(null);
    }
  }

  return (
    <main className="mx-auto w-full max-w-5xl px-4 pb-20 pt-10">
      <div className="flex flex-wrap items-end justify-between gap-4">
        <div>
          <h1 className="font-serif text-3xl text-stone-900">Vocabulary</h1>
          <p className="mt-1 text-sm text-stone-500">
            {loading ? 'Loading…' : `${items.length} ${items.length === 1 ? 'word' : 'words'} saved`}
          </p>
        </div>

        <div className="flex w-full gap-2 sm:w-auto">
          <Link to="/review" className="shrink-0 rounded-xl bg-stone-900 px-3.5 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800">Review cards</Link>
          <div className="relative min-w-0 flex-1 sm:w-72">
          <SearchIcon className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-stone-400" />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            placeholder="Search words or translations"
            className="w-full rounded-xl border border-stone-200 bg-white py-2.5 pl-9 pr-3 text-sm text-stone-800 shadow-sm outline-none transition placeholder:text-stone-400 focus:border-amber-400 focus:ring-2 focus:ring-amber-200/60"
          />
          </div>
        </div>
      </div>

      {error && (
        <p className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
          <AlertIcon className="h-4 w-4" /> {error}
        </p>
      )}

      {!loading && items.length === 0 && (
        <div className="mt-16 rounded-3xl border border-dashed border-stone-300/80 bg-white/60 px-6 py-16 text-center">
          <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-amber-100 text-amber-700">
            <BookIcon className="h-7 w-7" />
          </div>
          <h2 className="mt-5 font-serif text-xl text-stone-900">
            {query ? 'No matching words' : 'Your vocabulary is empty'}
          </h2>
          <p className="mx-auto mt-2 max-w-sm text-sm leading-relaxed text-stone-500">
            {query
              ? 'Try a different spelling, or search for the translation.'
              : 'Open a PDF and tap a word. Save it from the popup and it will show up here with its sentence.'}
          </p>
          {!query && (
            <Link
              to="/"
              className="mt-6 inline-flex items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800"
            >
              Open the reader
            </Link>
          )}
        </div>
      )}

      {items.length > 0 && (
        <div className="mt-8 grid gap-4 sm:grid-cols-2">
          {items.map((item) => (
            <article
              key={item.id}
              className="group relative flex flex-col rounded-2xl border border-stone-200/80 bg-white p-5 shadow-[0_2px_10px_-8px_rgba(41,37,36,0.3)] transition hover:border-stone-300 hover:shadow-[0_14px_30px_-20px_rgba(41,37,36,0.4)]"
            >
              <div className="flex items-start justify-between gap-3">
                <div className="flex min-w-0 items-center gap-1">
                  <h2 className="truncate font-serif text-xl capitalize text-stone-900">{item.word}</h2>
                  <PronunciationButton word={item.word} />
                </div>
                <button
                  type="button"
                  onClick={() => remove(item.id)}
                  disabled={deleting === item.id}
                  aria-label={`Delete ${item.word}`}
                  className="grid h-8 w-8 shrink-0 place-items-center rounded-lg text-stone-300 transition hover:bg-red-50 hover:text-red-600 disabled:opacity-40"
                >
                  <TrashIcon />
                </button>
              </div>

              <p dir="auto" className="mt-1 text-lg leading-relaxed text-stone-800">
                {item.translation}
              </p>
              <p className="mt-2 text-sm leading-relaxed text-stone-600">{item.meaning}</p>
              {item.sentence && (
                <p className="mt-3 border-l-2 border-amber-200 pl-3 text-xs italic leading-relaxed text-stone-400">
                  {item.sentence}
                </p>
              )}
            </article>
          ))}
        </div>
      )}
    </main>
  );
}
