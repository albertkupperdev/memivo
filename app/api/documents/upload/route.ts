import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { extractTextFromPDF } from "@/lib/extract";
import { chunkText } from "@/lib/chunker";

export async function POST(request: Request) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const formData = await request.formData();
  const file = formData.get("file") as File | null;
  const contentType = formData.get("contentType") === "vocabulary" ? "vocabulary" : "standard";

  if (!file || file.type !== "application/pdf") {
    return NextResponse.json({ error: "A PDF file is required" }, { status: 400 });
  }

  const buffer = await file.arrayBuffer();
  const text = await extractTextFromPDF(buffer);

  if (!text.trim()) {
    return NextResponse.json(
      { error: "Could not extract text from this PDF" },
      { status: 422 }
    );
  }

  const chunks = chunkText(text);

  if (chunks.length === 0) {
    return NextResponse.json(
      { error: "Document is too short to generate flashcards" },
      { status: 422 }
    );
  }

  const { data: document, error: docError } = await supabase
    .from("documents")
    .insert({
      user_id: user.id,
      title: file.name.replace(/\.pdf$/i, ""),
      source_type: "pdf",
      content_type: contentType,
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
