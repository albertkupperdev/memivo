import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { groq, AI_MODEL } from "@/lib/ai";
import { buildCardGenerationPrompt } from "@/lib/prompts";

export const maxDuration = 300;

const MAX_CHUNKS = 40;
const DELAY_MS = 800;

function isBoilerplate(text: string): boolean {
  const lower = text.toLowerCase();
  return (
    text.includes("©") ||
    lower.includes("alle rechte vorbehalten") ||
    lower.includes("all rights reserved") ||
    lower.includes("urheberrechtlich") ||
    lower.includes("fernstudienzentrum") ||
    (text.match(/\.{5,}/g) ?? []).length >= 3
  );
}

function sampleChunks<T>(arr: T[], max: number): T[] {
  if (arr.length <= max) return arr;
  const step = arr.length / max;
  return Array.from({ length: max }, (_, i) => arr[Math.floor(i * step)]);
}

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { documentId } = await request.json();

  if (!documentId) {
    return NextResponse.json({ error: "documentId is required" }, { status: 400 });
  }

  const { data: document } = await supabase
    .from("documents")
    .select("id, user_id")
    .eq("id", documentId)
    .single();

  if (!document || document.user_id !== user.id) {
    return NextResponse.json({ error: "Document not found" }, { status: 404 });
  }

  const { data: allChunks, error: chunksError } = await supabase
    .from("chunks")
    .select("id, content")
    .eq("document_id", documentId)
    .order("chunk_index");

  if (chunksError || !allChunks || allChunks.length === 0) {
    return NextResponse.json({ error: "No chunks found for this document" }, { status: 404 });
  }

  const contentChunks = allChunks.filter((c) => !isBoilerplate(c.content));
  const chunks = sampleChunks(contentChunks, MAX_CHUNKS);

  console.log(`[generate] ${allChunks.length} total → ${contentChunks.length} after boilerplate filter → ${chunks.length} sampled`);

  const allCards: { document_id: string; chunk_id: string; front: string; back: string }[] = [];
  const errors: string[] = [];

  for (const chunk of chunks) {
    try {
      let completion;
      for (let attempt = 0; attempt < 3; attempt++) {
        try {
          completion = await groq.chat.completions.create({
            model: AI_MODEL,
            messages: [{ role: "user", content: buildCardGenerationPrompt(chunk.content) }],
            temperature: 0.3,
            max_tokens: 1024,
          });
          break;
        } catch (err) {
          const msg = err instanceof Error ? err.message : String(err);
          if (msg.includes("429") && attempt < 2) {
            await new Promise((r) => setTimeout(r, 3000 * (attempt + 1)));
          } else throw err;
        }
      }
      if (!completion) continue;

      const raw = completion.choices[0]?.message?.content ?? "";

      let parsed: { front: string; back: string }[];
      try {
        parsed = JSON.parse(raw);
      } catch {
        const match = raw.match(/\[[\s\S]*\]/);
        if (!match) { errors.push(`parse_fail: ${raw.slice(0, 100)}`); continue; }
        parsed = JSON.parse(match[0]);
      }

      if (!Array.isArray(parsed)) continue;

      for (const card of parsed) {
        if (typeof card.front === "string" && typeof card.back === "string") {
          allCards.push({
            document_id: documentId,
            chunk_id: chunk.id,
            front: card.front.trim(),
            back: card.back.trim(),
          });
        }
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : String(err);
      console.error("[generate] chunk error:", msg);
      errors.push(msg);
    }

    await new Promise((r) => setTimeout(r, DELAY_MS));
  }

  if (allCards.length === 0) {
    console.error("[generate] no cards produced. errors:", JSON.stringify(errors));
    return NextResponse.json({ error: "Failed to generate any cards", debug: errors }, { status: 500 });
  }

  const { data: savedCards, error: saveError } = await supabase
    .from("cards")
    .insert(allCards)
    .select();

  if (saveError || !savedCards) {
    return NextResponse.json({ error: "Failed to save cards" }, { status: 500 });
  }

  return NextResponse.json({ cards: savedCards });
}
