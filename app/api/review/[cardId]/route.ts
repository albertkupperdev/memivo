import { NextResponse } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { applyReview } from "@/lib/sm2";
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
    .select("ease_factor, interval_days, repetitions")
    .eq("card_id", cardId)
    .eq("user_id", user.id)
    .single();

  const { data: userSettings } = await supabase.from("user_settings").select("*").eq("user_id", user.id).single();
  const currentState = existing ?? DEFAULT_STATE;
  const next = applyReview(currentState, rating as ReviewRating, userSettings as UserSettings ?? undefined);

  const { error } = await supabase.from("card_reviews").upsert(
    {
      card_id: cardId,
      user_id: user.id,
      ease_factor: next.ease_factor,
      interval_days: next.interval_days,
      repetitions: next.repetitions,
      due_date: next.due_date,
      last_reviewed_at: new Date().toISOString(),
    },
    { onConflict: "card_id,user_id" }
  );

  if (error) {
    return NextResponse.json({ error: "Failed to save review" }, { status: 500 });
  }

  // Auto-add to "Hard cards" playlist when rated "Again"
  if (rating === "again") {
    const { data: card } = await supabase.from("cards").select("document_id").eq("id", cardId).single();
    if (card) {
      // Find or create the single "Hard cards" playlist for this document
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

  return NextResponse.json({ due_date: next.due_date });
}
