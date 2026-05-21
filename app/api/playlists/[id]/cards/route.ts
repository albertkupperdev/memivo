import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function verifyOwner(supabase: Awaited<ReturnType<typeof createClient>>, playlistId: string, userId: string) {
  const { data } = await supabase.from("playlists").select("id, documents(user_id)").eq("id", playlistId).single();
  if (!data) return false;
  const doc = Array.isArray(data.documents) ? data.documents[0] : data.documents;
  return (doc as { user_id: string } | null)?.user_id === userId;
}

export async function POST(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!await verifyOwner(supabase, id, user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { cardId } = await request.json();
  if (!cardId) return NextResponse.json({ error: "cardId required" }, { status: 400 });

  const { error } = await supabase.from("playlist_cards").upsert({ playlist_id: id, card_id: cardId }, { onConflict: "playlist_id,card_id" });
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function DELETE(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!await verifyOwner(supabase, id, user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { cardId } = await request.json();
  const { error } = await supabase.from("playlist_cards").delete().eq("playlist_id", id).eq("card_id", cardId);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
