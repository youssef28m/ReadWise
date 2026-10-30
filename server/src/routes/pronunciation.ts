import { Router } from "express";
import { z } from "zod";
import { synthesizeSpeech, type SpeechAudio } from "../services/tts.js";

const router = Router();
const SpeechSchema = z.object({ word: z.string().trim().min(1).max(1000) });
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;
const CACHE_MAX_ENTRIES = 200;
const US_AUDIO = /(?:^|[-_])us(?:[-_.]|$)/i;
const UK_AUDIO = /(?:^|[-_])(?:uk|gb)(?:[-_.]|$)/i;

type DictionaryEntry = {
  phonetics?: Array<{ audio?: string }>;
};

type CachedSpeech = SpeechAudio & {
  createdAt: number;
};

const cache = new Map<string, CachedSpeech>();

async function fetchDictionaryRecording(word: string): Promise<Buffer | null> {
  const entryResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
  if (!entryResponse.ok) return null;
  const entries = (await entryResponse.json()) as DictionaryEntry[];
  const audioUrls = entries
    .flatMap((entry) => entry.phonetics ?? [])
    .map((phonetic) => phonetic.audio ?? "")
    .filter(Boolean);
  const audioUrl =
    audioUrls.find((url) => US_AUDIO.test(url)) ??
    audioUrls.find((url) => UK_AUDIO.test(url)) ??
    audioUrls[0];
  if (!audioUrl) return null;
  const sourceUrl = audioUrl.startsWith("//") ? `https:${audioUrl}` : audioUrl;
  const audioResponse = await fetch(sourceUrl);
  if (!audioResponse.ok) return null;
  return Buffer.from(await audioResponse.arrayBuffer());
}

function remember(key: string, speech: SpeechAudio) {
  if (cache.size >= CACHE_MAX_ENTRIES) {
    const oldest = cache.keys().next().value;
    if (oldest) cache.delete(oldest);
  }
  cache.set(key, { ...speech, createdAt: Date.now() });
}

router.post("/", async (req, res, next) => {
  try {
    const parsed = SpeechSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body", message: "A word or sentence is required." });
    const text = parsed.data.word;
    const key = text.toLowerCase();
    const cached = cache.get(key);
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      res.set({ "Content-Type": cached.contentType, "Cache-Control": "private, max-age=86400" });
      return res.send(cached.audio);
    }

    let speech: SpeechAudio | null = null;
    if (!/\s/.test(text)) {
      const recording = await fetchDictionaryRecording(text).catch(() => null);
      if (recording) speech = { audio: recording, contentType: "audio/mpeg" };
    }
    if (!speech) speech = await synthesizeSpeech(text);
    if (!speech) {
      return res.status(502).json({ error: "speech_unavailable", message: "The free pronunciation recording could not be played right now." });
    }

    remember(key, speech);
    res.set({ "Content-Type": speech.contentType, "Cache-Control": "private, max-age=86400" });
    return res.send(speech.audio);
  } catch (error) {
    next(error);
  }
});

export default router;
