import crypto from "node:crypto";

export function sentenceHash(s: string): string {
  return crypto.createHash("sha256").update(s).digest("hex");
}
