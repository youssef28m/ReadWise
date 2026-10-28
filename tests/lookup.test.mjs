import { test } from 'node:test';
import assert from 'node:assert';
import { LookupBodySchema } from '../server/src/routes/lookup.ts';

test('accepts a valid lookup body and defaults targetLang', () => {
  const parsed = LookupBodySchema.parse({ word: 'serendipity', sentence: 'It was serendipity.' });
  assert.equal(parsed.targetLang, 'ar');
});

test('accepts a phrase and a custom language', () => {
  const parsed = LookupBodySchema.parse({
    word: 'give up',
    sentence: 'He refused to give up.',
    targetLang: 'fr'
  });
  assert.equal(parsed.word, 'give up');
  assert.equal(parsed.targetLang, 'fr');
});

test('rejects empty word or sentence', () => {
  assert.equal(LookupBodySchema.safeParse({ word: '', sentence: 'Hi.' }).success, false);
  assert.equal(LookupBodySchema.safeParse({ word: 'hi', sentence: '   ' }).success, false);
});

test('rejects an oversized sentence', () => {
  const result = LookupBodySchema.safeParse({ word: 'hi', sentence: 'a'.repeat(2001) });
  assert.equal(result.success, false);
});
