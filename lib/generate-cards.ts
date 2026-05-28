import { groq, AI_MODEL } from "@/lib/ai";
import { buildCardGenerationPrompt, buildVocabularyPrompt } from "@/lib/prompts";

const MAX_CHUNKS_STANDARD = 10;
const VOCAB_MERGE_SIZE = 1;
const CONCURRENCY = 5;
const REQUEST_TIMEOUT_MS = 10_000;

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

function mergeChunksForVocab(chunks: { id: string; content: string }[]): { id: string; content: string }[] {
  const merged: { id: string; content: string }[] = [];
  for (let i = 0; i < chunks.length; i += VOCAB_MERGE_SIZE) {
    const batch = chunks.slice(i, i + VOCAB_MERGE_SIZE);
    merged.push({ id: batch[0].id, content: batch.map(c => c.content).join('\n\n') });
  }
  return merged;
}

async function generateForChunk(
  chunk: { id: string; content: string },
  documentId: string,
  contentType: string
): Promise<{ document_id: string; chunk_id: string; front: string; back: string; hint: string | null }[]> {
  const prompt = contentType === "vocabulary"
    ? buildVocabularyPrompt(chunk.content)
    : buildCardGenerationPrompt(chunk.content);
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), REQUEST_TIMEOUT_MS);
  try {
    const completion = await groq.chat.completions.create(
      {
        model: AI_MODEL,
        messages: [{ role: "user", content: prompt }],
        temperature: 0.3,
        max_tokens: contentType === "vocabulary" ? 4096 : 512,
      },
      { signal: controller.signal }
    );
    clearTimeout(timer);
    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: { front: string; back: string; hint?: string }[];
    try { parsed = JSON.parse(raw); }
    catch { const m = raw.match(/\[[\s\S]*\]/); if (!m) return []; parsed = JSON.parse(m[0]); }
    if (!Array.isArray(parsed)) return [];
    return parsed
      .filter((c) => typeof c.front === "string" && typeof c.back === "string")
      .map((c) => ({ document_id: documentId, chunk_id: chunk.id, front: c.front.trim(), back: c.back.trim(), hint: c.hint?.trim() ?? null }));
  } catch {
    clearTimeout(timer);
    return [];
  }
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
  send: (obj: object) => void,
  contentType = "standard"
) {
  const isVocab = contentType === "vocabulary";
  const contentChunks = isVocab ? allChunks : allChunks.filter((c) => !isBoilerplate(c.content));
  const chunks = isVocab
    ? mergeChunksForVocab(contentChunks)
    : sampleChunks(contentChunks, MAX_CHUNKS_STANDARD);
  const total = chunks.length;
  send({ progress: 0, total });

  const results = await withConcurrency(
    chunks, CONCURRENCY,
    (c) => generateForChunk(c, documentId, contentType),
    (done) => send({ progress: done, total })
  );

  return results.flat();
}
