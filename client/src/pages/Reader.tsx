import { useCallback, useEffect, useRef, useState } from 'react';
import type { PDFDocumentProxy } from 'pdfjs-dist';
import { Document, Page, pdfjs } from 'react-pdf';
import { useParams } from 'react-router-dom';
import 'react-pdf/dist/Page/AnnotationLayer.css';
import 'react-pdf/dist/Page/TextLayer.css';
import Popup from '../components/Popup';
import {
  AlertIcon,
  BookIcon,
  ChevronLeftIcon,
  ChevronRightIcon,
  FileIcon,
  SparkleIcon,
  UploadIcon,
  ZoomInIcon,
  ZoomOutIcon
} from '../components/Icons';
import { extractSentenceFromText, getWordAt, normalizePhrase } from '../utils/sentence';
import { addPdf, listPdfs, savePdf, type StoredPdf, updatePdfProgress } from '../utils/pdfLibrary';

pdfjs.GlobalWorkerOptions.workerSrc = new URL('pdfjs-dist/build/pdf.worker.min.mjs', import.meta.url).toString();

const API_BASE = import.meta.env.VITE_API_URL ?? 'http://localhost:3000';
const ZOOM_MIN = 0.6;
const ZOOM_MAX = 1.8;
const ZOOM_STEP = 0.1;

type PopupState = {
  x: number;
  y: number;
  word: string;
  sentence: string;
};

function caretFromPoint(x: number, y: number): { node: Node; offset: number } | null {
  if (document.caretRangeFromPoint) {
    const range = document.caretRangeFromPoint(x, y);
    if (range) return { node: range.startContainer, offset: range.startOffset };
  }
  if (document.caretPositionFromPoint) {
    const position = document.caretPositionFromPoint(x, y);
    if (position) return { node: position.offsetNode, offset: position.offset };
  }
  return null;
}

function isInsideTextLayer(node: Node): boolean {
  const element = node.nodeType === Node.ELEMENT_NODE ? (node as Element) : node.parentElement;
  return Boolean(element?.closest('.react-pdf__Page__textContent'));
}

function textLayerSpans(root: HTMLElement | null): HTMLElement[] {
  if (!root) return [];
  return Array.from(root.querySelectorAll<HTMLElement>('.react-pdf__Page__textContent span'));
}

function offsetWithinSpans(spans: HTMLElement[], node: Node, offset: number): number {
  let consumed = 0;
  for (const span of spans) {
    if (span.contains(node)) {
      const range = document.createRange();
      range.setStart(span, 0);
      try {
        range.setEnd(node, offset);
      } catch {
        return consumed;
      }
      return consumed + range.toString().length;
    }
    consumed += (span.textContent?.length ?? 0) + 1;
  }
  return -1;
}

function wordRange(node: Node, offset: number): Range | null {
  if (node.nodeType !== Node.TEXT_NODE) return null;
  const text = node.textContent ?? '';
  if (!text) return null;
  let index = Math.min(Math.max(0, offset), text.length - 1);
  if (!/[A-Za-z0-9'’-]/.test(text[index]) && index > 0 && /[A-Za-z0-9'’-]/.test(text[index - 1])) index -= 1;
  if (!/[A-Za-z0-9'’-]/.test(text[index])) return null;
  let start = index;
  let end = index + 1;
  while (start > 0 && /[A-Za-z0-9'’-]/.test(text[start - 1])) start -= 1;
  while (end < text.length && /[A-Za-z0-9'’-]/.test(text[end])) end += 1;
  const range = document.createRange();
  range.setStart(node, start);
  range.setEnd(node, end);
  return range;
}

function rectsForRange(range: Range, container: HTMLElement | null) {
  if (!container) return [];
  const containerRect = container.getBoundingClientRect();
  return Array.from(range.getClientRects())
    .filter((rect) => rect.width > 0 && rect.height > 0)
    .map((rect) => ({ left: rect.left - containerRect.left, top: rect.top - containerRect.top, width: rect.width, height: rect.height }));
}

function PageSkeleton({ width }: { width: number }) {
  return (
    <div
      className="flex flex-col gap-3 rounded-sm bg-white p-10 shadow-xl"
      style={{ width, minHeight: Math.round(width * 1.3) }}
      aria-hidden="true"
    >
      <div className="skeleton h-3 w-1/3 rounded-full" />
      <div className="mt-6 space-y-3">
        {Array.from({ length: 14 }).map((_, index) => (
          <div
            key={index}
            className="skeleton h-2.5 rounded-full"
            style={{ width: `${index % 5 === 4 ? 62 : 94 - (index % 3) * 6}%` }}
          />
        ))}
      </div>
    </div>
  );
}

function EmptyState({ onFile, error }: { onFile: (file: File) => void; error: string }) {
  const [dragging, setDragging] = useState(false);

  return (
    <div className="mx-auto max-w-3xl pt-6 sm:pt-14">
      <div
        onDragOver={(event) => {
          event.preventDefault();
          setDragging(true);
        }}
        onDragLeave={() => setDragging(false)}
        onDrop={(event) => {
          event.preventDefault();
          setDragging(false);
          const dropped = event.dataTransfer.files[0];
          if (dropped) onFile(dropped);
        }}
        className={`rounded-[2rem] border-2 border-dashed px-6 py-14 text-center transition sm:px-14 sm:py-20 ${
          dragging
            ? 'border-amber-400 bg-amber-50/80 shadow-[0_0_0_6px_rgba(251,191,36,0.12)]'
            : 'border-stone-300/80 bg-white/60'
        }`}
      >
        <div className="mx-auto grid h-16 w-16 place-items-center rounded-2xl bg-amber-100 text-amber-700">
          <BookIcon className="h-8 w-8" />
        </div>
        <h1 className="mt-6 font-serif text-3xl text-stone-900 sm:text-4xl">Read closer.</h1>
        <p className="mx-auto mt-3 max-w-md text-sm leading-relaxed text-stone-500">
          Open an English PDF and tap any word. You&apos;ll get its meaning in the context of the sentence, plus a
          translation — without leaving the page.
        </p>
        <label className="mt-7 inline-flex cursor-pointer items-center gap-2 rounded-xl bg-stone-900 px-5 py-3 text-sm font-semibold text-white shadow-sm transition hover:bg-stone-800 focus-within:ring-2 focus-within:ring-stone-900/30">
          <UploadIcon className="h-4 w-4" />
          Choose a PDF
          <input
            type="file"
            accept="application/pdf,.pdf"
            className="sr-only"
            onChange={(event) => {
              const selected = event.target.files?.[0];
              if (selected) onFile(selected);
              event.target.value = '';
            }}
          />
        </label>
        <p className="mt-3 text-xs text-stone-400">or drag and drop it here</p>
      </div>

      {error && (
        <p className="mt-4 flex items-center justify-center gap-2 text-sm text-red-600">
          <AlertIcon className="h-4 w-4" /> {error}
        </p>
      )}

      <div className="mt-10 grid gap-3 text-left sm:grid-cols-3">
        {[
          { title: 'Tap a word', body: 'See a simple meaning written for that exact sentence.' },
          { title: 'Select a phrase', body: 'Highlight two or more words to explain the whole expression.' },
          { title: 'Keep what matters', body: 'Save words with their sentence to your vocabulary list.' }
        ].map((item) => (
          <div key={item.title} className="rounded-2xl border border-stone-200/70 bg-white/50 p-4">
            <div className="flex items-center gap-2 text-sm font-semibold text-stone-800">
              <SparkleIcon className="h-4 w-4 text-amber-600" />
              {item.title}
            </div>
            <p className="mt-1.5 text-xs leading-relaxed text-stone-500">{item.body}</p>
          </div>
        ))}
      </div>
    </div>
  );
}

export default function Reader() {
  const { bookId } = useParams();
  const [books, setBooks] = useState<StoredPdf[]>([]);
  const [book, setBook] = useState<StoredPdf | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [page, setPage] = useState(1);
  const [pageInput, setPageInput] = useState('1');
  const [pdfReady, setPdfReady] = useState(false);
  const [documentError, setDocumentError] = useState('');
  const [targetLang, setTargetLang] = useState('ar');
  const [popup, setPopup] = useState<PopupState | null>(null);
  const [zoom, setZoom] = useState(1);
  const [viewportWidth, setViewportWidth] = useState(() => window.innerWidth);
  const [highlightRects, setHighlightRects] = useState<Array<{ left: number; top: number; width: number; height: number }>>([]);

  const pdfRef = useRef<PDFDocumentProxy | null>(null);
  const pageTextCache = useRef(new Map<number, string>());
  const pageRef = useRef<HTMLDivElement>(null);

  const bookKey = book?.id ?? null;
  const baseWidth = Math.min(880, Math.max(280, viewportWidth - 48));
  const pageWidth = Math.round(baseWidth * zoom);

  useEffect(() => {
    function handleResize() {
      setViewportWidth(window.innerWidth);
    }
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void listPdfs()
      .then((storedBooks) => {
        if (cancelled) return;
        setBooks(storedBooks);
        const selectedBook = storedBooks.find((item) => item.id === bookId) ?? storedBooks[0] ?? null;
        setBook(selectedBook);
        if (selectedBook) setPage(selectedBook.lastPage);
      })
      .catch(() => {
        if (!cancelled) setDocumentError('Your saved PDF library could not be opened.');
      });
    return () => {
      cancelled = true;
    };
  }, [bookId]);

  useEffect(() => {
    if (!bookKey) return;
    const timer = window.setTimeout(() => {
      void updatePdfProgress(bookKey, page).catch(() => undefined);
      setBooks((current) => current.map((item) => (item.id === bookKey ? { ...item, lastPage: page } : item)));
      setBook((current) => (current?.id === bookKey ? { ...current, lastPage: page } : current));
    }, 300);
    return () => window.clearTimeout(timer);
  }, [bookKey, page]);

  useEffect(() => {
    setPopup(null);
    setHighlightRects([]);
  }, [page, bookKey]);

  useEffect(() => {
    setPageInput(String(page));
  }, [page]);

  useEffect(() => {
    if (!popup) return;
    const close = () => {
      setPopup(null);
      setHighlightRects([]);
    };
    window.addEventListener('scroll', close, true);
    return () => window.removeEventListener('scroll', close, true);
  }, [popup]);

  useEffect(() => {
    if (!book) return;
    function handleKeyDown(event: KeyboardEvent) {
      if (event.key !== 'ArrowLeft' && event.key !== 'ArrowRight') return;
      const target = event.target as HTMLElement | null;
      if (target?.closest('input, select, textarea, [contenteditable="true"]')) return;
      changePage(event.key === 'ArrowLeft' ? -1 : 1);
    }
    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [book, numPages]);

  const loadPageText = useCallback(async (pageNumber: number): Promise<string> => {
    const documentProxy = pdfRef.current;
    if (!documentProxy || pageNumber < 1 || pageNumber > documentProxy.numPages) return '';
    const cached = pageTextCache.current.get(pageNumber);
    if (cached !== undefined) return cached;
    try {
      const pdfPage = await documentProxy.getPage(pageNumber);
      const content = await pdfPage.getTextContent();
      const text = content.items
        .map((item) => ('str' in item ? item.str : ''))
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
      pageTextCache.current.set(pageNumber, text);
      return text;
    } catch {
      return '';
    }
  }, []);

  useEffect(() => {
    if (!pdfReady) return;
    void loadPageText(page);
    void loadPageText(page - 1);
    void loadPageText(page + 1);
  }, [page, pdfReady, loadPageText]);

  const openFile = useCallback((selected: File) => {
    const isPdf = selected.type === 'application/pdf' || selected.name.toLowerCase().endsWith('.pdf');
    if (!isPdf) {
      setDocumentError('That file is not a PDF. Please choose a .pdf file.');
      return;
    }
    const savedBook = addPdf(selected);
    pageTextCache.current.clear();
    pdfRef.current = null;
    setBooks((current) => [savedBook, ...current]);
    setBook(savedBook);
    void savePdf(savedBook).catch(() => setDocumentError('This PDF opened, but could not be saved to your library.'));
    setNumPages(0);
    setPdfReady(false);
    setDocumentError('');
    setPopup(null);
    setZoom(1);
    setPage(1);
  }, []);

  const chooseBook = useCallback((id: string) => {
    const selected = books.find((item) => item.id === id);
    if (!selected || selected.id === book?.id) return;
    pageTextCache.current.clear();
    pdfRef.current = null;
    setBook(selected);
    setNumPages(0);
    setPdfReady(false);
    setDocumentError('');
    setPopup(null);
    setZoom(1);
    setPage(selected.lastPage);
  }, [book?.id, books]);

  const handleLoadSuccess = useCallback((documentProxy: PDFDocumentProxy) => {
    pdfRef.current = documentProxy;
    setNumPages(documentProxy.numPages);
    setPdfReady(true);
    setPage((current) => Math.min(Math.max(1, current), documentProxy.numPages));
  }, []);

  const handlePageClick = useCallback(
    async (event: React.MouseEvent<HTMLDivElement>) => {
      const target = event.target as HTMLElement;
      if (target.closest('a, button')) return;

      const selection = window.getSelection();
      const selectionText =
        selection && !selection.isCollapsed ? normalizePhrase(selection.toString()) : '';
      let node: Node | null = null;
      let offset = 0;
      let highlightRange: Range | null = null;

      if (selectionText && selection) {
        const range = selection.getRangeAt(0);
        node = range.startContainer;
        offset = range.startOffset;
        highlightRange = range.cloneRange();
        selection.removeAllRanges();
      } else {
        const caret = caretFromPoint(event.clientX, event.clientY);
        if (caret) {
          node = caret.node;
          offset = caret.offset;
        }
      }

      if (!node || !isInsideTextLayer(node)) return;

      const spans = textLayerSpans(pageRef.current);
      if (spans.length === 0) return;

      const pageText = spans.map((span) => span.textContent ?? '').join(' ');
      const pageOffset = offsetWithinSpans(spans, node, offset);
      if (pageOffset < 0) return;

      const word =
        selectionText ||
        getWordAt(node.textContent ?? '', offset) ||
        getWordAt(pageText, pageOffset);
      if (!word) return;

      const rangeToHighlight = highlightRange ?? wordRange(node, offset);
      if (rangeToHighlight) setHighlightRects(rectsForRange(rangeToHighlight, pageRef.current));

      const [previousText, nextText] = await Promise.all([loadPageText(page - 1), loadPageText(page + 1)]);
      const combined = [previousText, pageText, nextText].filter(Boolean).join(' ');
      const combinedOffset = (previousText ? previousText.length + 1 : 0) + pageOffset;
      const sentence = extractSentenceFromText(combined, combinedOffset) || pageText.trim();

      setPopup({ x: event.clientX, y: event.clientY, word, sentence });
    },
    [loadPageText, page]
  );

  function changeZoom(direction: 1 | -1) {
    setZoom((current) => {
      const next = Math.round((current + direction * ZOOM_STEP) * 10) / 10;
      return Math.min(ZOOM_MAX, Math.max(ZOOM_MIN, next));
    });
  }

  function scrollToPageStart() {
    window.requestAnimationFrame(() => {
      pageRef.current?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  }

  function changePage(direction: 1 | -1) {
    setPage((current) => direction === -1 ? Math.max(1, current - 1) : Math.min(numPages || 1, current + 1));
    scrollToPageStart();
  }

  function goToPage() {
    const requested = Number(pageInput);
    const nextPage = Number.isFinite(requested) ? Math.floor(requested) : page;
    const clampedPage = Math.min(Math.max(1, nextPage), numPages || 1);
    setPage(clampedPage);
    setPageInput(String(clampedPage));
    scrollToPageStart();
  }

  const progress = numPages > 0 ? Math.min(100, (page / numPages) * 100) : 0;

  return (
    <main className="mx-auto w-full max-w-7xl px-4 pb-20 pt-6">
      {!book ? (
        <EmptyState onFile={openFile} error={documentError} />
      ) : (
        <>
          <div className="sticky top-16 z-30 mx-auto max-w-5xl rounded-2xl border border-stone-200/80 bg-[#fbf8f2]/90 p-2.5 shadow-[0_10px_30px_-18px_rgba(41,37,36,0.35)] backdrop-blur">
            <div className="flex flex-wrap items-center gap-2">
              <label className="inline-flex cursor-pointer items-center gap-2 rounded-xl border border-stone-200 bg-white px-3 py-2 text-sm font-medium text-stone-700 shadow-sm transition hover:border-stone-300 hover:bg-stone-50">
                <FileIcon className="h-4 w-4 text-amber-600" />
                <span className="max-w-[11rem] truncate">Add PDF</span>
                <input
                  type="file"
                  accept="application/pdf,.pdf"
                  className="sr-only"
                  onChange={(event) => {
                    const selected = event.target.files?.[0];
                    if (selected) openFile(selected);
                    event.target.value = '';
                  }}
                />
              </label>

              <label className="flex min-w-[10rem] items-center gap-2 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-400 shadow-sm">
                Library
                <select
                  value={book.id}
                  onChange={(event) => chooseBook(event.target.value)}
                  className="min-w-0 flex-1 rounded-md border-0 bg-transparent py-0.5 text-sm font-medium text-stone-800 outline-none"
                  aria-label="Choose a saved PDF"
                >
                  {books.map((item) => (
                    <option key={item.id} value={item.id}>{item.name}</option>
                  ))}
                </select>
              </label>

              <span className="mx-1 hidden h-6 w-px bg-stone-200 sm:block" />

              <div className="flex items-center gap-1">
                <button
                  type="button"
                  onClick={() => changePage(-1)}
                  disabled={!pdfReady || page <= 1}
                  aria-label="Previous page"
                  className="grid h-9 w-9 place-items-center rounded-lg text-stone-600 transition hover:bg-white hover:text-stone-900 disabled:opacity-30"
                >
                  <ChevronLeftIcon />
                </button>
                <div className="flex min-w-[6.5rem] items-center justify-center text-center text-sm tabular-nums text-stone-600">
                  <input
                    type="number"
                    min="1"
                    max={numPages || undefined}
                    value={pdfReady ? pageInput : ''}
                    disabled={!pdfReady}
                    onChange={(event) => setPageInput(event.target.value)}
                    onBlur={goToPage}
                    onKeyDown={(event) => {
                      if (event.key === 'Enter') {
                        event.preventDefault();
                        goToPage();
                        event.currentTarget.blur();
                      }
                    }}
                    aria-label="Go to page"
                    className="w-10 rounded-md bg-transparent py-1 text-center font-semibold text-stone-900 outline-none transition focus:bg-amber-50 focus:ring-2 focus:ring-amber-200 disabled:opacity-60"
                  />
                  <span className="mx-1 text-stone-300">/</span>
                  {numPages || '…'}
                </div>
                <button
                  type="button"
                  onClick={() => changePage(1)}
                  disabled={!pdfReady || page >= numPages}
                  aria-label="Next page"
                  className="grid h-9 w-9 place-items-center rounded-lg text-stone-600 transition hover:bg-white hover:text-stone-900 disabled:opacity-30"
                >
                  <ChevronRightIcon />
                </button>
              </div>

              <div className="ml-auto flex items-center gap-2">
                <div className="flex items-center rounded-xl border border-stone-200 bg-white p-0.5 shadow-sm">
                  <button
                    type="button"
                    onClick={() => changeZoom(-1)}
                    disabled={zoom <= ZOOM_MIN}
                    aria-label="Zoom out"
                    className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30"
                  >
                    <ZoomOutIcon />
                  </button>
                  <span className="w-11 text-center text-xs tabular-nums text-stone-500">
                    {Math.round(zoom * 100)}%
                  </span>
                  <button
                    type="button"
                    onClick={() => changeZoom(1)}
                    disabled={zoom >= ZOOM_MAX}
                    aria-label="Zoom in"
                    className="grid h-8 w-8 place-items-center rounded-lg text-stone-500 transition hover:bg-stone-100 hover:text-stone-800 disabled:opacity-30"
                  >
                    <ZoomInIcon />
                  </button>
                </div>

                <label className="flex items-center gap-2 rounded-xl border border-stone-200 bg-white px-2.5 py-1.5 text-xs text-stone-400 shadow-sm">
                  Translate to
                  <select
                    value={targetLang}
                    onChange={(event) => setTargetLang(event.target.value)}
                    className="rounded-md border-0 bg-transparent py-0.5 text-sm font-medium text-stone-800 outline-none"
                  >
                    <option value="ar">Arabic</option>
                    <option value="fr">French</option>
                    <option value="es">Spanish</option>
                    <option value="de">German</option>
                    <option value="tr">Turkish</option>
                    <option value="ur">Urdu</option>
                  </select>
                </label>
              </div>
            </div>

            <div className="mx-1 mt-2 h-1 overflow-hidden rounded-full bg-stone-200/70">
              <div
                className="h-full rounded-full bg-amber-500 transition-[width] duration-300"
                style={{ width: `${progress}%` }}
              />
            </div>
          </div>

          <p className="mt-3 flex items-center justify-center gap-1.5 text-center text-xs text-stone-400">
            <SparkleIcon className="h-3.5 w-3.5 text-amber-500" />
            Click a word for its meaning in context, or select a phrase to explain it.
          </p>

          {documentError && (
            <p className="mx-auto mt-4 flex max-w-xl items-center justify-center gap-2 rounded-xl border border-red-200 bg-red-50 px-3 py-2 text-sm text-red-700">
              <AlertIcon className="h-4 w-4" /> {documentError}
            </p>
          )}

          <div className="mt-6 flex justify-center overflow-x-auto pb-6">
            <div ref={pageRef} onClick={handlePageClick} className="pdf-page-shell shrink-0">
              <Document
                key={bookKey ?? 'document'}
                file={book.blob}
                onLoadSuccess={handleLoadSuccess}
                onLoadError={(error) => {
                  setPdfReady(false);
                  setDocumentError(`This PDF could not be opened. ${error.message}`);
                }}
                loading={<PageSkeleton width={pageWidth} />}
                error={
                  <div className="rounded-2xl border border-red-200 bg-red-50 px-6 py-10 text-center text-sm text-red-700">
                    This PDF could not be opened.
                  </div>
                }
              >
                <Page
                  pageNumber={page}
                  width={pageWidth}
                  renderTextLayer
                  renderAnnotationLayer
                  className="overflow-hidden rounded-sm bg-white shadow-[0_2px_4px_rgba(41,37,36,0.08),0_28px_60px_-24px_rgba(41,37,36,0.45)]"
                />
              </Document>
              {highlightRects.map((rect, index) => (
                <span
                  key={`${page}-${index}`}
                  className="word-highlight"
                  style={{ left: rect.left, top: rect.top, width: rect.width, height: rect.height }}
                  aria-hidden="true"
                />
              ))}
            </div>
          </div>
        </>
      )}

      {popup && (
        <Popup
          x={popup.x}
          y={popup.y}
          word={popup.word}
          sentence={popup.sentence}
          targetLang={targetLang}
          apiBase={API_BASE}
          onClose={() => {
            setPopup(null);
            setHighlightRects([]);
          }}
        />
      )}
    </main>
  );
}
