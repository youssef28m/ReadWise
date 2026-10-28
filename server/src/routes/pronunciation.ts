import { Router } from "express";
import { z } from "zod";

const router = Router();
const SpeechSchema = z.object({ word: z.string().trim().min(1).max(120) });
const cache = new Map<string, { audio: Buffer; createdAt: number }>();
const CACHE_TTL_MS = 24 * 60 * 60 * 1000;

type DictionaryEntry = {
  phonetics?: Array<{ audio?: string }>;
};

router.post("/", async (req, res, next) => {
  try {
    const parsed = SpeechSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body", message: "A word is required." });
    const word = parsed.data.word;
    const key = word.toLowerCase();
    const cached = cache.get(key);
    let audio: Buffer;
    if (cached && Date.now() - cached.createdAt < CACHE_TTL_MS) {
      audio = cached.audio;
    } else {
      const entryResponse = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encodeURIComponent(word)}`);
      if (!entryResponse.ok) {
        return res.status(404).json({ error: "pronunciation_not_found", message: "No free pronunciation recording was found for this word." });
      }
      const entries = (await entryResponse.json()) as DictionaryEntry[];
      const audioUrls = entries
        .flatMap((entry) => entry.phonetics ?? [])
        .map((phonetic) => phonetic.audio ?? "")
        .filter(Boolean);
      const audioUrl = audioUrls.find((url) => /(?:-|_)us(?:_|\.|-)/i.test(url)) ?? audioUrls[0];
      if (!audioUrl) {
        return res.status(404).json({ error: "pronunciation_not_found", message: "No free pronunciation recording was found for this word." });
      }
      const sourceUrl = audioUrl.startsWith("//") ? `https:${audioUrl}` : audioUrl;
      let audioResponse = await fetch(sourceUrl);
      if (!audioResponse.ok) {
        const fallbackUrl = new URL("https://translate.google.com/translate_tts");
        fallbackUrl.searchParams.set("ie", "UTF-8");
        fallbackUrl.searchParams.set("client", "tw-ob");
        fallbackUrl.searchParams.set("tl", "en-US");
        fallbackUrl.searchParams.set("q", word);
        audioResponse = await fetch(fallbackUrl);
      }
      if (!audioResponse.ok) {
        return res.status(502).json({ error: "speech_unavailable", message: "The free pronunciation recording could not be played right now." });
      }
      audio = Buffer.from(await audioResponse.arrayBuffer());
      cache.set(key, { audio, createdAt: Date.now() });
    }

    res.set({ "Content-Type": "audio/mpeg", "Cache-Control": "private, max-age=86400" });
    return res.send(audio);
  } catch (error) {
    next(error);
  }
});

export default router;
