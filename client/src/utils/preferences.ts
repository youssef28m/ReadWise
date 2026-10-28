const TRANSLATION_MODE_KEY = 'tapword-translation-mode';
const LAST_LANGUAGE_KEY = 'tapword-last-lang';

export function readTranslationMode(): string {
  return window.localStorage.getItem(TRANSLATION_MODE_KEY) ?? 'ar';
}

export function writeTranslationMode(mode: string): void {
  window.localStorage.setItem(TRANSLATION_MODE_KEY, mode);
  if (mode !== 'off') window.localStorage.setItem(LAST_LANGUAGE_KEY, mode);
}

export function readLastLanguage(): string {
  const stored = window.localStorage.getItem(LAST_LANGUAGE_KEY);
  return stored && stored !== 'off' ? stored : 'ar';
}

export function isEnglishOnly(): boolean {
  return readTranslationMode() === 'off';
}
