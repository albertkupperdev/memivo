import { redirect } from "next/navigation";
import { createClient } from "@/lib/supabase/server";
import DeckList from "@/components/DeckList";

export default async function DashboardPage() {
  const supabase = await createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) redirect("/login");

  const [{ data: documents }, { data: folders }] = await Promise.all([
    supabase.from("documents").select("*").eq("user_id", user.id).order("created_at", { ascending: false }),
    supabase.from("folders").select("*").eq("user_id", user.id).order("created_at", { ascending: true }),
  ]);

  if (!documents || documents.length === 0) {
    return <DeckList decks={[]} folders={folders ?? []} />;
  }

  const docIds = documents.map((d) => d.id);

  const { data: cards } = await supabase
    .from("cards")
    .select("id, document_id")
    .in("document_id", docIds);

  const { data: reviews } = await supabase
    .from("card_reviews")
    .select("card_id, due_date")
    .eq("user_id", user.id)
    .in("card_id", (cards ?? []).map((c) => c.id));

  const today = new Date().toISOString().split("T")[0];
  const reviewedMap = new Map(reviews?.map((r) => [r.card_id, r.due_date]));

  const decks = documents.map((doc) => {
    const docCards = cards?.filter((c) => c.document_id === doc.id) ?? [];
    const dueCount = docCards.filter((c) => {
      const due = reviewedMap.get(c.id);
      return !due || due <= today;
    }).length;
    return { ...doc, cardCount: docCards.length, dueCount };
  });

  return <DeckList decks={decks} folders={folders ?? []} />;
}
