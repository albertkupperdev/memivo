import { createClient } from "@/lib/supabase/server";
import { groq, AI_MODEL } from "@/lib/ai";
import { buildCardGenerationPrompt, buildVocabularyPrompt } from "@/lib/prompts";

export const maxDuration = 60;

const MAX_CHUNKS_STANDARD = 10;
const MAX_CHUNKS_VOCABULARY = 60;
const CONCURRENCY_STANDARD = 5;
const CONCURRENCY_VOCABULARY = 3;
const REQUEST_TIMEOUT_MS = 8_000;

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

async function generateCardsForChunk(
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
        max_tokens: contentType === "vocabulary" ? 2048 : 512,
      },
      { signal: controller.signal }
    );
    clearTimeout(timer);

    const raw = completion.choices[0]?.message?.content ?? "";
    let parsed: { front: string; back: string; hint?: string }[];
    try {
      parsed = JSON.parse(raw);
    } catch {
      const match = raw.match(/\[[\s\S]*\]/);
      if (!match) return [];
      parsed = JSON.parse(match[0]);
    }

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
  items: T[],
  concurrency: number,
  fn: (item: T) => Promise<R>,
  onEach: (done: number) => void
): Promise<R[]> {
  const results: R[] = new Array(items.length);
  let next = 0;
  let done = 0;

  async function worker() {
    while (next < items.length) {
      const i = next++;
      results[i] = await fn(items[i]);
      done++;
      onEach(done);
    }
  }

  await Promise.all(Array.from({ length: Math.min(concurrency, items.length) }, worker));
  return results;
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { documentId } = await request.json();
  if (!documentId) return new Response(JSON.stringify({ error: "documentId is required" }), { status: 400 });

  const { data: document } = await supabase.from("documents").select("id, user_id, content_type").eq("id", documentId).single();
  if (!document || document.user_id !== user.id) {
    return new Response(JSON.stringify({ error: "Document not found" }), { status: 404 });
  }
  const contentType: string = document.content_type ?? "standard";

  const { data: allChunks, error: chunksError } = await supabase
    .from("chunks").select("id, content").eq("document_id", documentId).order("chunk_index");
  if (chunksError || !allChunks || allChunks.length === 0) {
    return new Response(JSON.stringify({ error: "No chunks found" }), { status: 404 });
  }

  const isVocab = contentType === "vocabulary";
  const contentChunks = allChunks.filter((c) => !isBoilerplate(c.content));
  const chunks = sampleChunks(contentChunks, isVocab ? MAX_CHUNKS_VOCABULARY : MAX_CHUNKS_STANDARD);
  const concurrency = isVocab ? CONCURRENCY_VOCABULARY : CONCURRENCY_STANDARD;
  const total = chunks.length;

  const encoder = new TextEncoder();

  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) =>
        controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));

      send({ progress: 0, total });

      const cardResults = await withConcurrency(
        chunks,
        concurrency,
        (c) => generateCardsForChunk(c, documentId, contentType),
        (done) => send({ progress: done, total })
      );

      const allCards = cardResults.flat();

      if (allCards.length === 0) {
        send({ error: "Failed to generate any cards" });
        controller.close();
        return;
      }

      const { data: savedCards, error: saveError } = await supabase
        .from("cards").insert(allCards).select();

      if (saveError || !savedCards) {
        send({ error: "Failed to save cards" });
      } else {
        send({ done: true, cards: savedCards });
      }

      controller.close();
    },
  });

  return new Response(stream, {
    headers: {
      "Content-Type": "text/event-stream",
      "Cache-Control": "no-cache",
      "Connection": "keep-alive",
      "X-Accel-Buffering": "no",
    },
  });
}
