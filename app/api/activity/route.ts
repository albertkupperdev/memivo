import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";

export async function POST(request: Request) {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { cardsReviewed, xpEarned, sessionSeconds } = await request.json();
  const today = new Date().toISOString().split("T")[0];

  const { data: existing } = await supabase
    .from("user_activity")
    .select("cards_reviewed, xp_earned, session_seconds")
    .eq("user_id", user.id)
    .eq("review_date", today)
    .single();

  const { error } = await supabase.from("user_activity").upsert({
    user_id: user.id,
    review_date: today,
    cards_reviewed: (existing?.cards_reviewed ?? 0) + (cardsReviewed ?? 0),
    xp_earned: (existing?.xp_earned ?? 0) + (xpEarned ?? 0),
    session_seconds: (existing?.session_seconds ?? 0) + (sessionSeconds ?? 0),
  }, { onConflict: "user_id,review_date" });

  if (error) return NextResponse.json({ error: error.message }, { status: 500 });
  return NextResponse.json({ success: true });
}

export async function GET() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data } = await supabase
    .from("user_activity")
    .select("review_date, xp_earned, cards_reviewed")
    .eq("user_id", user.id)
    .order("review_date", { ascending: false })
    .limit(60);

  return NextResponse.json(data ?? []);
}
