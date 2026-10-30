import { execFile } from "node:child_process";
import { mkdtemp, readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

export type SpeechAudio = {
  audio: Buffer;
  contentType: string;
};

const TIMEOUT_MS = 20_000;

function run(command: string, args: string[], input: string): Promise<void> {
  return new Promise((resolve, reject) => {
    const child = execFile(command, args, { timeout: TIMEOUT_MS }, (error) => {
      if (error) reject(error);
      else resolve();
    });
    child.stdin?.end(input);
  });
}

async function withOutputFile(synthesize: (output: string) => Promise<void>): Promise<Buffer> {
  const dir = await mkdtemp(path.join(tmpdir(), "tapword-tts-"));
  const output = path.join(dir, "speech.wav");
  try {
    await synthesize(output);
    return await readFile(output);
  } finally {
    await rm(dir, { recursive: true, force: true });
  }
}

async function synthesizeWithPiper(text: string, bin: string, model: string): Promise<Buffer> {
  return withOutputFile(async (output) => {
    await run(bin, ["--model", model, "--output_file", output], text);
  });
}

async function synthesizeWithEspeak(text: string): Promise<Buffer> {
  const bin = process.env.ESPEAK_BIN?.trim() || "espeak-ng";
  return withOutputFile(async (output) => {
    await run(bin, ["-v", "en-us", "-w", output, "--stdin"], text);
  });
}

export async function synthesizeSpeech(text: string): Promise<SpeechAudio | null> {
  const piperModel = process.env.PIPER_MODEL?.trim();
  const piperBin = process.env.PIPER_BIN?.trim() || "piper";
  if (piperModel) {
    try {
      return { audio: await synthesizeWithPiper(text, piperBin, piperModel), contentType: "audio/wav" };
    } catch (error) {
      console.warn("Piper TTS failed, falling back to espeak-ng:", error instanceof Error ? error.message : error);
    }
  }
  try {
    return { audio: await synthesizeWithEspeak(text), contentType: "audio/wav" };
  } catch {
    return null;
  }
}
