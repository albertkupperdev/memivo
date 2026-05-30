import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

function getOwnerId(documents: unknown): string | null {
  if (!documents) return null;
  const doc = Array.isArray(documents) ? documents[0] : documents;
  return (doc as { user_id: string } | null)?.user_id ?? null;
}

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { front, back, hint, image_url, position, require_drawing, is_vocab } = await request.json();
  if (!front?.trim() || !back?.trim()) {
    return NextResponse.json({ error: "front and back are required" }, { status: 400 });
  }

  const { data: card } = await supabase
    .from("cards")
    .select("document_id, documents(user_id)")
    .eq("id", id)
    .single();

  if (!card || getOwnerId(card.documents) !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error: updateError } = await supabase
    .from("cards")
    .update({ front: front.trim(), back: back.trim(), hint: hint?.trim() ?? null, ...(image_url !== undefined ? { image_url } : {}), ...(position !== undefined ? { position } : {}), ...(require_drawing !== undefined ? { require_drawing } : {}), ...(is_vocab !== undefined ? { is_vocab } : {}) })
    .eq("id", id);

  if (updateError) return NextResponse.json({ error: updateError.message }, { status: 500 });

  const { data, error: fetchError } = await supabase
    .from("cards")
    .select("*")
    .eq("id", id)
    .single();

  if (fetchError || !data) return NextResponse.json({ error: "Failed to fetch updated card" }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: card } = await supabase
    .from("cards")
    .select("document_id, documents(user_id)")
    .eq("id", id)
    .single();

  if (!card || getOwnerId(card.documents) !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete card" }, { status: 500 });
  return NextResponse.json({ success: true });
}
