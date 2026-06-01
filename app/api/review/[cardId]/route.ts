import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyReview } from "@/lib/sm2";
import { calcCardXp, calcStreakBonus } from "@/lib/levels";
import type { ReviewRating, UserSettings } from "@/types";

const VALID_RATINGS: ReviewRating[] = ["again", "hard", "good", "easy"];

const DEFAULT_STATE = {
  ease_factor: 2.5,
  interval_days: 1,
  repetitions: 0,
};

export async function POST(
  request: Request,
  { params }: { params: Promise<{ cardId: string }> }
) {
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  if (!user) {
    return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  }

  const { cardId } = await params;
  const { rating } = await request.json();

  if (!VALID_RATINGS.includes(rating)) {
    return NextResponse.json({ error: "Invalid rating" }, { status: 400 });
  }

  const { data: existing } = await supabase
    .from("card_reviews")
    .select("ease_factor, interval_days, repetitions, card_xp, review_count, consecutive_correct, last_reviewed_at")
    .eq("card_id", cardId)
    .eq("user_id", user.id)
    .single();

  const { data: userSettings } = await supabase.from("user_settings").select("*").eq("user_id", user.id).single();
  const currentState = existing ?? DEFAULT_STATE;
  const next = applyReview(currentState, rating as ReviewRating, userSettings as UserSettings ?? undefined);

  const isCorrect = rating === "good" || rating === "easy";
  const newStreak = isCorrect ? (existing?.consecutive_correct ?? 0) + 1 : 0;
  const actualDays = existing?.last_reviewed_at
    ? Math.max(0, (Date.now() - new Date(existing.last_reviewed_at).getTime()) / 86400000)
    : (existing?.interval_days ?? 1);
  const baseXp = calcCardXp(rating, actualDays);
  const xpGained = Math.round(baseXp * (1 + calcStreakBonus(newStreak)));

  const { error } = await supabase.from("card_reviews").upsert(
    {
      card_id: cardId,
      user_id: user.id,
      ease_factor: next.ease_factor,
      interval_days: next.interval_days,
      repetitions: next.repetitions,
      due_date: next.due_date,
      last_reviewed_at: new Date().toISOString(),
      card_xp: (existing?.card_xp ?? 0) + xpGained,
      review_count: (existing?.review_count ?? 0) + 1,
      consecutive_correct: newStreak,
    },
    { onConflict: "card_id,user_id" }
  );

  if (error) {
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }

  if (rating === "again") {
    const { data: card } = await supabase.from("cards").select("document_id").eq("id", cardId).single();
    if (card) {
      let { data: playlist } = await supabase
        .from("playlists")
        .select("id")
        .eq("document_id", card.document_id)
        .eq("name", "Hard cards")
        .single();

      if (!playlist) {
        const { data: created } = await supabase
          .from("playlists")
          .insert({ document_id: card.document_id, name: "Hard cards" })
          .select("id")
          .single();
        playlist = created;
      }

      if (playlist) {
        await supabase
          .from("playlist_cards")
          .upsert({ playlist_id: playlist.id, card_id: cardId }, { onConflict: "playlist_id,card_id" });
      }
    }
  }

  return NextResponse.json({ due_date: next.due_date, xp_gained: xpGained, streak: newStreak });
}
