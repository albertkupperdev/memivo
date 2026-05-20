import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function PATCH(
  request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  const { front, back } = await request.json();
  if (!front?.trim() || !back?.trim()) {
    return NextResponse.json({ error: "front and back are required" }, { status: 400 });
  }

  const { data: card } = await supabase
    .from("cards")
    .select("document_id, documents(user_id)")
    .eq("id", id)
    .single();

  const doc = Array.isArray(card.documents) ? card.documents[0] : card.documents;
  if (!card || (doc as { user_id: string } | null)?.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data, error } = await supabase
    .from("cards")
    .update({ front: front.trim(), back: back.trim() })
    .eq("id", id)
    .select()
    .single();

  if (error) return NextResponse.json({ error: "Failed to update card" }, { status: 500 });
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

  const doc2 = Array.isArray(card.documents) ? card.documents[0] : card.documents;
  if (!card || (doc2 as { user_id: string } | null)?.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { error } = await supabase.from("cards").delete().eq("id", id);
  if (error) return NextResponse.json({ error: "Failed to delete card" }, { status: 500 });
  return NextResponse.json({ success: true });
}
