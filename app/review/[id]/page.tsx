"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter, useSearchParams } from "next/navigation";
import { createClient } from "@/lib/supabase/client";
import dynamic from "next/dynamic";
import type { DrawingCanvasHandle } from "@/components/DrawingCanvas";
const DrawingCanvas = dynamic(() => import("@/components/DrawingCanvas"), { ssr: false });

function CardImage({ path }: { path: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    createClient().storage.from("card-images").createSignedUrl(path, 3600)
      .then(({ data }) => setUrl(data?.signedUrl ?? null));
  }, [path]);
  if (!url) return <div className="animate-pulse rounded-2xl h-40 mb-4" style={{ background: "var(--bg-2)" }} />;
  return <img src={url} alt="" className="rounded-2xl max-h-56 object-contain w-full mb-4" />;
}
import { formatInterval } from "@/lib/sm2";
import type { Card, ReviewRating, UserSettings } from "@/types";
import { DEFAULT_SETTINGS } from "@/types";

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

function getRateTime(rating: ReviewRating, s: UserSettings): string {
  const days = { again: s.interval_again, hard: s.interval_hard, good: s.interval_good, easy: s.interval_easy }[rating];
  return formatInterval(days);
}

export default function ReviewPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const searchParams = useSearchParams();
  const limit = searchParams.get("limit") ? parseInt(searchParams.get("limit")!) : null;

  const [cards, setCards] = useState<Card[]>([]);
  const [settings, setSettings] = useState<UserSettings>(DEFAULT_SETTINGS);
  const [sessionSeconds, setSessionSeconds] = useState(0);
  const [sessionXp, setSessionXp] = useState(0);
  const [streak, setStreak] = useState(0);
  const startTimeRef = useRef<number>(0);
  const activitySaved = useRef(false);
  const timerRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [chunkMap, setChunkMap] = useState<Map<string, string>>(new Map());
  const [idx, setIdx] = useState(0);
  const [revealed, setRevealed] = useState(false);
  const [showHint, setShowHint] = useState(false);
  const [showSource, setShowSource] = useState(false);
  const [showProgress, setShowProgress] = useState(true);
  const [typedAnswer, setTypedAnswer] = useState("");
  const [answerChecked, setAnswerChecked] = useState(false);
  const [typeInActive, setTypeInActive] = useState(false);
  const [drawingActive, setDrawingActive] = useState(false);
  const [drawnImageUrl, setDrawnImageUrl] = useState<string | null>(null);
  const drawingCanvasRef = useRef<DrawingCanvasHandle>(null);
  const [ratings, setRatings] = useState<ReviewRating[]>([]);
  const [loaded, setLoaded] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [noCards, setNoCards] = useState(false);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      fetch("/api/settings").then(r => r.json()).then(s => { setSettings(s); setTypeInActive(s.type_in_answer ?? false); }).catch(() => {});
      const now = new Date().toISOString();
      const { data: allCards } = await supabase.from("cards").select("*").eq("document_id", id);
      if (!allCards || allCards.length === 0) { setNoCards(true); setLoaded(true); return; }
      const { data: reviews } = await supabase.from("card_reviews").select("card_id, due_date").in("card_id", allCards.map((c) => c.id));
      const reviewedMap = new Map(reviews?.map((r) => [r.card_id, r.due_date]));
      const playlistId = searchParams.get("playlist");
      let eligibleCards = allCards;
      if (playlistId) {
        const { data: pcRows } = await supabase.from("playlist_cards").select("card_id").eq("playlist_id", playlistId);
        const ids = new Set((pcRows ?? []).map(r => r.card_id));
        eligibleCards = allCards.filter(c => ids.has(c.id));
      }
      const allDue = eligibleCards.filter((c) => { const d = reviewedMap.get(c.id); return !d || d <= now; });
      const due = limit ? allDue.slice(0, limit) : allDue;

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
    const XP = { again: 2, hard: 5, good: 8, easy: 10 } as const;
    setSessionXp((prev) => prev + XP[rating]);
    setRatings((prev) => [...prev, rating]);
    setIdx((prev) => prev + 1);
    setRevealed(false);
    setShowHint(false);
    setShowSource(false);
    setTypedAnswer("");
    setAnswerChecked(false);
    setTypeInActive(settings.type_in_answer);
    setDrawingActive(false);
    setDrawnImageUrl(null);
    setSubmitting(false);
  }

  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      if (!loaded || idx >= cards.length) return;
      if (e.key === "Escape") { router.push(`/deck/${id}`); return; }
      if (e.key === " " && !typeInActive) { e.preventDefault(); if (!revealed) setRevealed(true); }
      if (e.key === "Enter" && !revealed && !typeInActive) { e.preventDefault(); setTypeInActive(true); }
      if (revealed) {
        if (e.key === "1") rate("again");
        if (e.key === "2") rate("hard");
        if (e.key === "3") rate("good");
        if (e.key === "4") rate("easy");
      }
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
  }, [revealed, idx, loaded, cards.length, typeInActive]);

  // Timer
  useEffect(() => {
    startTimeRef.current = Date.now();
    timerRef.current = setInterval(() => setSessionSeconds(Math.floor((Date.now() - startTimeRef.current) / 1000)), 1000);
    return () => { if (timerRef.current) clearInterval(timerRef.current); };
  }, []);

  // Fetch streak
  useEffect(() => {
    fetch("/api/activity").then(r => r.json()).then((activities: { review_date: string }[]) => {
      if (!Array.isArray(activities)) return;
      const dates = new Set(activities.map(a => a.review_date));
      const todayStr = new Date().toISOString().split("T")[0];
      const yesterdayStr = new Date(Date.now() - 86400000).toISOString().split("T")[0];
      if (!dates.has(todayStr) && !dates.has(yesterdayStr)) { setStreak(0); return; }
      let s = 0;
      let d = new Date(dates.has(todayStr) ? todayStr : yesterdayStr);
      while (dates.has(d.toISOString().split("T")[0])) {
        s++;
        d = new Date(d.getTime() - 86400000);
      }
      setStreak(s);
    }).catch(() => {});
  }, []);

  const total = cards.length;
  const done = loaded && total > 0 && idx >= total;

  // Stop timer when session completes
  useEffect(() => {
    if (done && timerRef.current) {
      clearInterval(timerRef.current);
      timerRef.current = null;
    }
  }, [done]);

  // Save activity when session completes
  useEffect(() => {
    if (done && total > 0 && !activitySaved.current) {
      activitySaved.current = true;
      fetch("/api/activity", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardsReviewed: total, xpEarned: sessionXp, sessionSeconds }),
      });
    }
  }, [done, total, sessionXp, sessionSeconds]);

  if (!loaded) return <Shell message="Loading…" />;
  if (noCards) return <Shell message="No cards found." />;


  if (done) {
    const counts = ratings.reduce<Record<ReviewRating, number>>(
      (acc, r) => ({ ...acc, [r]: (acc[r] || 0) + 1 }),
      { again: 0, hard: 0, good: 0, easy: 0 }
    );
    const mins = Math.floor(sessionSeconds / 60);
    const secs = sessionSeconds % 60;
    const timeStr = mins > 0 ? `${mins}m ${secs}s` : `${secs}s`;
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
            <div className="mt-6 flex items-center justify-center gap-6 flex-wrap">
              <div className="text-center">
                <p className="font-serif text-[36px] leading-none text-[var(--ink)]">{total}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>cards</p>
              </div>
              <div className="text-center">
                <p className="font-serif text-[36px] leading-none text-[var(--ink)]">{timeStr}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>time</p>
              </div>
              <div className="text-center">
                <p className="font-serif text-[36px] leading-none" style={{ color: "var(--accent-deep)" }}>+{sessionXp}</p>
                <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>XP</p>
              </div>
              {streak > 0 && (
                <div className="text-center">
                  <p className="font-serif text-[36px] leading-none text-[var(--ink)]">🔥 {streak}</p>
                  <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>day streak</p>
                </div>
              )}
            </div>
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
            <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--muted)" }}>
              {String(Math.floor(sessionSeconds / 60)).padStart(2, "0")}:{String(sessionSeconds % 60).padStart(2, "0")}
            </span>
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

            {card.image_url && <CardImage path={card.image_url} />}
            <Eyebrow>Question</Eyebrow>
            <p className="mt-4 font-serif text-[34px] sm:text-[40px] leading-[1.15] text-[var(--ink)] whitespace-pre-wrap">
              {card.front}
            </p>

            {/* Hint */}
            {card.hint && !revealed && (
              <div className="mt-6">
                {showHint ? (
                  <div className="inline-flex items-start gap-2 px-3 py-2 rounded-xl" style={{ background: "var(--accent-bg)" }}>
                    <span className="font-mono text-[10px] uppercase tracking-[0.14em] mt-0.5 flex-shrink-0" style={{ color: "var(--accent-deep)" }}>Hint</span>
                    <span className="text-[14px] leading-relaxed whitespace-pre-wrap" style={{ color: "var(--ink-soft)" }}>{card.hint}</span>
                  </div>
                ) : (
                  <button
                    onClick={() => setShowHint(true)}
                    className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors"
                    style={{ color: "var(--muted)" }}
                  >
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <circle cx="12" cy="12" r="10"/><path d="M12 16v-4"/><path d="M12 8h.01"/>
                    </svg>
                    Show hint
                  </button>
                )}
              </div>
            )}

            {revealed && (
              <div className="mt-10 pt-8" style={{ borderTop: "1px solid var(--border)" }}>
                {drawnImageUrl && (
                  <div className="mb-6">
                    <Eyebrow>Your drawing</Eyebrow>
                    <img src={drawnImageUrl} alt="Your drawing" className="mt-2 rounded-xl max-h-48 object-contain border" style={{ borderColor: "var(--border)" }} />
                  </div>
                )}
                {answerChecked && typedAnswer && (
                  <div className="mb-6 p-4 rounded-xl" style={{ background: "var(--bg-2)" }}>
                    <Eyebrow>Your answer</Eyebrow>
                    <p className="mt-2 text-[16px] leading-relaxed" style={{ color: "var(--ink)" }}>{typedAnswer}</p>
                  </div>
                )}
                <Eyebrow style={{ color: "var(--accent-deep)" }}>Answer</Eyebrow>
                <p className="mt-3 text-[17px] sm:text-[18px] leading-[1.65] whitespace-pre-wrap" style={{ color: "var(--ink-soft)" }}>
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
              drawingActive || card.require_drawing ? (
                <div className="flex flex-col gap-3">
                  <DrawingCanvas
                    ref={drawingCanvasRef}
                    onSave={() => {}}
                    onCancel={() => setDrawingActive(false)}
                    hideActions
                  />
                  <button
                    onClick={() => {
                      const url = drawingCanvasRef.current?.capture();
                      if (url) setDrawnImageUrl(url);
                      setRevealed(true);
                    }}
                    className="w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 text-[15px] font-medium rounded-2xl transition-colors"
                    style={{ background: "var(--ink)", color: "var(--bg)" }}
                  >
                    Show answer
                    <span className="text-[22px] leading-none opacity-60">␣</span>
                  </button>
                </div>
              ) : typeInActive ? (
                <div className="flex flex-col gap-2">
                  <textarea
                    value={typedAnswer}
                    onChange={(e) => setTypedAnswer(e.target.value)}
                    onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); if (typedAnswer.trim()) { setAnswerChecked(true); setRevealed(true); } } }}
                    placeholder="Type your answer… (Enter to check)"
                    rows={3}
                    className="w-full px-4 py-3 text-[16px] rounded-2xl outline-none resize-none"
                    style={{ border: "1.5px solid var(--border-strong)", background: "white", color: "var(--ink)" }}
                    autoFocus
                  />
                  <div className="flex gap-2">
                    <button
                      onClick={() => { if (typedAnswer.trim()) { setAnswerChecked(true); setRevealed(true); } }}
                      disabled={!typedAnswer.trim()}
                      className="flex-1 inline-flex items-center justify-center gap-2 px-4 py-3.5 text-[15px] font-medium rounded-2xl transition-colors disabled:opacity-40"
                      style={{ background: "var(--ink)", color: "var(--bg)" }}
                    >
                      Check answer
                      <KbdKey>↵</KbdKey>
                    </button>
                    <button
                      onClick={() => setRevealed(true)}
                      className="inline-flex items-center justify-center gap-2 px-4 py-3.5 text-[14px] font-medium rounded-2xl transition-colors"
                      style={{ background: "var(--bg-2)", color: "var(--muted)" }}
                    >
                      Skip
                    </button>
                  </div>
                </div>
              ) : (
                <div className="flex gap-2">
                  <button
                    onClick={() => setRevealed(true)}
                    className="flex-1 inline-flex items-center justify-center gap-3 px-4 py-4 text-[16px] font-medium rounded-2xl transition-colors"
                    style={{ background: "var(--ink)", color: "var(--bg)" }}
                  >
                    Show answer
                    <span className="text-[22px] leading-none opacity-60">␣</span>
                  </button>
                  <button
                    onClick={() => setTypeInActive(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-4 text-[14px] font-medium rounded-2xl transition-colors"
                    style={{ background: "var(--bg-2)", color: "var(--muted)" }}
                  >
                    Type answer
                    <KbdKey>↵</KbdKey>
                  </button>
                  <button
                    onClick={() => setDrawingActive(true)}
                    className="inline-flex items-center justify-center gap-2 px-4 py-4 text-[14px] font-medium rounded-2xl transition-colors"
                    style={{ background: "var(--bg-2)", color: "var(--muted)" }}
                  >
                    <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                    </svg>
                    Draw
                  </button>
                </div>
              )
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
                        {getRateTime(r, settings)}
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
