"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Card, Document } from "@/types";

function Eyebrow({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] ${className}`} style={style}>
      {children}
    </span>
  );
}

function PencilIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z" />
    </svg>
  );
}

function TrashIcon({ className = "" }: { className?: string }) {
  return (
    <svg viewBox="0 0 24 24" className={`w-3.5 h-3.5 ${className}`} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
    </svg>
  );
}

export default function DeckPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();
  const [document, setDocument] = useState<Document | null>(null);
  const [cards, setCards] = useState<Card[]>([]);
  const [chunkMap, setChunkMap] = useState<Map<string, string>>(new Map());
  const [expandedSource, setExpandedSource] = useState<string | null>(null);
  const [dueCount, setDueCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [genProgress, setGenProgress] = useState(0);
  const [genTotal, setGenTotal] = useState(0);
  const [error, setError] = useState<string | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [deleting, setDeleting] = useState(false);

  // Card editing
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [savingCard, setSavingCard] = useState(false);
  const [saveCardError, setSaveCardError] = useState<string | null>(null);
  const [confirmDeleteCardId, setConfirmDeleteCardId] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  // Deck rename
  const [renamingDeck, setRenamingDeck] = useState(false);
  const [renameTitle, setRenameTitle] = useState("");
  const [savingRename, setSavingRename] = useState(false);
  const renameTitleRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: doc } = await supabase.from("documents").select("*").eq("id", id).single();
      if (!doc) { setError("Document not found."); setLoading(false); return; }
      setDocument(doc);

      const { data: existing } = await supabase.from("cards").select("*").eq("document_id", id);
      if (existing && existing.length > 0) {
        setCards(existing);
        const today = new Date().toISOString().split("T")[0];
        const { data: reviews } = await supabase
          .from("card_reviews")
          .select("card_id, due_date")
          .in("card_id", existing.map((c) => c.id));
        const reviewedMap = new Map(reviews?.map((r) => [r.card_id, r.due_date]));
        setDueCount(existing.filter((c) => { const d = reviewedMap.get(c.id); return !d || d <= today; }).length);

        const { data: chunks } = await supabase
          .from("chunks")
          .select("id, content")
          .in("id", existing.map((c) => c.chunk_id));
        setChunkMap(new Map(chunks?.map((ch) => [ch.id, ch.content]) ?? []));

        setLoading(false);
        return;
      }

      setLoading(false);
      setGenerating(true);
      const res = await fetch("/api/cards/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ documentId: id }),
      });
      if (!res.ok || !res.body) { setError("Generation failed."); setGenerating(false); return; }

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let buffer = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        buffer += decoder.decode(value, { stream: true });
        const lines = buffer.split("\n");
        buffer = lines.pop() ?? "";
        for (const line of lines) {
          if (!line.startsWith("data: ")) continue;
          try {
            const msg = JSON.parse(line.slice(6));
            if (msg.progress !== undefined) {
              setGenProgress(msg.progress);
              setGenTotal(msg.total);
            }
            if (msg.error) { setError(msg.error); setGenerating(false); return; }
            if (msg.done) { setCards(msg.cards); setGenerating(false); return; }
          } catch { /* ignore malformed line */ }
        }
      }
    }
    load();
  }, [id]);

  async function handleDelete() {
    setDeleting(true);
    const res = await fetch(`/api/documents/${id}`, { method: "DELETE" });
    if (res.ok) router.push("/dashboard");
    else { setDeleting(false); setConfirming(false); }
  }

  function startEditCard(card: Card) {
    setConfirmDeleteCardId(null);
    setEditingCardId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
  }

  async function saveCard() {
    if (!editingCardId) return;
    setSavingCard(true);
    setSaveCardError(null);
    const res = await fetch(`/api/cards/${editingCardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ front: editFront, back: editBack }),
    });
    if (res.ok) {
      const updated = await res.json();
      setCards(cards.map((c) => (c.id === editingCardId ? updated : c)));
      setEditingCardId(null);
    } else {
      const body = await res.json().catch(() => ({}));
      setSaveCardError(body.error ?? "Failed to save. Try again.");
    }
    setSavingCard(false);
  }

  async function deleteCard(cardId: string) {
    setDeletingCardId(cardId);
    const res = await fetch(`/api/cards/${cardId}`, { method: "DELETE" });
    if (res.ok) {
      setCards((prev) => prev.filter((c) => c.id !== cardId));
    }
    setDeletingCardId(null);
    setConfirmDeleteCardId(null);
  }

  function startRename() {
    setRenameTitle(document?.title ?? "");
    setRenamingDeck(true);
    setTimeout(() => renameTitleRef.current?.select(), 0);
  }

  async function saveRename() {
    if (!renameTitle.trim()) return;
    setSavingRename(true);
    const res = await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ title: renameTitle }),
    });
    if (res.ok) {
      const updated = await res.json();
      setDocument(updated);
      setRenamingDeck(false);
    }
    setSavingRename(false);
  }

  if (error) {
    return (
      <div className="flex-1 flex items-center justify-center">
        <p className="text-sm" style={{ color: "var(--muted)" }}>{error}</p>
      </div>
    );
  }

  return (
    <div className="flex-1 w-full">
      <div className="max-w-2xl mx-auto px-6 py-16">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 mb-10 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors"
          style={{ color: "var(--muted)" }}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 5-7 7 7 7"/>
          </svg>
          All decks
        </Link>

        {/* Hero */}
        <div className="mb-12">
          <Eyebrow>
            {document?.source_type === "pdf" ? "PDF source" : "Web source"}
            {document?.source_url && ` · ${document.source_url}`}
          </Eyebrow>

          {renamingDeck ? (
            <div className="mt-3">
              <input
                ref={renameTitleRef}
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRename();
                  if (e.key === "Escape") setRenamingDeck(false);
                }}
                className="w-full font-serif text-[44px] leading-[1.05] text-[var(--ink)] bg-transparent outline-none border-b-2"
                style={{ borderColor: "var(--accent)" }}
                autoFocus
              />
              <div className="mt-3 flex gap-2">
                <button
                  onClick={saveRename}
                  disabled={savingRename || !renameTitle.trim()}
                  className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50"
                  style={{ background: "var(--ink)" }}
                >
                  {savingRename ? "Saving…" : "Save"}
                </button>
                <button
                  onClick={() => setRenamingDeck(false)}
                  className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{ color: "var(--muted)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className="group mt-3 flex items-start gap-3">
              <h1 className="font-serif text-[44px] leading-[1.05] text-[var(--ink)]">
                {document?.title ?? "Loading…"}
              </h1>
              {document && (
                <button
                  onClick={startRename}
                  className="opacity-0 group-hover:opacity-100 transition-opacity mt-4 shrink-0"
                  style={{ color: "var(--muted)" }}
                  title="Rename deck"
                >
                  <PencilIcon />
                </button>
              )}
            </div>
          )}

          {/* Stat strip */}
          <div className="mt-7 grid grid-cols-3 divide-x" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
            <StatCell label="Total" value={cards.length} />
            <StatCell label="Due now" value={dueCount} accent={dueCount > 0} />
            <StatCell label="Source" value={document?.source_type?.toUpperCase() ?? "—"} />
          </div>

          <div className="mt-7 flex flex-col sm:flex-row gap-3">
            <button
              onClick={() => router.push(`/review/${id}`)}
              disabled={generating || cards.length === 0}
              className="flex-1 inline-flex items-center justify-center gap-2 px-5 py-3.5 text-[15px] font-medium rounded-xl transition-colors group"
              style={{
                background: generating || cards.length === 0 ? "var(--border-strong)" : "var(--ink)",
                color: generating || cards.length === 0 ? "var(--soft)" : "var(--bg)",
                cursor: generating || cards.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {generating ? "Generating cards…" : (
                <>
                  Start review
                  {dueCount > 0 && (
                    <span className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70">· {dueCount} due</span>
                  )}
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
            {!confirming && (
              <button
                onClick={() => setConfirming(true)}
                className="inline-flex items-center justify-center gap-2 px-4 py-3.5 text-sm font-medium rounded-xl transition-colors"
                style={{ color: "var(--muted)" }}
              >
                <TrashIcon />
                Delete
              </button>
            )}
          </div>

          {confirming && (
            <div className="mt-5 p-6 rounded-2xl" style={{ background: "var(--complement-bg)", border: "1px solid var(--complement-border)" }}>
              <Eyebrow style={{ color: "var(--complement-deep)" }}>Delete deck?</Eyebrow>
              <p className="mt-2 text-[15px] leading-relaxed" style={{ color: "var(--complement-deeper)" }}>
                All <span className="font-medium text-[var(--ink)]">{cards.length}</span> cards and review history will be permanently removed. This can't be undone.
              </p>
              <div className="mt-5 flex gap-2">
                <button
                  onClick={handleDelete}
                  disabled={deleting}
                  className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium rounded-xl text-white transition-colors disabled:opacity-50"
                  style={{ background: "var(--complement)" }}
                >
                  {deleting ? "Deleting…" : "Yes, delete deck"}
                </button>
                <button
                  onClick={() => setConfirming(false)}
                  className="inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium transition-colors"
                  style={{ color: "var(--muted)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>

        {/* Card list */}
        <div>
          <div className="flex items-baseline justify-between mb-6">
            <h2 className="font-serif text-[28px] leading-tight text-[var(--ink)]">All cards</h2>
            <Eyebrow>{generating ? "Generating…" : `${cards.length} total`}</Eyebrow>
          </div>

          {generating ? (
            <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid var(--border)" }}>
              <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-6 relative" style={{ background: "var(--accent-bg)" }}>
                <span className="absolute inset-0 rounded-full animate-ping opacity-50" style={{ background: "var(--accent)" }} />
                <span className="relative w-3 h-3 rounded-full" style={{ background: "var(--accent)" }} />
              </div>
              <h3 className="font-serif text-[24px] leading-tight text-[var(--ink)]">Writing cards…</h3>
              <p className="mt-3 text-[14.5px] leading-relaxed max-w-sm mx-auto" style={{ color: "var(--ink-soft)" }}>
                Reading your source and shaping it into flashcards.
              </p>
              <div className="mt-8 max-w-xs mx-auto">
                <div className="flex justify-between items-baseline mb-2">
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                    {genTotal > 0 ? `${genProgress} / ${genTotal} sections` : "Starting…"}
                  </span>
                  {genTotal > 0 && (
                    <span className="font-mono text-[11px] tabular-nums" style={{ color: "var(--accent-deep)" }}>
                      {Math.round((genProgress / genTotal) * 100)}%
                    </span>
                  )}
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--accent-bg)" }}>
                  {genTotal > 0 ? (
                    <div
                      className="h-full rounded-full transition-all duration-500"
                      style={{ width: `${Math.round((genProgress / genTotal) * 100)}%`, background: "var(--accent)" }}
                    />
                  ) : (
                    <div className="h-full rounded-full animate-pulse w-full" style={{ background: "var(--accent)" }} />
                  )}
                </div>
              </div>
            </div>
          ) : loading ? (
            <div className="flex flex-col">
              {[0, 1, 2].map((i) => (
                <div key={i} className="py-7" style={{ borderTop: "1px solid var(--border)" }}>
                  <div className="flex items-start gap-6">
                    <div className="w-8 h-3 rounded-full mt-1 animate-pulse" style={{ background: "var(--bg-2)" }} />
                    <div className="flex-1 space-y-3">
                      <div className="h-4 rounded-full w-3/4 animate-pulse" style={{ background: "var(--bg-2)" }} />
                      <div className="h-3 rounded-full w-full animate-pulse" style={{ background: "var(--bg-2)" }} />
                      <div className="h-3 rounded-full w-2/3 animate-pulse" style={{ background: "var(--bg-2)" }} />
                    </div>
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <ol className="flex flex-col">
              {cards.map((card, i) => (
                <li
                  key={card.id}
                  className="group py-7"
                  style={{ borderTop: "1px solid var(--border)", ...(i === cards.length - 1 ? { borderBottom: "1px solid var(--border)" } : {}) }}
                >
                  {editingCardId === card.id ? (
                    <div className="flex items-start gap-6">
                      <span className="flex-shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] tabular-nums mt-1.5 w-8" style={{ color: "var(--soft)" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <textarea
                          value={editFront}
                          onChange={(e) => setEditFront(e.target.value)}
                          rows={2}
                          className="w-full font-serif text-[20px] leading-[1.3] text-[var(--ink)] bg-transparent outline-none border-b resize-none"
                          style={{ borderColor: "var(--border-strong)" }}
                          placeholder="Front"
                        />
                        <textarea
                          value={editBack}
                          onChange={(e) => setEditBack(e.target.value)}
                          rows={3}
                          className="w-full mt-3 text-[14.5px] leading-relaxed bg-transparent outline-none border-b resize-none"
                          style={{ color: "var(--ink-soft)", borderColor: "var(--border-strong)" }}
                          placeholder="Back"
                        />
                        <div className="mt-4 flex items-center gap-2 flex-wrap">
                          <button
                            onClick={saveCard}
                            disabled={savingCard || !editFront.trim() || !editBack.trim()}
                            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50"
                            style={{ background: "var(--ink)" }}
                          >
                            {savingCard ? "Saving…" : "Save"}
                          </button>
                          <button
                            onClick={() => { setEditingCardId(null); setSaveCardError(null); }}
                            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium transition-colors"
                            style={{ color: "var(--muted)" }}
                          >
                            Cancel
                          </button>
                          {saveCardError && (
                            <span className="font-mono text-[11px]" style={{ color: "var(--complement-deep)" }}>
                              {saveCardError}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  ) : confirmDeleteCardId === card.id ? (
                    <div className="flex items-start gap-6">
                      <span className="flex-shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] tabular-nums mt-1.5 w-8" style={{ color: "var(--soft)" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <p className="font-serif text-[20px] leading-[1.3]" style={{ color: "var(--muted)" }}>{card.front}</p>
                        <div className="mt-4 flex items-center gap-3">
                          <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--complement-deep)" }}>
                            Delete this card?
                          </span>
                          <button
                            onClick={() => deleteCard(card.id)}
                            disabled={deletingCardId === card.id}
                            className="inline-flex items-center justify-center px-3 py-1 text-xs font-medium rounded-lg text-white transition-colors disabled:opacity-50"
                            style={{ background: "var(--complement)" }}
                          >
                            {deletingCardId === card.id ? "Deleting…" : "Delete"}
                          </button>
                          <button
                            onClick={() => setConfirmDeleteCardId(null)}
                            className="inline-flex items-center justify-center px-3 py-1 text-xs font-medium transition-colors"
                            style={{ color: "var(--muted)" }}
                          >
                            Cancel
                          </button>
                        </div>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-start gap-6">
                      <span className="flex-shrink-0 font-mono text-[11px] uppercase tracking-[0.14em] tabular-nums mt-1.5 w-8" style={{ color: "var(--soft)" }}>
                        {String(i + 1).padStart(2, "0")}
                      </span>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-start justify-between gap-4">
                          <p className="font-serif text-[20px] leading-[1.3] text-[var(--ink)]">{card.front}</p>
                          <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity shrink-0 mt-0.5">
                            <button
                              onClick={() => startEditCard(card)}
                              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-2)]"
                              style={{ color: "var(--muted)" }}
                              title="Edit card"
                            >
                              <PencilIcon />
                            </button>
                            <button
                              onClick={() => { setEditingCardId(null); setConfirmDeleteCardId(card.id); }}
                              className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-2)]"
                              style={{ color: "var(--muted)" }}
                              title="Delete card"
                            >
                              <TrashIcon />
                            </button>
                          </div>
                        </div>
                        <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>{card.back}</p>

                        {chunkMap.has(card.chunk_id) && (
                          <div className="mt-4">
                            <button
                              onClick={() => setExpandedSource(expandedSource === card.id ? null : card.id)}
                              className="inline-flex items-center gap-1.5 font-mono text-[10px] uppercase tracking-[0.14em] transition-colors"
                              style={{ color: expandedSource === card.id ? "var(--accent-deep)" : "var(--soft)" }}
                            >
                              <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                                <path d={expandedSource === card.id ? "M18 15l-6-6-6 6" : "M6 9l6 6 6-6"} />
                              </svg>
                              Source
                            </button>
                            {expandedSource === card.id && (
                              <div className="mt-3 pl-3" style={{ borderLeft: "2px solid var(--accent)" }}>
                                <p className="text-[13px] leading-relaxed" style={{ color: "var(--muted)" }}>
                                  {chunkMap.get(card.chunk_id)}
                                </p>
                              </div>
                            )}
                          </div>
                        )}
                      </div>
                    </div>
                  )}
                </li>
              ))}
            </ol>
          )}
        </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, accent }: { label: string; value: number | string; accent?: boolean }) {
  return (
    <div className="px-1 py-5 first:pl-0">
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</span>
      <div className="mt-2 flex items-baseline gap-2">
        <span className="font-serif text-[40px] leading-none text-[var(--ink)]">{value}</span>
        {accent && <span className="w-2 h-2 rounded-full -translate-y-3" style={{ background: "var(--complement)" }} />}
      </div>
    </div>
  );
}
