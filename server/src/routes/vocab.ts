import { Router } from "express";
import { z } from "zod";
import { Prisma, PrismaClient, type SavedWord } from "@prisma/client";

const router = Router();
const prisma = new PrismaClient();

const SaveSchema = z.object({
  word: z.string().trim().min(1),
  meaning: z.string().min(1),
  translation: z.string().min(1),
  sentence: z.string().min(1),
  bookId: z.string().min(1).max(200).optional(),
  bookName: z.string().min(1).max(300).optional(),
  page: z.number().int().min(1).optional()
});

const ReviewSchema = z.object({
  rating: z.enum(["again", "hard", "good", "easy", "learned"])
});

const UndoSchema = z.object({
  logId: z.string().min(1)
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

async function getDueCounts(now: Date) {
  const dueWhere = { nextReviewAt: { lte: now } };
  const [dueCount, newCount, learningCount, reviewCount] = await Promise.all([
    prisma.savedWord.count({ where: dueWhere }),
    prisma.savedWord.count({ where: { ...dueWhere, repetition: 0 } }),
    prisma.savedWord.count({ where: { ...dueWhere, repetition: { gt: 0 }, intervalDays: { lte: 7 } } }),
    prisma.savedWord.count({ where: { ...dueWhere, intervalDays: { gt: 7 } } })
  ]);
  return { dueCount, counts: { new: newCount, learning: learningCount, review: reviewCount } };
}

function wordSnapshot(word: SavedWord): Prisma.InputJsonValue {
  return {
    ...word,
    createdAt: word.createdAt.toISOString(),
    nextReviewAt: word.nextReviewAt.toISOString(),
    lastReviewedAt: word.lastReviewedAt?.toISOString() ?? null
  } as Prisma.InputJsonValue;
}

router.post("/", async (req, res, next) => {
  try {
    const parsed = SaveSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body" });
    const existing = await prisma.savedWord.findFirst({
      where: { word: { equals: parsed.data.word, mode: "insensitive" } },
      orderBy: { createdAt: "asc" }
    });
    if (existing) return res.json(existing);
    const created = await prisma.savedWord.create({ data: parsed.data });
    res.json(created);
  } catch (e) {
    next(e);
  }
});

router.get("/saved", async (req, res, next) => {
  try {
    const word = typeof req.query.word === "string" ? req.query.word.trim() : "";
    if (!word) return res.status(400).json({ error: "invalid_body" });
    const existing = await prisma.savedWord.findFirst({
      where: { word: { equals: word, mode: "insensitive" } },
      select: { id: true }
    });
    res.json({ saved: Boolean(existing) });
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
    const [items, { dueCount, counts }] = await Promise.all([
      prisma.savedWord.findMany({ where: { nextReviewAt: { lte: now } }, orderBy: [{ nextReviewAt: "asc" }, { createdAt: "asc" }], take: 50 }),
      getDueCounts(now)
    ]);
    res.json({ items, dueCount, counts });
  } catch (e) {
    next(e);
  }
});

router.post("/review/undo", async (req, res, next) => {
  try {
    const parsed = UndoSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body" });
    const log = await prisma.reviewLog.findUnique({ where: { id: parsed.data.logId } });
    if (!log) return res.status(404).json({ error: "not_found" });

    const snapshot = log.previous as Record<string, unknown>;
    const data = {
      word: String(snapshot.word),
      meaning: String(snapshot.meaning),
      translation: String(snapshot.translation),
      sentence: String(snapshot.sentence),
      bookId: typeof snapshot.bookId === "string" ? snapshot.bookId : null,
      bookName: typeof snapshot.bookName === "string" ? snapshot.bookName : null,
      page: typeof snapshot.page === "number" ? snapshot.page : null,
      createdAt: new Date(String(snapshot.createdAt)),
      nextReviewAt: new Date(String(snapshot.nextReviewAt)),
      lastReviewedAt: typeof snapshot.lastReviewedAt === "string" ? new Date(snapshot.lastReviewedAt) : null,
      repetition: Number(snapshot.repetition),
      intervalDays: Number(snapshot.intervalDays),
      easeFactor: Number(snapshot.easeFactor)
    };

    const restored = await prisma.$transaction(async (tx) => {
      const word = await tx.savedWord.upsert({
        where: { id: log.wordId },
        update: data,
        create: { id: log.wordId, ...data }
      });
      await tx.reviewLog.delete({ where: { id: log.id } });
      return word;
    });

    const { dueCount, counts } = await getDueCounts(new Date());
    res.json({ word: restored, dueCount, counts });
  } catch (e) {
    next(e);
  }
});

router.post("/:id/review", async (req, res, next) => {
  try {
    const parsed = ReviewSchema.safeParse(req.body);
    if (!parsed.success) return res.status(400).json({ error: "invalid_body" });

    const word = await prisma.savedWord.findUnique({ where: { id: req.params.id } });
    if (!word) return res.status(404).json({ error: "not_found" });

    const rating = parsed.data.rating;
    const snapshot = wordSnapshot(word);
    const result = await prisma.$transaction(async (tx) => {
      const log = await tx.reviewLog.create({ data: { wordId: word.id, rating, previous: snapshot } });
      if (rating === "learned") {
        await tx.savedWord.delete({ where: { id: word.id } });
        return { log, word: null };
      }
      const schedule = reviewSchedule(word, rating);
      const updated = await tx.savedWord.update({
        where: { id: word.id },
        data: { ...schedule, lastReviewedAt: new Date() }
      });
      return { log, word: updated };
    });

    const { dueCount, counts } = await getDueCounts(new Date());
    if (!result.word) return res.json({ learned: true, logId: result.log.id, dueCount, counts });
    return res.json({ ...result.word, logId: result.log.id, dueCount, counts });
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
