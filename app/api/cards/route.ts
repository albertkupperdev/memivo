import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentId, front, back, image_url } = await request.json();
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
    .insert({ document_id: documentId, chunk_id: null, front: front.trim(), back: back.trim(), image_url: image_url ?? null })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
