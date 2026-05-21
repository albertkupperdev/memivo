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

  const { data: doc } = await supabase.from("documents").select("id").eq("id", id).eq("user_id", user.id).single();
  if (!doc) return NextResponse.json({ error: "Not found" }, { status: 404 });

  const { data: cards } = await supabase.from("cards").select("id").eq("document_id", id);
  if (!cards || cards.length === 0) return NextResponse.json({ success: true });

  const today = new Date().toISOString().split("T")[0];
  const { error } = await supabase
    .from("card_reviews")
    .update({ due_date: today })
    .in("card_id", cards.map(c => c.id));

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}
