import { groq, AI_MODEL } from "@/lib/ai";
import { buildCardGenerationPrompt } from "@/lib/prompts";

const MAX_CHUNKS = 15;
const CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 10_000;
const MAX_RETRIES = 1;

function isBoilerplate(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    text.includes("©") ||
    lower.includes("alle rechte vorbehalten") ||
    lower.includes("all rights reserved") ||
    lower.includes("urheberrechtlich") ||
    lower.includes("fernstudienzentrum") ||
    lower.includes("studienteilnehmer") ||
    lower.includes("wir wünschen ihnen") ||
    lower.includes("vorbemerkungen") ||
    lower.includes("schlusswort") ||
    (text.match(/\.{5,}/g) ?? []).length >= 3
  );
}

function sampleChunks<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)]);
}

async function generateForChunk(
  chunk: { id: string; content: string },
  documentId: string
): Promise<{ document_id: string; chunk_id: string; front: string; back: string; hint: string | null }[]> {
  for (let attempt = 0; attempt <= MAX_RETRIES; attempt++) {
    try {
      const completion = await groq.chat.completions.create(
        {
          model: AI_MODEL,
          messages: [{ role: "user", content: buildCardGenerationPrompt(chunk.content) }],
          temperature: 0.3,
          max_tokens: 512,
        },
        { timeout: REQUEST_TIMEOUT_MS }
      );
      const raw = completion.choices[0]?.message?.content ?? "";
      let parsed: { front: string; back: string; hint?: string }[];
      try { parsed = JSON.parse(raw); }
      catch { const m = raw.match(/\[[\s\S]*\]/); if (!m) return []; parsed = JSON.parse(m[0]); }
      if (!Array.isArray(parsed)) return [];
      return parsed
        .filter((c) => typeof c.front === "string" && typeof c.back === "string")
        .map((c) => ({ document_id: documentId, chunk_id: chunk.id, front: c.front.trim(), back: c.back.trim(), hint: c.hint?.trim() ?? null }));
    } catch (err) {
      const status = (err as { status?: number })?.status;
      if (status === 429 && attempt < MAX_RETRIES) {
        await new Promise(res => setTimeout(res, 500));
        continue;
      }
      return [];
    }
  }
  return [];
}

async function withConcurrency<T, R>(
  items: T[], concurrency: number, fn: (item: T) => Promise<R>, onEach: (done: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0; let done = 0;
  async function worker() {
    while (next < items.length) { const i = next++; results[i] = await fn(items[i]); done++; onEach(done); }
  }
  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function generateCardsFromChunks(
  allChunks: { id: string; content: string }[],
  documentId: string,
  send: (obj: object) => void
) {
  const contentChunks = allChunks.filter((c) => !isBoilerplate(c.content));
  const chunks = sampleChunks(contentChunks, MAX_CHUNKS);
  const total = chunks.length;
  send({ progress: 0, total });

  const results = await withConcurrency(
    chunks, CONCURRENCY,
    (c) => generateForChunk(c, documentId),
    (done) => send({ progress: done, total })
  );

  return results.flat();
}
