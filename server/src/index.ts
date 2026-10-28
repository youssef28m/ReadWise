import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";
import express from "express";
import cors from "cors";
import lookupRouter from "./routes/lookup.js";
import vocabRouter from "./routes/vocab.js";
import pronunciationRouter from "./routes/pronunciation.js";
import { errorHandler } from "./middleware/error.js";
import { hasGroqKey } from "./services/groq.js";

const here = path.dirname(fileURLToPath(import.meta.url));
dotenv.config({ path: [path.resolve(here, "../../.env"), path.resolve(here, "../.env")] });

const app = express();
const port = Number(process.env.PORT) || 3000;
const origin = process.env.CLIENT_ORIGIN || "http://localhost:5173";

app.use(cors({ origin }));
app.use(express.json({ limit: "1mb" }));

app.get("/health", (_req, res) => {
  res.json({ ok: true, groqConfigured: hasGroqKey() });
});
app.use("/lookup", lookupRouter);
app.use("/vocab", vocabRouter);
app.use("/pronunciation", pronunciationRouter);

app.use(errorHandler);

app.listen(port, () => {
  console.log(`API ready on http://localhost:${port}`);
  if (!hasGroqKey()) {
    console.warn("GROQ_API_KEY is not set. /lookup will return 503 until you add it to .env.");
  }
});
