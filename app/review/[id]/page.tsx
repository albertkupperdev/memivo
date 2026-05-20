"use client";

import { useEffect, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import type { Card, ReviewRating } from "@/types";

function Eyebrow({ children, className = "", style = {} }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] ${className}`} style={style}>
      {children}
    </span>
  );
}

function KbdKey({ children }: { children: React.ReactNode }) {
  return (
    <span
      className="inline-flex items-center justify-center w-5 h-5 rounded text-[10px] font-mono font-bold leading-none"
      style={{ background: "rgba(0,0,0,0.10)", color: "inherit" }}
    >
      {children}
    </span>
  );
}

const RATE_STYLES: Record<ReviewRating, { bg: string; color: string; border: string }> = {
  again: { bg: "var(--complement-bg)",   color: "var(--complement-deep)", border: "var(--complement-border)" },
  hard:  { bg: "#fbf2dc",                color: "#8a6624",                border: "#f0e3b8" },
  good:  { bg: "var(--accent-bg)",       color: "var(--accent-deep)",     border: "var(--accent-tint)" },
  easy:  { bg: "var(--bg-2)",            color: "var(--ink)",             border: "var(--border-strong)" },
};

const RATE_TIME: Record<ReviewRating, string> = {
  again: "< 1 min", hard: "6 min", good: "10 min", easy: "4 days",
};

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [cards, setCards] = useState<Card[]>([]);
  const [chunkMap, setChunkMap] = useState<Map<string, string>>(new Map());
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [showProgress, setShowProgress] = useState(true);
  const [ratings, setRatings] = useState<ReviewRating[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noCards, setNoCards] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const today = new Date().toISOString().split("T")[0];
      const { data: allCards } = await supabase.from("cards").select("*").eq("document_id", id);
      if (!allCards || allCards.length === 0) { setNoCards(true); setLoaded(true); return; }
      const { data: reviews } = await supabase.from("card_reviews").select("card_id, due_date").in("card_id", allCards.map((c) => c.id));
      const reviewedMap = new Map(reviews?.map((r) => [r.card_id, r.due_date]));
      const due = allCards.filter((c) => { const d = reviewedMap.get(c.id); return !d || d <= today; });

      const { data: chunks } = await supabase
        .from("chunks")
        .select("id, content")
        .in("id", due.map((c) => c.chunk_id));
      setChunkMap(new Map(chunks?.map((ch) => [ch.id, ch.content]) ?? []));

      setCards(due);
      setLoaded(true);
    }
    load();
  }, [id]);

  async function rate(rating: ReviewRating) {
    if (submitting) return;
    setSubmitting(true);
    const card = cards[idx];
    await fetch(`/api/review/${card.id}`, {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ rating }),
    });
    setRatings((prev) => [...prev, rating]);
    setIdx((prev) => prev + 1);
    setRevealed(false);
    setShowSource(false);
    setSubmitting(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!loaded || idx >= cards.length) return;
      if (e.key === "Escape") { router.push(`/deck/${id}`); return; }
      if (e.key === " " || e.key === "Enter") { e.preventDefault(); if (!revealed) setRevealed(true); }
      if (revealed) {
        if (e.key === "1") rate("again");
        if (e.key === "2") rate("hard");
        if (e.key === "3") rate("good");
        if (e.key === "4") rate("easy");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, idx, loaded, cards.length]);

  if (!loaded) return <Shell message="Loading…" />;
  if (noCards) return <Shell message="No cards found." />;

  const total = cards.length;
  const done = idx >= total;

  if (done) {
    const counts = ratings.reduce<Record<ReviewRating, number>>(
      (acc, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }),
      { again: 0, hard: 0, good: 0, easy: 0 }
    );
    return (
      <div className="flex-1 w-full">
        <div className="max-w-lg mx-auto px-6 py-20">
          <div className="text-center">
            <div className="mx-auto w-16 h-16 rounded-full flex items-center justify-center mb-8" style={{ background: "var(--accent)" }}>
              <svg viewBox="0 0 24 24" className="w-8 h-8" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--ink)" }}>
                <path d="M5 12l5 5L20 7"/>
              </svg>
            </div>
            <Eyebrow>Session complete</Eyebrow>
            <h1 className="mt-3 font-serif text-[48px] leading-[1.05] text-[var(--ink)]">
              Nice <em className="not-italic" style={{ color: "var(--accent-deep)" }}>work</em>.
            </h1>
            <p className="mt-4 text-[16px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              You reviewed <span className="font-medium text-[var(--ink)]">{total}</span> {total === 1 ? "card" : "cards"}.
            </p>
          </div>

          <dl className="mt-10 grid grid-cols-4 gap-2">
            {(["again", "hard", "good", "easy"] as ReviewRating[]).map((r) => {
              const s = RATE_STYLES[r];
              return (
                <div key={r} className="rounded-2xl p-4" style={{ background: s.bg, color: s.color }}>
                  <Eyebrow className="text-current opacity-80">{r}</Eyebrow>
                  <div className="mt-2 font-serif text-[32px] leading-none tabular-nums">{counts[r]}</div>
                </div>
              );
            })}
          </dl>

          <button
            onClick={() => router.push(`/deck/${id}`)}
            className="mt-10 w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 text-[15px] font-medium rounded-xl transition-colors group"
            style={{ background: "var(--ink)", color: "var(--bg)" }}
          >
            Back to deck
            <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
            </svg>
          </button>
        </div>
      </div>
    );
  }

  const card = cards[idx];

  return (
    <div className="flex-1 w-full flex flex-col">
      {/* Progress header */}
      <div className="max-w-3xl w-full mx-auto px-6 pt-10 pb-8">
        <div className="flex items-center justify-between mb-5">
          <button
            onClick={() => router.push(`/deck/${id}`)}
            className="inline-flex items-center gap-2 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors"
            style={{ color: "var(--muted)" }}
          >
            <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
              <path d="M19 12H5"/><path d="m12 5-7 7 7 7"/>
            </svg>
            Exit
          </button>

          <div className="flex items-center gap-3">
            {showProgress && (
              <Eyebrow>
                <span className="tabular-nums" style={{ color: "var(--ink)" }}>{String(idx + 1).padStart(2, "0")}</span>
                <span className="mx-1.5" style={{ color: "var(--border-strong)" }}>/</span>
                <span className="tabular-nums">{String(total).padStart(2, "0")}</span>
              </Eyebrow>
            )}
            <button
              onClick={() => setShowProgress((v) => !v)}
              className="transition-opacity"
              style={{ color: "var(--muted)", opacity: showProgress ? 1 : 0.4 }}
              title={showProgress ? "Hide progress" : "Show progress"}
            >
              {showProgress ? (
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M2 12s3-7 10-7 10 7 10 7-3 7-10 7-10-7-10-7Z"/><circle cx="12" cy="12" r="3"/>
                </svg>
              ) : (
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M9.88 9.88a3 3 0 1 0 4.24 4.24"/><path d="M10.73 5.08A10.43 10.43 0 0 1 12 5c7 0 10 7 10 7a13.16 13.16 0 0 1-1.67 2.68"/><path d="M6.61 6.61A13.526 13.526 0 0 0 2 12s3 7 10 7a9.74 9.74 0 0 0 5.39-1.61"/><line x1="2" y1="2" x2="22" y2="22"/>
                </svg>
              )}
            </button>
          </div>
        </div>

        {/* Segmented progress bar */}
        {showProgress && (
          <div className="flex gap-1">
            {cards.map((_, i) => (
              <div
                key={i}
                className="h-1 flex-1 rounded-full transition-colors"
                style={{
                  background: i < idx ? "var(--accent)" : i === idx ? "var(--ink)" : "var(--border-strong)",
                }}
              />
            ))}
          </div>
        )}
      </div>

      {/* Card */}
      <div className="flex-1 w-full flex items-start justify-center px-6 pb-10">
        <div className="w-full max-w-3xl">
          <div className="bg-white rounded-3xl min-h-[360px] p-8 sm:p-12 flex flex-col relative overflow-hidden" style={{ border: "1px solid var(--border)" }}>
            <span className={`absolute top-6 right-7 font-mono text-[11px] uppercase tracking-[0.14em] tabular-nums ${showProgress ? "" : "invisible"}`} style={{ color: "var(--border-strong)" }}>
              {String(idx + 1).padStart(2, "0")} · {String(total).padStart(2, "0")}
            </span>

            <Eyebrow>Question</Eyebrow>
            <p className="mt-4 font-serif text-[34px] sm:text-[40px] leading-[1.15] text-[var(--ink)]">
              {card.front}
            </p>

            {revealed && (
              <div className="mt-10 pt-8" style={{ borderTop: "1px solid var(--border)" }}>
                <Eyebrow style={{ color: "var(--accent-deep)" }}>Answer</Eyebrow>
                <p className="mt-3 text-[17px] sm:text-[18px] leading-[1.65]" style={{ color: "var(--ink-soft)" }}>
                  {card.back}
                </p>

                {chunkMap.has(card.chunk_id) && (
                  <div className="mt-6">
                    <button
                      onClick={() => setShowSource((v) => !v)}
                      className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors"
                      style={{ color: showSource ? "var(--accent-deep)" : "var(--soft)" }}
                    >
                      <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                        <path d={showSource ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
                      </svg>
                      See source
                    </button>
                    {showSource && (
                      <div className="mt-3 pl-3" style={{ borderLeft: "2px solid var(--accent)" }}>
                        <p className="text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
                          {chunkMap.get(card.chunk_id)}
                        </p>
                      </div>
                    )}
                  </div>
                )}
              </div>
            )}
          </div>

          <div className="mt-6">
            {!revealed ? (
              <button
                onClick={() => setRevealed(true)}
                className="w-full inline-flex items-center justify-center gap-3 px-4 py-4 text-[16px] font-medium rounded-2xl transition-colors"
                style={{ background: "var(--ink)", color: "var(--bg)" }}
              >
                Show answer
                <span className="text-[22px] leading-none opacity-60">␣</span>
              </button>
            ) : (
              <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                {(["again", "hard", "good", "easy"] as ReviewRating[]).map((r, i) => {
                  const s = RATE_STYLES[r];
                  return (
                    <button
                      key={r}
                      onClick={() => rate(r)}
                      disabled={submitting}
                      className="inline-flex flex-col items-start px-4 py-3.5 rounded-2xl border transition-colors disabled:opacity-50"
                      style={{ background: s.bg, color: s.color, borderColor: s.border }}
                    >
                      <div className="flex items-center justify-between w-full">
                        <span className="text-[15px] font-semibold capitalize">{r}</span>
                        <KbdKey>{i + 1}</KbdKey>
                      </div>
                      <span className="mt-1.5 font-mono text-[10px] uppercase tracking-[0.14em] opacity-60">
                        {RATE_TIME[r]}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}

function Shell({ message }: { message: string }) {
  return (
    <div className="flex-1 flex items-center justify-center">
      <p className="text-sm" style={{ color: "var(--muted)" }}>{message}</p>
    </div>
  );
}
