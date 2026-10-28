import Groq from "groq-sdk";
import { z } from "zod";

export const LookupResultSchema = z.object({
  meaning: z.string().min(1),
  translation: z.string().min(1),
  partOfSpeech: z.string().optional().default(""),
  note: z.string().optional().default("")
});

export type LookupResult = z.infer<typeof LookupResultSchema>;

export class ProviderError extends Error {
  constructor(
    public kind: "missing_key" | "auth" | "rate_limit" | "malformed" | "model" | "unknown",
    message: string
  ) {
    super(message);
    this.name = "ProviderError";
  }
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

export function hasGroqKey(): boolean {
  const key = process.env.GROQ_API_KEY?.trim();
  return Boolean(key);
}

export async function lookupWithGroq(
  word: string,
  sentence: string,
  targetLang: string
): Promise<LookupResult> {
  const apiKey = process.env.GROQ_API_KEY?.trim();
  if (!apiKey) {
    throw new ProviderError("missing_key", "GROQ_API_KEY is not set on the server.");
  }

  const groq = new Groq({ apiKey });
  const model = process.env.GROQ_MODEL?.trim() || "openai/gpt-oss-20b";

  const system = [
    "You are a precise dictionary assistant for English learners.",
    `Given a word or phrase and the sentence it appears in, explain it in the context of THAT sentence.`,
    "Return ONLY a JSON object with exactly these keys:",
    `  "meaning": simple English definition that fits this sentence (1-2 sentences, easy words),`,
    `  "translation": the meaning translated into the language with ISO code "${targetLang}" (native script),`,
    `  "partOfSpeech": noun/verb/adjective/adverb/phrase/idiom/etc.,`,
    `  "note": for a phrasal verb or idiom, a short usage tip (for example, how it is followed or when it is used); otherwise an empty string.`,
    'Example: {"meaning":"...","translation":"...","partOfSpeech":"noun","note":""}'
  ].join("\n");

  const user = JSON.stringify({ word, sentence, targetLang });

  async function callOnce(): Promise<LookupResult> {
    let response;
    try {
      response = await groq.chat.completions.create({
        model,
        messages: [
          { role: "system", content: system },
          { role: "user", content: user }
        ],
        temperature: 0.2,
        max_tokens: 1200,
        response_format: { type: "json_object" }
      });
    } catch (error: unknown) {
      const status = (error as { status?: number }).status;
      const providerCode = (error as { error?: { code?: string } }).error?.code;
      if (status === 429) {
        throw new ProviderError("rate_limit", "Groq rate limit reached.");
      }
      if (status === 401 || status === 403) {
        throw new ProviderError("auth", "Groq rejected the API key.");
      }
      if (status === 404 || providerCode === "model_not_found") {
        throw new ProviderError("model", "The configured Groq model is unavailable.");
      }
      if (providerCode === "json_validate_failed") {
        throw new ProviderError("malformed", "Groq returned malformed JSON.");
      }
      throw error;
    }

    const content = response.choices[0]?.message?.content ?? "";
    try {
      return LookupResultSchema.parse(JSON.parse(content));
    } catch {
      throw new ProviderError("malformed", "Groq returned malformed JSON.");
    }
  }

  let lastError: unknown;
  for (let attempt = 0; attempt < 6; attempt++) {
    try {
      return await callOnce();
    } catch (error) {
      lastError = error;
      if (error instanceof ProviderError) {
        if (error.kind === "rate_limit" && attempt < 5) {
          await sleep(800 * 2 ** attempt);
          continue;
        }
        if (error.kind === "malformed" && attempt === 0) {
          continue;
        }
        throw error;
      }
      throw error;
    }
  }
  throw lastError;
}
