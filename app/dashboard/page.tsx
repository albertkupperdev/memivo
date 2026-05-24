import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeckList from "@/components/DeckList";
import { getDeckLevel } from "@/lib/levels";

function calcStreak(activities: { review_date: string }[]): number {
  if (!activities.length) return 0;
  const dates = new Set(activities.map(a => a.review_date));
  const today = new Date().toISOString().split("T")[0];
  const yesterday = new Date(Date.now() - 86400000).toISOString().split("T")[0];
  if (!dates.has(today) && !dates.has(yesterday)) return 0;
  let s = 0;
  let d = new Date(dates.has(today) ? today : yesterday);
  while (dates.has(d.toISOString().split("T")[0])) {
    s++;
    d = new Date(d.getTime() - 86400000);
  }
  return s;
}

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: documents }, { data: folders }, { data: activities }] = await Promise.all([
    supabase.from("documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("folders").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
    supabase.from("user_activity").select("review_date, xp_earned").eq("user_id", user.id).order("review_date", { ascending: false }).limit(60),
  ]);

  const streak = calcStreak(activities ?? []);
  const totalXp = (activities ?? []).reduce((sum, a) => sum + (a.xp_earned ?? 0), 0);

  if (!documents || documents.length === 0) {
    return <DeckList decks={[]} folders={folders ?? []} streak={streak} totalXp={totalXp} />;
  }


  const docIds = documents.map((d) => d.id);

  const { data: cards } = await supabase
    .from("cards")
    .select("id, document_id")
    .in("document_id", docIds);

  const { data: reviews } = await supabase
    .from("card_reviews")
    .select("card_id, due_date, card_xp")
    .eq("user_id", user.id)
    .in("card_id", (cards ?? []).map((c) => c.id));

  const now = new Date().toISOString();
  const reviewedMap = new Map(reviews?.map((r) => [r.card_id, r.due_date]));

  const cardXpMap = new Map(reviews?.map(r => [r.card_id, r.card_xp ?? 0]) ?? []);

  const decks = documents.map((doc) => {
    const docCards = cards?.filter((c) => c.document_id === doc.id) ?? [];
    const dueCount = docCards.filter((c) => {
      const due = reviewedMap.get(c.id);
      return !due || due <= now;
    }).length;
    const { level: deckLevel, deckXp } = getDeckLevel(cardXpMap, docCards.map(c => c.id));
    return { ...doc, cardCount: docCards.length, dueCount, deckLevel, deckXp };
  });

  return <DeckList decks={decks} folders={folders ?? []} streak={streak} totalXp={totalXp} />;
}
