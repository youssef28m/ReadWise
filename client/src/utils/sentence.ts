const ABBREVIATIONS = [
  'mr.',
  'mrs.',
  'ms.',
  'dr.',
  'prof.',
  'sr.',
  'jr.',
  'st.',
  'etc.',
  'e.g.',
  'i.e.',
  'vs.',
  'approx.',
  'dept.',
  'est.',
  'fig.',
  'no.',
  'vol.'
];

const WORD_CHAR = /[A-Za-z0-9'’-]/;

function isAbbreviation(text: string, dotIndex: number): boolean {
  const before = text.slice(Math.max(0, dotIndex - 12), dotIndex + 1).toLowerCase();
  return ABBREVIATIONS.some((abbr) => {
    if (!before.endsWith(abbr)) return false;
    const start = before.length - abbr.length;
    if (start === 0) return true;
    return /[\s"'(]/.test(before[start - 1]);
  });
}

function isSentenceBoundary(text: string, index: number): boolean {
  const char = text[index];
  if (char !== '.' && char !== '!' && char !== '?') return false;
  if (char === '.') {
    if (isAbbreviation(text, index)) return false;
    const nextNonSpace = text.slice(index + 1).match(/\S/);
    if (nextNonSpace && /[0-9]/.test(nextNonSpace[0])) return false;
    const before = text.slice(Math.max(0, index - 1), index + 1);
    if (/[A-Z]\.$/.test(before) && nextNonSpace && /[A-Z]/.test(nextNonSpace[0])) return false;
  }
  return true;
}

export function extractSentenceFromText(text: string, wordIndex: number): string {
  if (!text) return '';
  const index = Math.min(Math.max(0, wordIndex), text.length - 1);

  let start = 0;
  for (let i = index; i >= 0; i--) {
    if (isSentenceBoundary(text, i)) {
      start = i + 1;
      break;
    }
  }

  let end = text.length;
  for (let i = index; i < text.length; i++) {
    if (isSentenceBoundary(text, i)) {
      end = i + 1;
      break;
    }
  }

  return text.slice(start, end).replace(/\s+/g, ' ').trim();
}

export function getWordAt(text: string, index: number): string {
  if (!text) return '';
  let i = Math.min(Math.max(0, index), text.length - 1);
  if (!WORD_CHAR.test(text[i]) && i > 0 && WORD_CHAR.test(text[i - 1])) {
    i -= 1;
  }
  if (!WORD_CHAR.test(text[i])) return '';

  let left = i;
  while (left > 0 && WORD_CHAR.test(text[left - 1])) left--;
  let right = i + 1;
  while (right < text.length && WORD_CHAR.test(text[right])) right++;

  return text
    .slice(left, right)
    .toLowerCase()
    .replace(/[’]/g, "'")
    .replace(/^[^a-z0-9]+|[^a-z0-9]+$/g, '');
}

export function normalizePhrase(text: string): string {
  return text
    .replace(/\s+/g, ' ')
    .replace(/[’]/g, "'")
    .trim()
    .replace(/^[^A-Za-z0-9]+|[^A-Za-z0-9]+$/g, '');
}
