import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentId, front, back, hint, image_url, require_drawing, is_vocab } = await request.json();
  if (!documentId || !front?.trim() || !back?.trim()) {
    return NextResponse.json({ error: "documentId, front, and back are required" }, { status: 400 });
  }

  const { data: doc } = await supabase
    .from("documents")
    .select("id")
    .eq("id", documentId)
    .eq("user_id", user.id)
    .single();

  if (!doc) return NextResponse.json({ error: "Document not found" }, { status: 404 });

  const { data, error } = await supabase
    .from("cards")
    .insert({ document_id: documentId, chunk_id: null, front: front.trim(), back: back.trim(), hint: hint?.trim() ?? null, image_url: image_url ?? null, require_drawing: require_drawing ?? false, is_vocab: is_vocab ?? false })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
