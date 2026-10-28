import { Router } from "express";
import { z } from "zod";
import { PrismaClient } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

const SaveSchema = z.object({
  word: z.string().min(1),
  meaning: z.string().min(1),
  translation: z.string().min(1),
  sentence: z.string().min(1)
});

const ReviewSchema = z.object({
  rating: z.enum(["again", "hard", "good", "easy", "learned"])
});

function addDays(date: Date, days: number): Date {
  return new Date(date.getTime() + days * 24 * 60 * 60 * 1000);
}

function reviewSchedule(word: { repetition: number; intervalDays: number; easeFactor: number }, rating: "again" | "hard" | "good" | "easy") {
  const now = new Date();
  if (rating === "again") {
    return { repetition: 0, intervalDays: 0, easeFactor: Math.max(1.3, word.easeFactor - 0.2), nextReviewAt: new Date(now.getTime() + 10 * 60 * 1000) };
  }

  const repetition = word.repetition + 1;
  const easeFactor = rating === "hard" ? Math.max(1.3, word.easeFactor - 0.15) : rating === "easy" ? word.easeFactor + 0.15 : word.easeFactor;
  const intervalDays = rating === "hard"
    ? Math.max(1, word.intervalDays ? Math.ceil(word.intervalDays * 1.2) : 1)
    : rating === "easy"
      ? word.repetition === 0 ? 4 : Math.max(2, Math.ceil(word.intervalDays * easeFactor * 1.3))
      : word.repetition === 0 ? 1 : Math.max(1, Math.ceil(word.intervalDays * easeFactor));

  return { repetition, intervalDays, easeFactor, nextReviewAt: addDays(now, intervalDays) };
}

router.post("/", async (req, res, next) => {
  try {
    const parsed = SaveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body" });
    const created = await prisma.savedWord.create({ data: parsed.data });
    res.json(created);
  } catch (e) {
    next(e);
  }
});

router.get("/", async (req, res, next) => {
  try {
    const q = typeof req.query.q === "string" ? req.query.q.toLowerCase() : "";
    const items = await prisma.savedWord.findMany({ orderBy: { createdAt: "desc" } });
    const filtered = q
      ? items.filter((i) => i.word.toLowerCase().includes(q) || i.translation.toLowerCase().includes(q))
      : items;
    res.json(filtered);
  } catch (e) {
    next(e);
  }
});

router.get("/review/due", async (_req, res, next) => {
  try {
    const now = new Date();
    const dueWhere = { nextReviewAt: { lte: now } };
    const [items, dueCount, newCount, learningCount, reviewCount] = await Promise.all([
      prisma.savedWord.findMany({ where: { nextReviewAt: { lte: now } }, orderBy: [{ nextReviewAt: "asc" }, { createdAt: "asc" }], take: 50 }),
      prisma.savedWord.count({ where: { nextReviewAt: { lte: now } } }),
      prisma.savedWord.count({ where: { ...dueWhere, repetition: 0 } }),
      prisma.savedWord.count({ where: { ...dueWhere, repetition: { gt: 0 }, intervalDays: { lte: 7 } } }),
      prisma.savedWord.count({ where: { ...dueWhere, intervalDays: { gt: 7 } } })
    ]);
    res.json({ items, dueCount, counts: { new: newCount, learning: learningCount, review: reviewCount } });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/review", async (req, res, next) => {
  try {
    const parsed = ReviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body" });
    if (parsed.data.rating === "learned") {
      await prisma.savedWord.delete({ where: { id: req.params.id } });
      return res.json({ learned: true });
    }

    const word = await prisma.savedWord.findUnique({ where: { id: req.params.id } });
    if (!word) return res.status(404).json({ error: "not_found" });
    const schedule = reviewSchedule(word, parsed.data.rating);
    const updated = await prisma.savedWord.update({
      where: { id: word.id },
      data: { ...schedule, lastReviewedAt: new Date() }
    });
    return res.json(updated);
  } catch (e) {
    next(e);
  }
});

router.delete("/:id", async (req, res, next) => {
  try {
    await prisma.savedWord.delete({ where: { id: req.params.id } });
    res.json({ ok: true });
  } catch (e) {
    next(e);
  }
});

export default router;
