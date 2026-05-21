import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { title } = await request.json();
  if (!title?.trim()) return NextResponse.json({ error: "title is required" }, { status: 400 });

  const { data, error } = await supabase
    .from("documents")
    .insert({ user_id: user.id, title: title.trim(), source_type: "manual" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
