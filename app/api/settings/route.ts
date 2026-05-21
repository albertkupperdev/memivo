import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { DEFAULT_SETTINGS } from "@/types";

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase.from("user_settings").select("*").eq("user_id", user.id).single();
  return NextResponse.json(data ?? { ...DEFAULT_SETTINGS, user_id: user.id });
}

export async function PUT(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await request.json();
  const settings = {
    user_id: user.id,
    interval_again:  Math.max(0.001, Number(body.interval_again) || DEFAULT_SETTINGS.interval_again),
    interval_hard:   Math.max(0.001, Number(body.interval_hard)  || DEFAULT_SETTINGS.interval_hard),
    interval_good:   Math.max(0.001, Number(body.interval_good)  || DEFAULT_SETTINGS.interval_good),
    interval_easy:   Math.max(0.001, Number(body.interval_easy)  || DEFAULT_SETTINGS.interval_easy),
    type_in_answer:  Boolean(body.type_in_answer),
    updated_at: new Date().toISOString(),
  };

  const { data, error } = await supabase
    .from("user_settings")
    .upsert(settings, { onConflict: "user_id" })
    .select()
    .single();

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json(data);
}
