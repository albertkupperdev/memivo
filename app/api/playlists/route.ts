import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { documentId, name } = await request.json();
  if (!documentId || !name?.trim()) return NextResponse.json({ error: "documentId and name required" }, { status: 400 });

  const { data: doc } = await supabase.from("documents").select("id").eq("id", documentId).eq("user_id", user.id).single();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data, error } = await supabase.from("playlists").insert({ document_id: documentId, name: name.trim() }).select().single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
