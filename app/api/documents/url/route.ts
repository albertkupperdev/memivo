import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTextFromURL } from "@/lib/extract";
import { chunkText } from "@/lib/chunker";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const body = await request.json();
  const { url, contentType } = body;
  const resolvedContentType = contentType === "vocabulary" ? "vocabulary" : "standard";

  if (!url || typeof url !== "string") {
    return NextResponse.json({ error: "A URL is required" }, { status: 400 });
  }

  try {
    new URL(url);
  } catch {
    return NextResponse.json({ error: "Invalid URL format" }, { status: 400 });
  }

  const { title, text } = await extractTextFromURL(url);

  if (!text.trim()) {
    return NextResponse.json(
      { error: "Could not extract text from this URL" },
      { status: 422 }
    );
  }

  const chunks = chunkText(text);

  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "Page is too short to generate flashcards" },
      { status: 422 }
    );
  }

  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title,
      source_type: "url",
      source_url: url,
      content_type: resolvedContentType,
    })
    .select()
    .single();

  if (docError || !document) {
    return NextResponse.json({ error: "Failed to save document" }, { status: 500 });
  }

  const { error: chunkError } = await supabase.from("chunks").insert(
    chunks.map((content, index) => ({
      document_id: document.id,
      content,
      chunk_index: index,
    }))
  );

  if (chunkError) {
    return NextResponse.json({ error: "Failed to save chunks" }, { status: 500 });
  }

  return NextResponse.json({ documentId: document.id });
}
