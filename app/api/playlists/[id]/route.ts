import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

async function verifyOwner(supabase: Awaited<ReturnType<typeof createClient>>, playlistId: string, userId: string) {
  const { data } = await supabase
    .from("playlists")
    .select("id, documents(user_id)")
    .eq("id", playlistId)
    .single();
  if (!data) return false;
  const doc = Array.isArray(data.documents) ? data.documents[0] : data.documents;
  return (doc as { user_id: string } | null)?.user_id === userId;
}

export async function PATCH(request: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!await verifyOwner(supabase, id, user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { name } = await request.json();
  if (!name?.trim()) return NextResponse.json({ error: "name required" }, { status: 400 });

  const { data, error } = await supabase.from("playlists").update({ name: name.trim() }).eq("id", id).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}

export async function DELETE(_req: Request, { params }: { params: Promise<{ id: string }> }) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { id } = await params;
  if (!await verifyOwner(supabase, id, user.id)) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { error } = await supabase.from("playlists").delete().eq("id", id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
