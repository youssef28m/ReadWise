import { useEffect, useRef, useState } from 'react';
import type { KeyboardEvent } from 'react';
import { CheckIcon, ChevronDownIcon } from './Icons';

export type SelectOption = {
  value: string;
  label: string;
  shortLabel?: string;
};

type SelectProps = {
  value: string;
  options: SelectOption[];
  onChange: (value: string) => void;
  label?: string;
  ariaLabel?: string;
  align?: 'left' | 'right';
  tone?: 'light' | 'dark';
  className?: string;
};

export default function Select({
  value,
  options,
  onChange,
  label,
  ariaLabel,
  align = 'left',
  tone = 'light',
  className = ''
}: SelectProps) {
  const dark = tone === 'dark';
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const rootRef = useRef<HTMLDivElement>(null);
  const listRef = useRef<HTMLDivElement>(null);

  const selectedIndex = options.findIndex((option) => option.value === value);
  const selected = selectedIndex >= 0 ? options[selectedIndex] : undefined;

  useEffect(() => {
    if (!open) return;
    function handlePointerDown(event: MouseEvent) {
      if (rootRef.current && !rootRef.current.contains(event.target as Node)) setOpen(false);
    }
    document.addEventListener('mousedown', handlePointerDown);
    return () => document.removeEventListener('mousedown', handlePointerDown);
  }, [open]);

  useEffect(() => {
    if (!open || activeIndex < 0) return;
    const item = listRef.current?.children[activeIndex] as HTMLElement | undefined;
    item?.scrollIntoView({ block: 'nearest' });
  }, [open, activeIndex]);

  function openMenu() {
    setActiveIndex(selectedIndex >= 0 ? selectedIndex : 0);
    setOpen(true);
  }

  function closeMenu() {
    setOpen(false);
    setActiveIndex(-1);
  }

  function choose(option: SelectOption) {
    onChange(option.value);
    closeMenu();
  }

  function handleKeyDown(event: KeyboardEvent<HTMLButtonElement>) {
    if (!open) {
      if (event.key === 'ArrowDown' || event.key === 'ArrowUp' || event.key === 'Enter' || event.key === ' ') {
        event.preventDefault();
        openMenu();
      }
      return;
    }

    switch (event.key) {
      case 'ArrowDown':
        event.preventDefault();
        setActiveIndex((index) => Math.min(options.length - 1, index + 1));
        break;
      case 'ArrowUp':
        event.preventDefault();
        setActiveIndex((index) => Math.max(0, index - 1));
        break;
      case 'Home':
        event.preventDefault();
        setActiveIndex(0);
        break;
      case 'End':
        event.preventDefault();
        setActiveIndex(options.length - 1);
        break;
      case 'Enter':
      case ' ':
        event.preventDefault();
        if (activeIndex >= 0 && options[activeIndex]) choose(options[activeIndex]);
        break;
      case 'Escape':
        event.preventDefault();
        closeMenu();
        break;
      case 'Tab':
        closeMenu();
        break;
    }
  }

  return (
    <div ref={rootRef} className={`relative ${className}`}>
      <button
        type="button"
        onClick={() => (open ? closeMenu() : openMenu())}
        onKeyDown={handleKeyDown}
        aria-haspopup="listbox"
        aria-expanded={open}
        aria-label={ariaLabel ?? label}
        className={`group flex w-full items-center gap-2 rounded-xl border py-1.5 pl-2.5 pr-2 text-left shadow-sm transition ${
          dark ? 'bg-[#2b2824]' : 'bg-white'
        } ${
          open
            ? dark
              ? 'border-amber-400/70 ring-2 ring-amber-400/30'
              : 'border-amber-300/90 ring-2 ring-amber-200/70'
            : dark
              ? 'border-stone-700 hover:border-stone-600 hover:bg-[#33302a]'
              : 'border-stone-200 hover:border-stone-300 hover:bg-stone-50'
        }`}
      >
        {label && <span className="shrink-0 select-none whitespace-nowrap text-xs text-stone-400">{label}</span>}
        <span className={`min-w-0 flex-1 truncate text-sm font-medium ${dark ? 'text-stone-100' : 'text-stone-800'}`}>
          {selected ? selected.shortLabel ?? selected.label : '—'}
        </span>
        <ChevronDownIcon
          className={`h-3.5 w-3.5 shrink-0 transition duration-150 ${
            open
              ? dark
                ? 'rotate-180 text-amber-400'
                : 'rotate-180 text-amber-600'
              : dark
                ? 'text-stone-500 group-hover:text-stone-300'
                : 'text-stone-400 group-hover:text-stone-600'
          }`}
        />
      </button>

      {open && (
        <div
          ref={listRef}
          role="listbox"
          aria-label={ariaLabel ?? label}
          className={`animate-pop absolute top-full z-50 mt-1.5 max-h-64 w-max min-w-full max-w-[18rem] overflow-y-auto rounded-xl border p-1 ${
            dark
              ? 'border-stone-700 bg-[#2b2824] shadow-[0_18px_45px_-15px_rgba(0,0,0,0.8)]'
              : 'border-stone-200/90 bg-white shadow-[0_18px_45px_-15px_rgba(41,37,36,0.45)]'
          } ${align === 'right' ? 'right-0' : 'left-0'}`}
        >
          {options.map((option, index) => {
            const isSelected = option.value === value;
            const isActive = index === activeIndex;
            return (
              <button
                key={option.value}
                type="button"
                role="option"
                aria-selected={isSelected}
                onMouseEnter={() => setActiveIndex(index)}
                onClick={() => choose(option)}
                className={`flex w-full items-center justify-between gap-3 rounded-lg px-2.5 py-1.5 text-left text-sm transition ${
                  isSelected
                    ? dark
                      ? `bg-amber-500/15 font-medium text-amber-200 ${isActive ? 'bg-amber-500/25' : ''}`
                      : `bg-amber-50/80 font-medium text-amber-950 ${isActive ? 'bg-amber-100/70' : ''}`
                    : isActive
                      ? dark
                        ? 'bg-stone-700/60 text-stone-100'
                        : 'bg-stone-100/90 text-stone-900'
                      : dark
                        ? 'text-stone-300'
                        : 'text-stone-600'
                }`}
              >
                <span className="min-w-0 flex-1 truncate">{option.label}</span>
                {isSelected && <CheckIcon className={`h-3.5 w-3.5 shrink-0 ${dark ? 'text-amber-400' : 'text-amber-600'}`} />}
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}
