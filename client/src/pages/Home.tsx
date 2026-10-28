import { useCallback, useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { AlertIcon, BookIcon, FileIcon, SparkleIcon, UploadIcon } from '../components/Icons';
import { addPdf, listPdfs, savePdf, type StoredPdf } from '../utils/pdfLibrary';

function formatFileSize(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.max(1, Math.round(bytes / 1024))} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function displayTitle(name: string): string {
  return name.replace(/\.pdf$/i, '');
}

export default function Home() {
  const [books, setBooks] = useState<StoredPdf[]>([]);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState('');
  const [uploading, setUploading] = useState(false);
  const navigate = useNavigate();

  useEffect(() => {
    void listPdfs()
      .then(setBooks)
      .catch(() => setError('Your saved PDF library could not be opened.'));
  }, []);

  const upload = useCallback(async (file: File) => {
    const isPdf = file.type === 'application/pdf' || file.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setError('Please choose a PDF file.');
      return;
    }
    setUploading(true);
    setError('');
    const book = addPdf(file);
    try {
      await savePdf(book);
      setBooks((current) => [book, ...current]);
      navigate(`/reader/${book.id}`);
    } catch {
      setError('This PDF could not be saved to your library.');
    } finally {
      setUploading(false);
    }
  }, [navigate]);

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-10 sm:pt-14">
      <section className="grid gap-8 rounded-[2rem] border border-stone-200/80 bg-white/65 px-6 py-8 shadow-[0_20px_60px_-45px_rgba(41,37,36,0.55)] sm:px-10 sm:py-11 lg:grid-cols-[1fr_25rem] lg:items-center">
        <div>
          <p className="flex items-center gap-2 text-sm font-semibold text-amber-700"><SparkleIcon className="h-4 w-4" /> Your reading space</p>
          <h1 className="mt-3 max-w-xl font-serif text-4xl leading-tight text-stone-900 sm:text-5xl">Your PDF library, ready whenever you are.</h1>
          <p className="mt-4 max-w-2xl text-sm leading-relaxed text-stone-500 sm:text-base">Keep all of your reading PDFs in one place. Open any book to continue where you left off, then tap unfamiliar words as you read.</p>
        </div>

        <div
          onDragOver={(event) => { event.preventDefault(); setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={(event) => {
            event.preventDefault();
            setDragging(false);
            const file = event.dataTransfer.files[0];
            if (file) void upload(file);
          }}
          className={`rounded-2xl border-2 border-dashed p-6 text-center transition ${dragging ? 'border-amber-400 bg-amber-50 shadow-[0_0_0_6px_rgba(251,191,36,0.13)]' : 'border-stone-300 bg-[#f7f3ea]/70'}`}
        >
          <div className="mx-auto grid h-12 w-12 place-items-center rounded-xl bg-amber-100 text-amber-700"><UploadIcon className="h-6 w-6" /></div>
          <h2 className="mt-4 font-serif text-xl text-stone-900">Add a new PDF</h2>
          <p className="mt-1.5 text-xs leading-relaxed text-stone-500">Drop it here, or choose a file from your device.</p>
          <label className="mt-5 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-stone-900 px-4 py-2.5 text-sm font-semibold text-white transition hover:bg-stone-800 focus-within:ring-2 focus-within:ring-stone-900/30">
            <UploadIcon className="h-4 w-4" />
            {uploading ? 'Saving PDF…' : 'Choose a PDF'}
            <input type="file" accept="application/pdf,.pdf" className="sr-only" disabled={uploading} onChange={(event) => {
              const file = event.target.files?.[0];
              if (file) void upload(file);
              event.target.value = '';
            }} />
          </label>
        </div>
      </section>

      {error && <p className="mt-6 flex items-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700"><AlertIcon className="h-4 w-4" /> {error}</p>}

      <section className="mt-12">
        <div className="flex items-end justify-between gap-4">
          <div>
            <h2 className="font-serif text-3xl text-stone-900">Your library</h2>
            <p className="mt-1 text-sm text-stone-500">{books.length ? `${books.length} ${books.length === 1 ? 'PDF' : 'PDFs'} saved on this device` : 'Add your first PDF to start reading.'}</p>
          </div>
        </div>

        {books.length === 0 ? (
          <div className="mt-6 rounded-3xl border border-dashed border-stone-300 bg-white/45 px-6 py-14 text-center">
            <div className="mx-auto grid h-14 w-14 place-items-center rounded-2xl bg-stone-100 text-stone-400"><BookIcon className="h-7 w-7" /></div>
            <h3 className="mt-4 font-serif text-xl text-stone-900">Your shelves are empty</h3>
            <p className="mt-2 text-sm text-stone-500">Upload a PDF above and it will stay here for your next reading session.</p>
          </div>
        ) : (
          <div className="mt-6 grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {books.map((book, index) => (
              <Link key={book.id} to={`/reader/${book.id}`} className="group relative overflow-hidden rounded-2xl border border-stone-200/90 bg-white p-5 shadow-[0_8px_24px_-20px_rgba(41,37,36,0.6)] transition hover:-translate-y-0.5 hover:border-amber-300 hover:shadow-[0_18px_35px_-24px_rgba(120,53,15,0.6)]">
                <div className={`absolute inset-x-0 top-0 h-1 ${index % 3 === 0 ? 'bg-amber-400' : index % 3 === 1 ? 'bg-orange-300' : 'bg-yellow-500'}`} />
                <div className="flex items-start justify-between gap-4">
                  <span className="grid h-11 w-11 shrink-0 place-items-center rounded-xl bg-amber-100 text-amber-700"><FileIcon className="h-5 w-5" /></span>
                  <span className="rounded-full bg-stone-100 px-2.5 py-1 text-xs font-medium text-stone-500">Page {book.lastPage}</span>
                </div>
                <h3 className="mt-5 truncate font-serif text-xl text-stone-900" title={book.name}>{displayTitle(book.name)}</h3>
                <p className="mt-1 text-xs text-stone-400">PDF · {formatFileSize(book.size)}</p>
                <p className="mt-5 text-sm font-semibold text-amber-700 transition group-hover:text-amber-800">Continue reading <span aria-hidden="true">→</span></p>
              </Link>
            ))}
          </div>
        )}
      </section>
    </main>
  );
}
