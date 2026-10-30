import { MoonIcon, SunIcon } from './Icons';
import { useTheme } from '../theme';

export default function ThemeToggle() {
  const { theme, toggleNight } = useTheme();
  const dark = theme === 'night';

  return (
    <button
      type="button"
      onClick={toggleNight}
      aria-label={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      aria-pressed={dark}
      title={dark ? 'Switch to light mode' : 'Switch to dark mode'}
      className="grid h-9 w-9 shrink-0 place-items-center rounded-full border border-stone-200/80 bg-white/70 text-stone-500 shadow-sm backdrop-blur transition hover:bg-stone-100 hover:text-stone-800 dark:border-stone-700/80 dark:bg-[#2b2824]/85 dark:text-stone-400 dark:hover:bg-stone-700/70 dark:hover:text-stone-100"
    >
      {dark ? <SunIcon className="h-4 w-4" /> : <MoonIcon className="h-4 w-4" />}
    </button>
  );
}
