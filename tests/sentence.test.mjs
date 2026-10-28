import { test } from 'node:test';
import assert from 'node:assert';
import { extractSentenceFromText, getWordAt, normalizePhrase } from '../client/src/utils/sentence.ts';

test('extracts a sentence around a word', () => {
  const text = 'I like cats. They are nice.';
  const sentence = extractSentenceFromText(text, text.indexOf('cats'));
  assert.equal(sentence, 'I like cats.');
});

test('does not split after Mr. or Dr.', () => {
  const text = 'Hello Mr. Smith. Dr. Jones arrived late. We waited.';
  assert.equal(extractSentenceFromText(text, text.indexOf('Smith')), 'Hello Mr. Smith.');
  assert.equal(extractSentenceFromText(text, text.indexOf('Jones')), 'Dr. Jones arrived late.');
});

test('splits sentences whose next word starts lowercase after a line break', () => {
  const text = 'He came first. then he sat down.';
  assert.equal(extractSentenceFromText(text, text.indexOf('first')), 'He came first.');
});

test('handles line breaks and page joins', () => {
  const text = 'He knew that the answer was waiting just beyond\nthe next door. Serendipity had brought him here.';
  const sentence = extractSentenceFromText(text, text.indexOf('next'));
  assert.equal(sentence, 'He knew that the answer was waiting just beyond the next door.');
});

test('extracts the clicked word and strips punctuation', () => {
  assert.equal(getWordAt('A small, quiet room.', 2), 'small');
  assert.equal(getWordAt('A small, quiet room.', 7), 'small');
  assert.equal(getWordAt("don't stop", 2), "don't");
});

test('normalizes selected phrases', () => {
  assert.equal(normalizePhrase('  warm\n smile. '), 'warm smile');
});
