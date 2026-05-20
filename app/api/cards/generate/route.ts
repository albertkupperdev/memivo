import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { groq, AI_MODEL } from "@/lib/ai";
import { buildCardGenerationPrompt } from "@/lib/prompts";

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

  const { data: chunks, error: chunksError } = await supabase
    .from("chunks")
    .select("id, content")
    .eq("document_id", documentId)
    .order("chunk_index");

  if (chunksError || !chunks || chunks.length === 0) {
    return NextResponse.json({ error: "No chunks found for this document" }, { status: 404 });
  }

  const allCards: { document_id: string; chunk_id: string; front: string; back: string }[] = [];
  const errors: string[] = [];

  console.log(`[generate] processing ${chunks.length} chunks`);

  for (const chunk of chunks) {
    if (isBoilerplate(chunk.content)) { console.log("[generate] skipped boilerplate chunk"); continue; }

    try {
      const completion = await groq.chat.completions.create({
        model: AI_MODEL,
        messages: [
          {
            role: "user",
            content: buildCardGenerationPrompt(chunk.content),
          },
        ],
        temperature: 0.3,
        max_tokens: 1024,
      });

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
      continue;
    }
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
