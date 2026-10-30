import { Link, NavLink, Route, Routes } from 'react-router-dom';
import Reader from './pages/Reader';
import Vocab from './pages/Vocab';
import Home from './pages/Home';
import Review from './pages/Review';
import { BookIcon } from './components/Icons';
import ThemeToggle from './components/ThemeToggle';

const navLinkClass = ({ isActive }: { isActive: boolean }) =>
  `rounded-full px-3 py-1.5 text-sm font-medium transition sm:px-4 ${
    isActive
      ? 'bg-stone-900 text-white shadow-sm dark:bg-amber-500 dark:text-stone-950'
      : 'text-stone-500 hover:bg-stone-100 hover:text-stone-800 dark:text-stone-400 dark:hover:bg-stone-800 dark:hover:text-stone-100'
  }`;

export default function App() {
  return (
    <div className="min-h-screen">
      <header className="app-header sticky top-0 z-40 border-b border-stone-200/70 bg-[#f7f3ea]/85 backdrop-blur-md dark:border-stone-700/70 dark:bg-[#1f1d1a]/90">
        <div className="mx-auto flex h-16 max-w-7xl items-center justify-between gap-2 px-4 sm:gap-4">
          <Link to="/" className="group flex shrink-0 items-center gap-2.5">
            <span className="app-logo-badge grid h-9 w-9 place-items-center rounded-xl bg-amber-100 text-amber-700 ring-1 ring-inset ring-amber-200/60 transition group-hover:bg-amber-200/70 dark:bg-amber-500/15 dark:text-amber-400 dark:ring-amber-500/30 dark:group-hover:bg-amber-500/25">
              <BookIcon className="h-5 w-5" />
            </span>
            <span className="app-brand font-serif text-xl tracking-tight text-stone-900 dark:text-stone-100">Readwise</span>
          </Link>

          <div className="flex min-w-0 items-center gap-2">
            <nav className="app-nav flex items-center gap-1 overflow-x-auto rounded-full border border-stone-200/80 bg-white/70 p-1 shadow-sm backdrop-blur dark:border-stone-700/80 dark:bg-[#2b2824]/85">
              <NavLink to="/" end className={navLinkClass}>
                Library
              </NavLink>
              <NavLink to="/reader" className={navLinkClass}>
                Reader
              </NavLink>
              <NavLink to="/review" className={navLinkClass}>
                Review
              </NavLink>
              <NavLink to="/vocab" className={navLinkClass}>
                Vocabulary
              </NavLink>
            </nav>
            <ThemeToggle />
          </div>
        </div>
      </header>

      <Routes>
        <Route path="/" element={<Home />} />
        <Route path="/reader" element={<Reader />} />
        <Route path="/reader/:bookId" element={<Reader />} />
        <Route path="/review" element={<Review />} />
        <Route path="/vocab" element={<Vocab />} />
      </Routes>
    </div>
  );
}
