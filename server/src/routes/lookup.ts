import { Router } from "express";
import { z } from "zod";
import rateLimit from "express-rate-limit";
import { PrismaClient } from "@prisma/client";
import { sentenceHash } from "../utils/hash.js";
import { lookupWithGroq, ProviderError } from "../services/groq.js";

const router = Router();
const prisma = new PrismaClient();

const limiter = rateLimit({
  windowMs: 60 * 1000,
  max: 30,
  standardHeaders: true,
  legacyHeaders: false,
  message: { error: "rate_limited", message: "Too many requests. Wait a minute and try again." }
});

export const LookupBodySchema = z.object({
  word: z.string().trim().min(1).max(120),
  sentence: z.string().trim().min(1).max(2000),
  targetLang: z.string().trim().min(2).max(10).default("ar")
});

function normalizeWord(word: string): string {
  return word
    .toLowerCase()
    .replace(/[^a-z0-9'’\-\s]/g, " ")
    .replace(/[’]/g, "'")
    .replace(/\s+/g, " ")
    .trim();
}

router.post("/", limiter, async (req, res, next) => {
  try {
    const parsed = LookupBodySchema.safeParse(req.body);
    if (!parsed.success) {
      return res.status(400).json({
        error: "invalid_body",
        message: "Word, sentence and target language are required.",
        details: parsed.error.flatten()
      });
    }

    const { sentence, targetLang } = parsed.data;
    const word = normalizeWord(parsed.data.word);
    if (!word) {
      return res.status(400).json({ error: "invalid_body", message: "That selection has no English word." });
    }

    const sHash = sentenceHash(sentence.trim());

    const cached = await prisma.lookup.findUnique({
      where: { word_sentenceHash_targetLang: { word, sentenceHash: sHash, targetLang } }
    });
    if (cached) {
      return res.json({ ...(cached.result as Record<string, unknown>), cached: true });
    }

    try {
      const result = await lookupWithGroq(word, sentence, targetLang);
      await prisma.lookup.upsert({
        where: { word_sentenceHash_targetLang: { word, sentenceHash: sHash, targetLang } },
        update: { result },
        create: { word, sentenceHash: sHash, targetLang, result }
      });
      return res.json(result);
    } catch (error) {
      if (error instanceof ProviderError) {
        if (error.kind === "rate_limit") {
          return res.status(429).json({
            error: "rate_limited",
            message: "Groq is rate limiting us right now. Try again in a moment."
          });
        }
        if (error.kind === "missing_key") {
          return res.status(503).json({
            error: "missing_key",
            message: "The server has no GROQ_API_KEY. Add it to .env and restart."
          });
        }
        if (error.kind === "auth") {
          return res.status(502).json({
            error: "provider_auth",
            message: "Groq rejected the API key. Check GROQ_API_KEY in .env and restart the server."
          });
        }
        if (error.kind === "model") {
          return res.status(503).json({
            error: "model_unavailable",
            message: "The configured GROQ_MODEL is not available for this key. Change it in .env and restart."
          });
        }
        if (error.kind === "malformed") {
          return res.status(502).json({
            error: "provider_error",
            message: "The AI returned an unreadable answer. Please try again."
          });
        }
      }
      return next(error);
    }
  } catch (error) {
    next(error);
  }
});

export default router;
