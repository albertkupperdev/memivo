import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(
  _request: Request,
  { params }: { params: Promise<{ id: string }> }
) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;

  const { data: playlist } = await supabase
    .from("playlists")
    .select("id, documents(user_id)")
    .eq("id", id)
    .single();

  const doc = Array.isArray(playlist?.documents) ? playlist.documents[0] : playlist?.documents;
  if (!playlist || (doc as { user_id: string } | null)?.user_id !== user.id) {
    return NextResponse.json({ error: "Not found" }, { status: 404 });
  }

  const { data: pcRows } = await supabase
    .from("playlist_cards")
    .select("card_id")
    .eq("playlist_id", id);

  if (!pcRows || pcRows.length === 0) return NextResponse.json({ success: true });

  const today = new Date().toISOString().split("T")[0];
  await supabase
    .from("card_reviews")
    .update({ due_date: today })
    .in("card_id", pcRows.map(r => r.card_id))
    .eq("user_id", user.id);

  return NextResponse.json({ success: true });
}
