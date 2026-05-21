import { createClient } from "@/lib/supabase/server";
import { extractTextFromPDF } from "@/lib/extract";
import { chunkText } from "@/lib/chunker";
import { generateCardsFromChunks } from "@/lib/generate-cards";

export const maxDuration = 60;

export async function POST(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return new Response(JSON.stringify({ error: "Unauthorized" }), { status: 401 });

  const { id: documentId } = await params;

  const { data: doc } = await supabase.from("documents").select("id").eq("id", documentId).eq("user_id", user.id).single();
  if (!doc) return new Response(JSON.stringify({ error: "Not found" }), { status: 404 });

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  if (!file || file.type !== "application/pdf") return new Response(JSON.stringify({ error: "A PDF file is required" }), { status: 400 });

  const buffer = await file.arrayBuffer();
  const text = await extractTextFromPDF(buffer);
  if (!text.trim()) return new Response(JSON.stringify({ error: "Could not extract text from this PDF" }), { status: 422 });

  const chunkTexts = chunkText(text);
  if (chunkTexts.length === 0) return new Response(JSON.stringify({ error: "Document is too short" }), { status: 422 });

  const maxIndex = await supabase.from("chunks").select("chunk_index").eq("document_id", documentId).order("chunk_index", { ascending: false }).limit(1).single();
  const startIndex = (maxIndex.data?.chunk_index ?? -1) + 1;

  const { data: chunks, error: chunkError } = await supabase.from("chunks").insert(
    chunkTexts.map((content, i) => ({ document_id: documentId, content, chunk_index: startIndex + i }))
  ).select("id, content");
  if (chunkError || !chunks) return new Response(JSON.stringify({ error: "Failed to save chunks" }), { status: 500 });

  await supabase.from("document_sources").insert({
    document_id: documentId,
    source_type: "pdf",
    label: file.name.replace(/\.pdf$/i, ""),
  });

  const encoder = new TextEncoder();
  const stream = new ReadableStream({
    async start(controller) {
      const send = (obj: object) => controller.enqueue(encoder.encode(`data: ${JSON.stringify(obj)}\n\n`));
      const allCards = await generateCardsFromChunks(chunks, documentId, send);
      if (allCards.length === 0) { send({ error: "Failed to generate any cards" }); controller.close(); return; }
      const { data: savedCards, error: saveError } = await supabase.from("cards").insert(allCards).select();
      if (saveError || !savedCards) { send({ error: "Failed to save cards" }); } else { send({ done: true, cards: savedCards }); }
      controller.close();
    },
  });

  return new Response(stream, {
    headers: { "Content-Type": "text/event-stream", "Cache-Control": "no-cache", "Connection": "keep-alive", "X-Accel-Buffering": "no" },
  });
}
