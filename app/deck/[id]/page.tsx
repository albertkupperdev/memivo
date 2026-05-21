"use client";

import { useEffect, useRef, useState } from "react";
import { useParams, useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Card, Document, DocumentSource, Playlist } from "@/types";
import dynamic from "next/dynamic";
const DrawingCanvas = dynamic(() => import("@/components/DrawingCanvas"), { ssr: false });

async function uploadCardImage(file: File): Promise<string | null> {
  const { createClient } = await import("@/lib/supabase/client");
  const supabase = createClient();
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null;
  const ext = file.name.split(".").pop() ?? "jpg";
  const path = `${user.id}/${crypto.randomUUID()}.${ext}`;
  const { error } = await supabase.storage.from("card-images").upload(path, file, { cacheControl: "3600" });
  if (error) return null;
  return path;
}

function CardImage({ path, className = "" }: { path: string; className?: string }) {
  const [url, setUrl] = useState<string | null>(null);
  useEffect(() => {
    import("@/lib/supabase/client").then(({ createClient }) => {
      createClient().storage.from("card-images").createSignedUrl(path, 3600)
        .then(({ data }) => setUrl(data?.signedUrl ?? null));
    });
  }, [path]);
  if (!url) return <div className={`animate-pulse rounded-xl h-32 ${className}`} style={{ background: "var(--bg-2)" }} />;
  return <img src={url} alt="" className={`rounded-xl object-contain max-h-48 w-full ${className}`} />;
}

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
  const [sources, setSources] = useState<DocumentSource[]>([]);
  const [playlists, setPlaylists] = useState<Playlist[]>([]);
  const [playlistCardIds, setPlaylistCardIds] = useState<Map<string, Set<string>>>(new Map());
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
  const [confirmingReset, setConfirmingReset] = useState(false);
  const [resetting, setResetting] = useState(false);

  // Card editing
  const [editingCardId, setEditingCardId] = useState<string | null>(null);
  const [editFront, setEditFront] = useState("");
  const [editBack, setEditBack] = useState("");
  const [editHint, setEditHint] = useState("");
  const [editRequireDrawing, setEditRequireDrawing] = useState(false);
  const [editImagePath, setEditImagePath] = useState<string | null>(null);
  const [editImageFile, setEditImageFile] = useState<File | null>(null);
  const [editImagePreview, setEditImagePreview] = useState<string | null>(null);
  const [showDrawingEdit, setShowDrawingEdit] = useState(false);
  const [savingCard, setSavingCard] = useState(false);
  const [saveCardError, setSaveCardError] = useState<string | null>(null);
  const [confirmDeleteCardId, setConfirmDeleteCardId] = useState<string | null>(null);
  const [deletingCardId, setDeletingCardId] = useState<string | null>(null);

  // New card
  const [addingCard, setAddingCard] = useState(false);
  const [newFront, setNewFront] = useState("");
  const [newBack, setNewBack] = useState("");
  const [newHint, setNewHint] = useState("");
  const [newImageFile, setNewImageFile] = useState<File | null>(null);
  const [newImagePreview, setNewImagePreview] = useState<string | null>(null);
  const [showDrawingNew, setShowDrawingNew] = useState(false);
  const [newRequireDrawing, setNewRequireDrawing] = useState(false);
  const [creatingCard, setCreatingCard] = useState(false);

  // Add source
  const [addingSource, setAddingSource] = useState(false);
  const [sourceTab, setSourceTab] = useState<"pdf" | "url">("pdf");
  const [sourceFile, setSourceFile] = useState<File | null>(null);
  const [sourceUrl, setSourceUrl] = useState("");
  const [addingSourceProgress, setAddingSourceProgress] = useState(0);
  const [addingSourceTotal, setAddingSourceTotal] = useState(0);
  const [addingSourceLoading, setAddingSourceLoading] = useState(false);
  const [addingSourceError, setAddingSourceError] = useState<string | null>(null);

  // Session size
  const [sessionLimit, setSessionLimit] = useState<number | null>(null);

  // Card list UI
  const [cardSearch, setCardSearch] = useState("");
  const [viewMode, setViewMode] = useState<"list" | "grid-small" | "grid-large">("list");
  const [cardSort, setCardSort] = useState<"custom" | "front-asc" | "front-desc" | "date-new" | "date-old">("custom");

  // Card drag-to-reorder
  const [draggingCardId, setDraggingCardId] = useState<string | null>(null);
  const [dragOverCardId, setDragOverCardId] = useState<string | null>(null);
  const [dragCardBefore, setDragCardBefore] = useState(true);

  // Playlist UI
  const [creatingPlaylist, setCreatingPlaylist] = useState(false);
  const [newPlaylistName, setNewPlaylistName] = useState("");
  const [renamingPlaylistId, setRenamingPlaylistId] = useState<string | null>(null);
  const [renamePlaylistValue, setRenamePlaylistValue] = useState("");
  const [openCardPlaylistId, setOpenCardPlaylistId] = useState<string | null>(null);
  const [confirmDeletePlaylistId, setConfirmDeletePlaylistId] = useState<string | null>(null);

  // Scroll-aware header
  const [scrolled, setScrolled] = useState(false);
  const [heroHeight, setHeroHeight] = useState(0);
  const heroRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const handler = () => setScrolled(window.scrollY > 80);
    window.addEventListener("scroll", handler, { passive: true });
    return () => window.removeEventListener("scroll", handler);
  }, []);

  useEffect(() => {
    if (!heroRef.current) return;
    const ro = new ResizeObserver(([entry]) => {
      setHeroHeight(entry.borderBoxSize?.[0]?.blockSize ?? entry.contentRect.height);
    });
    ro.observe(heroRef.current);
    return () => ro.disconnect();
  }, []);

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

      const { data: docSources } = await supabase.from("document_sources").select("*").eq("document_id", id).order("created_at");
      setSources(docSources ?? []);

      const { data: pl } = await supabase.from("playlists").select("*").eq("document_id", id).order("created_at");
      setPlaylists(pl ?? []);
      if (pl && pl.length > 0) {
        const { data: pcRows } = await supabase.from("playlist_cards").select("playlist_id, card_id").in("playlist_id", pl.map(p => p.id));
        const map = new Map<string, Set<string>>();
        pl.forEach(p => map.set(p.id, new Set()));
        (pcRows ?? []).forEach(r => map.get(r.playlist_id)?.add(r.card_id));
        setPlaylistCardIds(map);
      }

      const { data: existing } = await supabase.from("cards").select("*").eq("document_id", id).order("position", { ascending: true, nullsFirst: false });
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
      if (doc.source_type === "manual") return;
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

  async function handleResetCooldowns() {
    setResetting(true);
    const res = await fetch(`/api/documents/${id}/reset-cooldowns`, { method: "POST" });
    if (res.ok) {
      setDueCount(cards.length);
      setConfirmingReset(false);
    }
    setResetting(false);
  }

  function startEditCard(card: Card) {
    setConfirmDeleteCardId(null);
    setEditingCardId(card.id);
    setEditFront(card.front);
    setEditBack(card.back);
    setEditHint(card.hint ?? "");
    setEditImagePath(card.image_url ?? null);
    setEditImageFile(null);
    setEditImagePreview(null);
    setShowDrawingEdit(false);
    setEditRequireDrawing(card.require_drawing ?? false);
  }

  async function saveCard() {
    if (!editingCardId) return;
    setSavingCard(true);
    setSaveCardError(null);
    const res = await fetch(`/api/cards/${editingCardId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ front: editFront, back: editBack, hint: editHint || null, image_url: editImageFile ? await uploadCardImage(editImageFile) : editImagePath, require_drawing: editRequireDrawing }),
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

  async function addSource() {
    const ready = sourceTab === "pdf" ? !!sourceFile : /^https?:\/\/\S+/.test(sourceUrl);
    if (!ready) return;
    setAddingSourceLoading(true);
    setAddingSourceError(null);
    setAddingSourceProgress(0);
    setAddingSourceTotal(0);

    let res: Response;
    if (sourceTab === "pdf") {
      const formData = new FormData();
      formData.append("file", sourceFile!);
      res = await fetch(`/api/documents/${id}/add-source/upload`, { method: "POST", body: formData });
    } else {
      res = await fetch(`/api/documents/${id}/add-source/url`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ url: sourceUrl }),
      });
    }

    if (!res.ok || !res.body) {
      setAddingSourceError("Failed to process source.");
      setAddingSourceLoading(false);
      return;
    }

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
          if (msg.progress !== undefined) { setAddingSourceProgress(msg.progress); setAddingSourceTotal(msg.total); }
          if (msg.error) { setAddingSourceError(msg.error); setAddingSourceLoading(false); return; }
          if (msg.done) {
            setCards((prev) => [...prev, ...msg.cards]);
            // Refresh sources list
            const supabase = (await import("@/lib/supabase/client")).createClient();
            const { data: newSources } = await supabase.from("document_sources").select("*").eq("document_id", id).order("created_at");
            setSources(newSources ?? []);
            setAddingSource(false);
            setSourceFile(null);
            setSourceUrl("");
            setAddingSourceLoading(false);
            return;
          }
        } catch { /* ignore */ }
      }
    }
    setAddingSourceLoading(false);
  }

  async function createCard(andAnother = false) {
    if (!newFront.trim() || !newBack.trim()) return;
    setCreatingCard(true);
    const res = await fetch("/api/cards", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: id, front: newFront, back: newBack, hint: newHint || null, image_url: newImageFile ? await uploadCardImage(newImageFile) : null, require_drawing: newRequireDrawing }),
    });
    if (res.ok) {
      const card = await res.json();
      setCards((prev) => [...prev, card]);
      setNewFront("");
      setNewBack("");
      setNewHint("");
      setNewImageFile(null);
      setNewImagePreview(null);
      setNewRequireDrawing(false);
      if (!andAnother) {
        setAddingCard(false);
      } else {
        setTimeout(() => window.document.getElementById("new-card-front")?.focus(), 0);
      }
    }
    setCreatingCard(false);
  }

  async function reorderCards(draggedId: string, targetId: string, before: boolean) {
    const without = cards.filter(c => c.id !== draggedId);
    const dragged = cards.find(c => c.id === draggedId)!;
    const targetIdx = without.findIndex(c => c.id === targetId);
    const insertAt = before ? targetIdx : targetIdx + 1;
    without.splice(insertAt, 0, dragged);
    const reordered = without.map((c, i) => ({ ...c, position: i }));
    setCards(reordered);
    setDraggingCardId(null);
    setDragOverCardId(null);
    await Promise.all(reordered.map(c =>
      fetch(`/api/cards/${c.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ front: c.front, back: c.back, hint: c.hint, image_url: c.image_url, position: c.position }),
      })
    ));
  }

  async function createPlaylist() {
    if (!newPlaylistName.trim()) return;
    const res = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: id, name: newPlaylistName }),
    });
    if (res.ok) {
      const pl = await res.json();
      setPlaylists(prev => [...prev, pl]);
      setPlaylistCardIds(prev => new Map(prev).set(pl.id, new Set()));
      setNewPlaylistName("");
      setCreatingPlaylist(false);
    }
  }

  async function renamePlaylist(plId: string, name: string) {
    const res = await fetch(`/api/playlists/${plId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const updated = await res.json();
      setPlaylists(prev => prev.map(p => p.id === plId ? updated : p));
      setRenamingPlaylistId(null);
    }
  }

  async function deletePlaylist(plId: string) {
    const res = await fetch(`/api/playlists/${plId}`, { method: "DELETE" });
    if (res.ok) {
      setPlaylists(prev => prev.filter(p => p.id !== plId));
      setPlaylistCardIds(prev => { const m = new Map(prev); m.delete(plId); return m; });
    }
  }

  async function toggleCardInPlaylist(plId: string, cardId: string) {
    const inPlaylist = playlistCardIds.get(plId)?.has(cardId);
    const method = inPlaylist ? "DELETE" : "POST";
    const res = await fetch(`/api/playlists/${plId}/cards`, {
      method,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ cardId }),
    });
    if (res.ok) {
      setPlaylistCardIds(prev => {
        const m = new Map(prev);
        const s = new Set(m.get(plId) ?? []);
        if (inPlaylist) { s.delete(cardId); } else { s.add(cardId); }
        m.set(plId, s);
        return m;
      });
    }
  }

  async function saveHardWords() {
    const supabase = (await import("@/lib/supabase/client")).createClient();
    const { data: reviews } = await supabase
      .from("card_reviews")
      .select("card_id, repetitions, ease_factor")
      .in("card_id", cards.map(c => c.id));
    const hardIds = (reviews ?? [])
      .filter(r => r.repetitions === 0 || r.ease_factor < 2.0)
      .map(r => r.card_id);
    if (hardIds.length === 0) return;
    const res = await fetch("/api/playlists", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ documentId: id, name: "Hard cards" }),
    });
    if (!res.ok) return;
    const pl = await res.json();
    await Promise.all(hardIds.map(cardId =>
      fetch(`/api/playlists/${pl.id}/cards`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ cardId }),
      })
    ));
    setPlaylists(prev => [...prev, pl]);
    setPlaylistCardIds(prev => new Map(prev).set(pl.id, new Set(hardIds)));
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
      {/* Fixed hero — fixed so height changes don't affect scrollY */}
      <div ref={heroRef} className="fixed left-0 right-0 z-20" style={{ top: 47, background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
        <div className={`max-w-4xl mx-auto px-6 transition-all duration-300 ${scrolled ? "py-3" : "py-7"}`}>

          {/* Sources — hidden when scrolled */}
          {!scrolled && (
            <div className="flex flex-wrap items-center gap-2">
              {/* Primary source */}
              {document?.source_type === "url" && document.source_url ? (
                <a href={document.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors hover:opacity-70" style={{ color: "var(--muted)" }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.5-1.5"/></svg>
                  {new URL(document.source_url).hostname}
                </a>
              ) : document?.source_type === "pdf" ? (
                <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                  PDF
                </span>
              ) : null}
              {/* Additional sources */}
              {sources.map((s) => (
                s.source_type === "url" && s.source_url ? (
                  <a key={s.id} href={s.source_url} target="_blank" rel="noopener noreferrer" className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors hover:opacity-70" style={{ color: "var(--muted)" }}>
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.5-1.5"/></svg>
                    {s.label ?? new URL(s.source_url).hostname}
                  </a>
                ) : (
                  <span key={s.id} className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/></svg>
                    {s.label ?? "PDF"}
                  </span>
                )
              ))}
              {/* Add source button */}
              {!addingSource && (
                <button onClick={() => setAddingSource(true)} className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors hover:opacity-70" style={{ color: "var(--accent-deep)" }}>
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                  Add source
                </button>
              )}
            </div>
          )}

          {/* Title row */}
          {renamingDeck ? (
            <div className="mt-2">
              <input
                ref={renameTitleRef}
                value={renameTitle}
                onChange={(e) => setRenameTitle(e.target.value)}
                onKeyDown={(e) => {
                  if (e.key === "Enter") saveRename();
                  if (e.key === "Escape") setRenamingDeck(false);
                }}
                className={`w-full font-serif leading-tight text-[var(--ink)] bg-transparent outline-none border-b-2 transition-all duration-300 ${scrolled ? "text-[22px]" : "text-[40px]"}`}
                style={{ borderColor: "var(--accent)" }}
                autoFocus
              />
              <div className="mt-2 flex gap-2">
                <button onClick={saveRename} disabled={savingRename || !renameTitle.trim()} className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50" style={{ background: "var(--ink)" }}>
                  {savingRename ? "Saving…" : "Save"}
                </button>
                <button onClick={() => setRenamingDeck(false)} className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium transition-colors" style={{ color: "var(--muted)" }}>
                  Cancel
                </button>
              </div>
            </div>
          ) : (
            <div className={`group flex items-baseline gap-3 ${scrolled ? "mt-0" : "mt-2"}`}>
              <h1 className={`font-serif leading-tight text-[var(--ink)] transition-all duration-300 ${scrolled ? "text-[22px]" : "text-[40px]"}`}>
                {document?.title ?? "Loading…"}
              </h1>
              {scrolled && dueCount > 0 && (
                <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                  {dueCount} due
                </span>
              )}
              {document && !scrolled && (
                <button onClick={startRename} className="opacity-0 group-hover:opacity-100 transition-opacity shrink-0" style={{ color: "var(--muted)" }} title="Rename deck">
                  <PencilIcon />
                </button>
              )}
            </div>
          )}

          {/* Stat strip — hidden when scrolled */}
          {!scrolled && (
            <div className="mt-4 grid grid-cols-3 divide-x" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
              <StatCell label="Total" value={cards.length} />
              <StatCell label="Due now" value={dueCount} accent={dueCount > 0} />
              <StatCell label="Source" value={document?.source_type?.toUpperCase() ?? "—"} />
            </div>
          )}

          {/* Action buttons */}
          <div className={`flex flex-wrap gap-2 ${scrolled ? "mt-2" : "mt-4"}`}>
            <button
              onClick={() => router.push(`/review/${id}${sessionLimit ? `?limit=${sessionLimit}` : ""}`)}
              disabled={generating || cards.length === 0}
              className={`flex-1 inline-flex items-center justify-center gap-2 font-medium rounded-xl transition-colors ${scrolled ? "px-4 py-1.5 text-[13px]" : "px-4 py-2.5 text-[14px]"}`}
              style={{
                background: generating || cards.length === 0 ? "var(--border-strong)" : "var(--ink)",
                color: generating || cards.length === 0 ? "var(--soft)" : "var(--bg)",
                cursor: generating || cards.length === 0 ? "not-allowed" : "pointer",
              }}
            >
              {generating ? "Generating…" : (
                <>
                  Start review
                  {dueCount > 0 && <span className="font-mono text-[11px] tracking-[0.14em] uppercase opacity-70">· {dueCount} due</span>}
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                  </svg>
                </>
              )}
            </button>
            {!generating && (
              <button
                onClick={() => { setAddingCard(true); setTimeout(() => { const el = window.document.getElementById("new-card-front"); el?.focus(); el?.scrollIntoView({ behavior: "smooth", block: "center" }); }, 100); }}
                className={`inline-flex items-center justify-center gap-1.5 font-medium rounded-xl transition-colors ${scrolled ? "px-3 py-1.5 text-[13px]" : "px-3 py-2.5 text-sm"}`}
                style={{ background: "var(--bg-2)", color: "var(--ink)" }}
              >
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M12 5v14"/><path d="M5 12h14"/>
                </svg>
                New card
              </button>
            )}
            {!confirming && !scrolled && (
              <>
                <button
                  onClick={() => setConfirmingReset(true)}
                  className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors"
                  style={{ color: "var(--muted)" }}
                  title="Reset cooldowns"
                >
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 12a9 9 0 1 0 9-9 9.75 9.75 0 0 0-6.74 2.74L3 8"/><path d="M3 3v5h5"/>
                  </svg>
                </button>
                <button onClick={() => setConfirming(true)} className="inline-flex items-center justify-center gap-1.5 px-3 py-2.5 text-sm font-medium rounded-xl transition-colors" style={{ color: "var(--muted)" }}>
                  <TrashIcon />
                </button>
              </>
            )}
          </div>

          {/* Session size picker — only when not scrolled and cards exist */}
          {!scrolled && dueCount > 0 && !confirming && (
            <div className="mt-3 flex items-center gap-2 flex-wrap">
              <Eyebrow>Session</Eyebrow>
              {[10, 25, 50].filter(n => n < dueCount).map(n => (
                <button
                  key={n}
                  onClick={() => setSessionLimit(sessionLimit === n ? null : n)}
                  className="font-mono text-[11px] uppercase tracking-[0.14em] px-2.5 py-1 rounded-full transition-colors"
                  style={{
                    background: sessionLimit === n ? "var(--ink)" : "var(--bg-2)",
                    color: sessionLimit === n ? "var(--bg)" : "var(--muted)",
                  }}
                >
                  {n}
                </button>
              ))}
              <button
                onClick={() => setSessionLimit(null)}
                className="font-mono text-[11px] uppercase tracking-[0.14em] px-2.5 py-1 rounded-full transition-colors"
                style={{
                  background: sessionLimit === null ? "var(--ink)" : "var(--bg-2)",
                  color: sessionLimit === null ? "var(--bg)" : "var(--muted)",
                }}
              >
                All {dueCount}
              </button>
            </div>
          )}

          {/* Reset cooldowns confirmation */}
          {confirmingReset && !scrolled && (
            <div className="mt-4 p-5 rounded-2xl" style={{ background: "var(--accent-bg)", border: "1px solid var(--accent-tint)" }}>
              <Eyebrow style={{ color: "var(--accent-deep)" }}>Refresh all card cooldowns?</Eyebrow>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                This will allow you to review all cards again. Card level progress will not be lost.
              </p>
              <div className="mt-4 flex gap-2">
                <button onClick={handleResetCooldowns} disabled={resetting}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-xl text-white transition-colors disabled:opacity-50"
                  style={{ background: "var(--ink)" }}>
                  {resetting ? "Resetting…" : "Yes, refresh"}
                </button>
                <button onClick={() => setConfirmingReset(false)}
                  className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors"
                  style={{ color: "var(--muted)" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}

          {/* Delete confirmation — only when not scrolled */}
          {confirming && !scrolled && (
            <div className="mt-4 p-5 rounded-2xl" style={{ background: "var(--complement-bg)", border: "1px solid var(--complement-border)" }}>
              <Eyebrow style={{ color: "var(--complement-deep)" }}>Delete deck?</Eyebrow>
              <p className="mt-2 text-[14px] leading-relaxed" style={{ color: "var(--complement-deeper)" }}>
                All <span className="font-medium text-[var(--ink)]">{cards.length}</span> cards and review history will be permanently removed.
              </p>
              <div className="mt-4 flex gap-2">
                <button onClick={handleDelete} disabled={deleting} className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium rounded-xl text-white transition-colors disabled:opacity-50" style={{ background: "var(--complement)" }}>
                  {deleting ? "Deleting…" : "Yes, delete"}
                </button>
                <button onClick={() => setConfirming(false)} className="inline-flex items-center justify-center px-4 py-2 text-sm font-medium transition-colors" style={{ color: "var(--muted)" }}>
                  Cancel
                </button>
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Scrollable content — padded to sit below fixed hero */}
      <div style={{ paddingTop: heroHeight }}>
      <div className="max-w-4xl mx-auto px-6 pt-8 pb-10">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 mb-8 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors"
          style={{ color: "var(--muted)" }}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 5-7 7 7 7"/>
          </svg>
          All decks
        </Link>
        {/* Playlists */}
        {(playlists.length > 0 || cards.length > 0) && (
          <div className="mb-10">
            <div className="flex items-center justify-between mb-4">
              <h2 className="font-serif text-[28px] leading-tight text-[var(--ink)]">Playlists</h2>
              <div className="flex items-center gap-3">
                <Eyebrow>{playlists.length} total</Eyebrow>
                {!creatingPlaylist && (
                  <button onClick={() => { setCreatingPlaylist(true); setNewPlaylistName(""); }}
                    className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors"
                    style={{ color: "var(--accent-deep)" }}>
                    <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M12 5v14"/><path d="M5 12h14"/></svg>
                    New playlist
                  </button>
                )}
                {cards.length > 0 && (
                  <button onClick={saveHardWords}
                    className="font-mono text-[11px] uppercase tracking-[0.14em] transition-colors"
                    style={{ color: "var(--complement-deep)" }}>
                    Save hard cards
                  </button>
                )}
              </div>
            </div>

            {creatingPlaylist && (
              <div className="mb-4 p-5 rounded-2xl bg-white" style={{ border: "1px solid var(--border)" }}>
                <input
                  value={newPlaylistName}
                  onChange={e => setNewPlaylistName(e.target.value)}
                  onKeyDown={e => { if (e.key === "Enter") createPlaylist(); if (e.key === "Escape") setCreatingPlaylist(false); }}
                  placeholder="Playlist name…"
                  className="w-full font-serif text-[20px] text-[var(--ink)] bg-transparent outline-none"
                  autoFocus
                />
                <div className="mt-3 flex gap-2">
                  <button onClick={createPlaylist} disabled={!newPlaylistName.trim()}
                    className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                    style={{ background: "var(--ink)" }}>Create</button>
                  <button onClick={() => setCreatingPlaylist(false)}
                    className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium"
                    style={{ color: "var(--muted)" }}>Cancel</button>
                </div>
              </div>
            )}

            {playlists.length === 0 ? (
              <div className="rounded-2xl p-8 text-center" style={{ border: "1px dashed var(--border-strong)" }}>
                <Eyebrow>No playlists yet — create one or save hard words</Eyebrow>
              </div>
            ) : (
              <div className="flex flex-col gap-3">
                {playlists.map(pl => {
                  const count = playlistCardIds.get(pl.id)?.size ?? 0;
                  return (
                    <div key={pl.id} className="group bg-white rounded-2xl px-6 py-4 flex flex-col gap-3" style={{ border: `1px solid ${confirmDeletePlaylistId === pl.id ? "var(--complement-border)" : "var(--border)"}`, background: confirmDeletePlaylistId === pl.id ? "var(--complement-bg)" : "white" }}>
                    {confirmDeletePlaylistId === pl.id ? (
                      <div className="flex items-center justify-between gap-4">
                        <p className="text-[14px]" style={{ color: "var(--complement-deeper)" }}>
                          Delete <span className="font-medium text-[var(--ink)]">&ldquo;{pl.name}&rdquo;</span>?
                        </p>
                        <div className="flex gap-2 shrink-0">
                          <button onClick={() => { deletePlaylist(pl.id); setConfirmDeletePlaylistId(null); }}
                            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg text-white"
                            style={{ background: "var(--complement)" }}>Delete</button>
                          <button onClick={() => setConfirmDeletePlaylistId(null)}
                            className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium"
                            style={{ color: "var(--muted)" }}>Cancel</button>
                        </div>
                      </div>
                    ) : (
                    <div className="flex items-center gap-4">
                      <svg viewBox="0 0 24 24" className="w-4 h-4 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
                        <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                      </svg>
                      <div className="flex-1 min-w-0">
                        {renamingPlaylistId === pl.id ? (
                          <input
                            value={renamePlaylistValue}
                            onChange={e => setRenamePlaylistValue(e.target.value)}
                            onKeyDown={e => { if (e.key === "Enter") renamePlaylist(pl.id, renamePlaylistValue); if (e.key === "Escape") setRenamingPlaylistId(null); }}
                            onBlur={() => { if (renamePlaylistValue.trim()) renamePlaylist(pl.id, renamePlaylistValue); else setRenamingPlaylistId(null); }}
                            className="font-serif text-[18px] text-[var(--ink)] bg-transparent outline-none border-b w-full"
                            style={{ borderColor: "var(--accent)" }}
                            autoFocus
                          />
                        ) : (
                          <span className="font-serif text-[18px] text-[var(--ink)]">{pl.name}</span>
                        )}
                        <span className="ml-3 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>{count} cards</span>
                      </div>
                      <div className="flex items-center gap-2 opacity-0 group-hover:opacity-100 transition-opacity">
                        <button onClick={() => { setRenamingPlaylistId(pl.id); setRenamePlaylistValue(pl.name); }}
                          className="p-1.5 rounded-lg hover:bg-[var(--bg-2)]" style={{ color: "var(--muted)" }} title="Rename">
                          <PencilIcon />
                        </button>
                        <button onClick={() => setConfirmDeletePlaylistId(pl.id)}
                          className="p-1.5 rounded-lg hover:bg-[var(--bg-2)]" style={{ color: "var(--muted)" }} title="Delete">
                          <TrashIcon />
                        </button>
                      </div>
                      <button
                        onClick={() => router.push(`/review/${id}?playlist=${pl.id}`)}
                        disabled={count === 0}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-[13px] font-medium rounded-xl transition-colors disabled:opacity-40"
                        style={{ background: "var(--ink)", color: "var(--bg)" }}>
                        Review
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                          <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                        </svg>
                      </button>
                    </div>
                    )}
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        )}

        {/* Add source form */}
        {addingSource && (
          <div className="mb-8 p-6 rounded-2xl bg-white" style={{ border: "1px solid var(--border)" }}>
            <div className="flex items-center justify-between mb-4">
              <Eyebrow>Add source</Eyebrow>
              <button onClick={() => { setAddingSource(false); setAddingSourceError(null); }} className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>Cancel</button>
            </div>
            <div className="inline-flex p-1 rounded-full mb-4" style={{ background: "var(--bg-2)" }}>
              {(["pdf", "url"] as const).map((t) => (
                <button key={t} onClick={() => setSourceTab(t)} className="px-4 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] rounded-full transition-colors"
                  style={sourceTab === t ? { background: "white", color: "var(--ink)", boxShadow: "0 1px 2px rgba(22,23,15,0.08)" } : { color: "var(--muted)" }}>
                  {t.toUpperCase()}
                </button>
              ))}
            </div>
            {sourceTab === "pdf" ? (
              <label className="block cursor-pointer">
                <input type="file" accept="application/pdf" className="hidden" onChange={(e) => setSourceFile(e.target.files?.[0] ?? null)} />
                <div className="w-full px-6 py-8 rounded-xl text-center" style={{ border: "1.5px dashed var(--border-strong)" }}>
                  {sourceFile ? <p className="text-[14px] font-medium text-[var(--ink)]">{sourceFile.name}</p> : <p className="text-[14px] text-[var(--muted)]">Click to select PDF</p>}
                </div>
              </label>
            ) : (
              <input type="url" placeholder="https://..." value={sourceUrl} onChange={(e) => setSourceUrl(e.target.value)}
                className="w-full px-4 py-3 text-[14px] rounded-xl outline-none"
                style={{ background: "var(--bg-2)", border: "1px solid var(--border-strong)", color: "var(--ink)" }} />
            )}
            {addingSourceLoading && (
              <div className="mt-4">
                <div className="flex justify-between mb-1">
                  <Eyebrow>{addingSourceTotal > 0 ? `${addingSourceProgress} / ${addingSourceTotal} sections` : "Processing…"}</Eyebrow>
                  {addingSourceTotal > 0 && <Eyebrow>{Math.round((addingSourceProgress / addingSourceTotal) * 100)}%</Eyebrow>}
                </div>
                <div className="h-1.5 rounded-full overflow-hidden" style={{ background: "var(--accent-bg)" }}>
                  {addingSourceTotal > 0
                    ? <div className="h-full rounded-full transition-all duration-500" style={{ width: `${Math.round((addingSourceProgress / addingSourceTotal) * 100)}%`, background: "var(--accent)" }} />
                    : <div className="h-full rounded-full animate-pulse w-full" style={{ background: "var(--accent)" }} />}
                </div>
              </div>
            )}
            {addingSourceError && <p className="mt-3 text-sm" style={{ color: "var(--complement-deep)" }}>{addingSourceError}</p>}
            {!addingSourceLoading && (
              <button onClick={addSource}
                disabled={sourceTab === "pdf" ? !sourceFile : !/^https?:\/\/\S+/.test(sourceUrl)}
                className="mt-4 w-full inline-flex items-center justify-center gap-2 px-4 py-3 text-sm font-medium rounded-xl transition-colors disabled:opacity-50"
                style={{ background: "var(--ink)", color: "var(--bg)" }}>
                Generate cards from source
              </button>
            )}
          </div>
        )}

        <div>
          <div className="flex items-center justify-between mb-4">
            <h2 className="font-serif text-[28px] leading-tight text-[var(--ink)]">All cards</h2>
            <div className="flex items-center gap-3">
              <Eyebrow>{generating ? "Generating…" : `${cards.length} total`}</Eyebrow>
              {!generating && cards.length > 0 && (
                <select
                  value={cardSort}
                  onChange={(e) => setCardSort(e.target.value as typeof cardSort)}
                  className="px-2 py-1 rounded-lg text-[12px] font-mono bg-white outline-none appearance-none cursor-pointer"
                  style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
                >
                  <option value="custom">Sort: Custom</option>
                  <option value="front-asc">Sort: A→Z</option>
                  <option value="front-desc">Sort: Z→A</option>
                  <option value="date-new">Sort: Newest</option>
                  <option value="date-old">Sort: Oldest</option>
                </select>
              )}
              {!generating && cards.length > 0 && (
                <div className="flex items-center gap-1">
                  {([
                    { mode: "list", title: "List", icon: <path d="M8 6h13M8 12h13M8 18h13M3 6h.01M3 12h.01M3 18h.01"/> },
                    { mode: "grid-small", title: "Small grid", icon: <><rect x="3" y="3" width="7" height="7"/><rect x="14" y="3" width="7" height="7"/><rect x="3" y="14" width="7" height="7"/><rect x="14" y="14" width="7" height="7"/></> },
                    { mode: "grid-large", title: "Large grid", icon: <><rect x="3" y="3" width="8" height="11"/><rect x="13" y="3" width="8" height="11"/><rect x="3" y="16" width="18" height="5"/></> },
                  ] as const).map(({ mode, title, icon }) => (
                    <button key={mode} onClick={() => setViewMode(mode)} title={title}
                      className="p-1 rounded transition-colors"
                      style={{ color: viewMode === mode ? "var(--ink)" : "var(--muted)", background: viewMode === mode ? "var(--bg-2)" : "transparent" }}>
                      <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        {icon}
                      </svg>
                    </button>
                  ))}
                </div>
              )}
            </div>
          </div>

          {!generating && cards.length > 0 && (
            <div className="relative mb-6">
              <svg viewBox="0 0 24 24" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                value={cardSearch}
                onChange={(e) => setCardSearch(e.target.value)}
                placeholder="Search cards…"
                className="w-full pl-10 pr-8 py-2.5 rounded-xl text-[14px] bg-white outline-none"
                style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
              />
              {cardSearch && (
                <button onClick={() => setCardSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M18 6 6 18M6 6l12 12"/>
                  </svg>
                </button>
              )}
            </div>
          )}

          {addingCard && (
            <div className="mb-6 p-6 rounded-2xl" style={{ border: "1px solid var(--accent-tint)", background: "var(--accent-bg)" }}>
              <Eyebrow style={{ color: "var(--accent-deep)" }}>New card</Eyebrow>
              <textarea
                id="new-card-front"
                value={newFront}
                onChange={(e) => setNewFront(e.target.value)}
                rows={2}
                placeholder="Front — question"
                className="mt-3 w-full font-serif text-[18px] leading-[1.3] text-[var(--ink)] bg-transparent outline-none border-b resize-none"
                style={{ borderColor: "var(--accent-tint)" }}
                autoFocus
              />
              <textarea
                value={newBack}
                onChange={(e) => setNewBack(e.target.value)}
                rows={3}
                placeholder="Back — answer"
                className="mt-4 w-full text-[14.5px] leading-relaxed bg-transparent outline-none border-b resize-none"
                style={{ color: "var(--ink-soft)", borderColor: "var(--accent-tint)" }}
              />
              <input
                value={newHint}
                onChange={(e) => setNewHint(e.target.value)}
                placeholder="Hint (optional)"
                className="mt-3 w-full text-[13px] bg-transparent outline-none border-b"
                style={{ color: "var(--muted)", borderColor: "var(--accent-tint)" }}
              />
              {/* Image / drawing for new card */}
              <div className="mt-4">
                {showDrawingNew ? (
                  <DrawingCanvas
                    onSave={async (blob) => {
                      const file = new File([blob], "drawing.png", { type: "image/png" });
                      setNewImageFile(file);
                      setNewImagePreview(URL.createObjectURL(blob));
                      setShowDrawingNew(false);
                    }}
                    onCancel={() => setShowDrawingNew(false)}
                  />
                ) : newImagePreview ? (
                  <div className="relative inline-block">
                    <img src={newImagePreview} alt="" className="rounded-xl max-h-36 object-contain" />
                    <button onClick={() => { setNewImageFile(null); setNewImagePreview(null); }}
                      className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                      style={{ background: "var(--complement)" }}>✕</button>
                  </div>
                ) : (
                  <div className="flex gap-3">
                    <label className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] cursor-pointer transition-colors" style={{ color: "var(--muted)" }}>
                      <input type="file" accept="image/*" className="hidden" onChange={e => {
                        const f = e.target.files?.[0] ?? null;
                        setNewImageFile(f);
                        setNewImagePreview(f ? URL.createObjectURL(f) : null);
                      }} />
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                      </svg>
                      Add image
                    </label>
                    <button onClick={() => setShowDrawingNew(true)}
                      className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors"
                      style={{ color: "var(--muted)" }}>
                      <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                      </svg>
                      Draw
                    </button>
                  </div>
                )}
              </div>

              <div className="mt-4 flex items-center justify-between gap-4">
                <span className="text-[13px]" style={{ color: "var(--muted)" }}>Draw answer mode</span>
                <button onClick={() => setNewRequireDrawing(v => !v)}
                  className="relative flex-shrink-0 w-10 h-5 rounded-full transition-colors"
                  style={{ background: newRequireDrawing ? "var(--ink)" : "var(--border-strong)" }}>
                  <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                    style={{ transform: newRequireDrawing ? "translateX(20px)" : "translateX(0)" }} />
                </button>
              </div>

              <div className="mt-4 flex gap-2 flex-wrap">
                <button
                  onClick={() => createCard(false)}
                  disabled={creatingCard || !newFront.trim() || !newBack.trim()}
                  className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg text-white transition-colors disabled:opacity-50"
                  style={{ background: "var(--ink)" }}
                >
                  {creatingCard ? "Adding…" : "Add card"}
                </button>
                <button
                  onClick={() => createCard(true)}
                  disabled={creatingCard || !newFront.trim() || !newBack.trim()}
                  className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg transition-colors disabled:opacity-50"
                  style={{ background: "var(--accent-tint)", color: "var(--accent-deep)" }}
                >
                  Save & add another
                </button>
                <button
                  onClick={() => { setAddingCard(false); setNewFront(""); setNewBack(""); }}
                  className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium transition-colors"
                  style={{ color: "var(--muted)" }}
                >
                  Cancel
                </button>
              </div>
            </div>
          )}

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
          ) : (() => {
            const q = cardSearch.trim().toLowerCase();
            const base = q
              ? cards.filter(c =>
                  c.front.toLowerCase().includes(q) ||
                  c.back.toLowerCase().includes(q) ||
                  (c.hint ?? "").toLowerCase().includes(q)
                )
              : cards;
            const filtered = [...base].sort((a, b) => {
              if (cardSort === "front-asc") return a.front.localeCompare(b.front);
              if (cardSort === "front-desc") return b.front.localeCompare(a.front);
              if (cardSort === "date-new") return b.created_at.localeCompare(a.created_at);
              if (cardSort === "date-old") return a.created_at.localeCompare(b.created_at);
              return (a.position ?? 99999) - (b.position ?? 99999);
            });
            if (q && filtered.length === 0) return (
              <div className="py-10 text-center">
                <Eyebrow>No cards match &ldquo;{cardSearch}&rdquo;</Eyebrow>
              </div>
            );
            const gridCols = viewMode === "grid-small" ? "grid grid-cols-2 lg:grid-cols-3 gap-3" : "grid grid-cols-1 sm:grid-cols-2 gap-4";
            const isGrid = viewMode === "grid-small" || viewMode === "grid-large";
            const titleSize = viewMode === "grid-small" ? "text-[15px]" : "text-[20px]";
            const bodySize = viewMode === "grid-small" ? "text-[12px]" : "text-[14.5px]";
            const pad = viewMode === "grid-small" ? "p-4" : "p-6";

            if (isGrid) return (
              <div className={gridCols}>
                {filtered.map((card) => {
                  const isDropTarget = dragOverCardId === card.id;
                  const isDragging = draggingCardId === card.id;
                  return (
                    <div
                      key={card.id}
                      className={`group relative bg-white rounded-2xl ${pad} flex flex-col`}
                      style={{
                        border: `2px solid ${isDropTarget ? (dragCardBefore ? "var(--accent)" : "var(--accent)") : "var(--border)"}`,
                        boxShadow: isDropTarget ? "inset 4px 0 0 var(--accent)" : undefined,
                        opacity: isDragging ? 0.4 : 1,
                        outline: isDropTarget ? "2px solid var(--accent)" : "none",
                        outlineOffset: -2,
                      }}
                      draggable={cardSort === "custom"}
                      onDragStart={(e) => { if (cardSort !== "custom") return; e.dataTransfer.effectAllowed = "move"; setDraggingCardId(card.id); setDragOverCardId(null); }}
                      onDragEnd={() => { setDraggingCardId(null); setDragOverCardId(null); }}
                      onDragOver={(e) => { if (cardSort !== "custom") return; e.preventDefault(); const rect = e.currentTarget.getBoundingClientRect(); setDragOverCardId(card.id); setDragCardBefore(e.clientX < rect.left + rect.width / 2); }}
                      onDrop={(e) => { e.preventDefault(); if (cardSort === "custom" && draggingCardId && draggingCardId !== card.id) reorderCards(draggingCardId, card.id, dragCardBefore); }}
                    >
                      {/* Grip + actions row */}
                      <div className="flex items-center justify-between mb-2">
                        {cardSort === "custom" ? (
                          <svg viewBox="0 0 10 16" className="w-2.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing flex-shrink-0" fill="currentColor" style={{ color: "var(--border-strong)" }}>
                            <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
                            <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                            <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
                          </svg>
                        ) : <span />}
                        <div className="flex gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                          <button onClick={() => startEditCard(card)} className="p-1 rounded hover:bg-[var(--bg-2)]" style={{ color: "var(--muted)" }} title="Edit"><PencilIcon /></button>
                          <button onClick={() => { setEditingCardId(null); setConfirmDeleteCardId(card.id); }} className="p-1 rounded hover:bg-[var(--bg-2)]" style={{ color: "var(--muted)" }} title="Delete"><TrashIcon /></button>
                          {playlists.length > 0 && (
                            <button onClick={() => setOpenCardPlaylistId(openCardPlaylistId === card.id ? null : card.id)} className="p-1 rounded hover:bg-[var(--bg-2)]" style={{ color: openCardPlaylistId === card.id ? "var(--accent-deep)" : "var(--muted)" }} title="Playlists">
                              <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/></svg>
                            </button>
                          )}
                        </div>
                      </div>

                      {/* Edit mode */}
                      {editingCardId === card.id ? (
                        <div className="flex flex-col gap-2 flex-1">
                          <textarea value={editFront} onChange={e => setEditFront(e.target.value)} rows={2} placeholder="Front" className={`w-full font-serif ${titleSize} bg-transparent outline-none border-b resize-none`} style={{ borderColor: "var(--border-strong)", color: "var(--ink)" }} />
                          <textarea value={editBack} onChange={e => setEditBack(e.target.value)} rows={3} placeholder="Back" className={`w-full ${bodySize} bg-transparent outline-none border-b resize-none`} style={{ borderColor: "var(--border-strong)", color: "var(--ink-soft)" }} />
                          <input value={editHint} onChange={e => setEditHint(e.target.value)} placeholder="Hint (optional)" className="w-full text-[12px] bg-transparent outline-none border-b" style={{ borderColor: "var(--border-strong)", color: "var(--muted)" }} />
                          <div className="mt-2 flex gap-2">
                            <button onClick={saveCard} disabled={savingCard || !editFront.trim() || !editBack.trim()} className="px-2.5 py-1 text-xs font-medium rounded-lg text-white disabled:opacity-50" style={{ background: "var(--ink)" }}>{savingCard ? "…" : "Save"}</button>
                            <button onClick={() => { setEditingCardId(null); setSaveCardError(null); }} className="px-2.5 py-1 text-xs font-medium" style={{ color: "var(--muted)" }}>Cancel</button>
                          </div>
                          {saveCardError && <span className="text-[11px]" style={{ color: "var(--complement-deep)" }}>{saveCardError}</span>}
                        </div>
                      ) : confirmDeleteCardId === card.id ? (
                        <div className="flex-1">
                          <p className="text-[13px] font-medium text-[var(--ink)] mb-3">{card.front}</p>
                          <div className="flex gap-2">
                            <button onClick={() => deleteCard(card.id)} disabled={deletingCardId === card.id} className="px-2.5 py-1 text-xs font-medium rounded-lg text-white disabled:opacity-50" style={{ background: "var(--complement)" }}>{deletingCardId === card.id ? "…" : "Delete"}</button>
                            <button onClick={() => setConfirmDeleteCardId(null)} className="px-2.5 py-1 text-xs font-medium" style={{ color: "var(--muted)" }}>Cancel</button>
                          </div>
                        </div>
                      ) : (
                        <div className="flex flex-col gap-2 flex-1">
                          {card.image_url && <CardImage path={card.image_url} />}
                          <p className={`font-serif ${titleSize} leading-snug text-[var(--ink)]`}>{card.front}</p>
                          <p className={`${bodySize} leading-relaxed`} style={{ color: "var(--ink-soft)" }}>{card.back}</p>
                          {card.hint && <p className="text-[11px]" style={{ color: "var(--muted)" }}><span className="font-mono text-[10px] uppercase tracking-[0.14em] mr-1" style={{ color: "var(--soft)" }}>Hint</span>{card.hint}</p>}
                        </div>
                      )}

                      {/* Playlist picker */}
                      {openCardPlaylistId === card.id && playlists.length > 0 && (
                        <div className="mt-2 flex flex-wrap gap-1.5">
                          {playlists.map(pl => {
                            const inPl = playlistCardIds.get(pl.id)?.has(card.id);
                            return (
                              <button key={pl.id} onClick={() => toggleCardInPlaylist(pl.id, card.id)}
                                className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full transition-colors"
                                style={{ background: inPl ? "var(--ink)" : "var(--bg-2)", color: inPl ? "var(--bg)" : "var(--muted)" }}>
                                {inPl ? "✓ " : "+ "}{pl.name}
                              </button>
                            );
                          })}
                        </div>
                      )}
                    </div>
                  );
                })}
              </div>
            );
            return (
            <ol className="flex flex-col">
              {filtered.map((card, i) => (
                <li
                  key={card.id}
                  className="group relative py-7"
                  style={{ borderTop: `2px solid ${dragOverCardId === card.id && dragCardBefore ? "var(--accent)" : "var(--border)"}`, ...(i === filtered.length - 1 ? { borderBottom: `2px solid ${dragOverCardId === card.id && !dragCardBefore ? "var(--accent)" : "var(--border)"}` } : {}), opacity: draggingCardId === card.id ? 0.4 : 1 }}
                  draggable={cardSort === "custom"}
                  onDragStart={(e) => { if (cardSort !== "custom") return; e.dataTransfer.effectAllowed = "move"; setDraggingCardId(card.id); setDragOverCardId(null); }}
                  onDragEnd={() => { setDraggingCardId(null); setDragOverCardId(null); }}
                  onDragOver={(e) => { if (cardSort !== "custom") return; e.preventDefault(); const rect = e.currentTarget.getBoundingClientRect(); setDragOverCardId(card.id); setDragCardBefore(e.clientY < rect.top + rect.height / 2); }}
                  onDrop={(e) => { e.preventDefault(); if (cardSort === "custom" && draggingCardId && draggingCardId !== card.id) reorderCards(draggingCardId, card.id, dragCardBefore); }}
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
                        <input
                          value={editHint}
                          onChange={(e) => setEditHint(e.target.value)}
                          className="w-full mt-3 text-[13px] bg-transparent outline-none border-b"
                          style={{ color: "var(--muted)", borderColor: "var(--border-strong)" }}
                          placeholder="Hint (optional)"
                        />
                        {/* Image / drawing for edit */}
                        <div className="mt-3">
                          {showDrawingEdit ? (
                            <DrawingCanvas
                              onSave={async (blob) => {
                                const file = new File([blob], "drawing.png", { type: "image/png" });
                                setEditImageFile(file);
                                setEditImagePreview(URL.createObjectURL(blob));
                                setEditImagePath(null);
                                setShowDrawingEdit(false);
                              }}
                              onCancel={() => setShowDrawingEdit(false)}
                            />
                          ) : editImagePreview ? (
                            <div className="relative inline-block">
                              <img src={editImagePreview} alt="" className="rounded-xl max-h-32 object-contain" />
                              <button onClick={() => { setEditImageFile(null); setEditImagePreview(null); setEditImagePath(null); }}
                                className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                                style={{ background: "var(--complement)" }}>✕</button>
                            </div>
                          ) : editImagePath ? (
                            <div className="relative inline-block">
                              <CardImage path={editImagePath} className="max-h-32" />
                              <button onClick={() => setEditImagePath(null)}
                                className="absolute -top-2 -right-2 w-5 h-5 rounded-full flex items-center justify-center text-white text-xs"
                                style={{ background: "var(--complement)" }}>✕</button>
                            </div>
                          ) : (
                            <div className="flex gap-3">
                              <label className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] cursor-pointer" style={{ color: "var(--muted)" }}>
                                <input type="file" accept="image/*" className="hidden" onChange={e => {
                                  const f = e.target.files?.[0] ?? null;
                                  setEditImageFile(f);
                                  setEditImagePreview(f ? URL.createObjectURL(f) : null);
                                }} />
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <rect x="3" y="3" width="18" height="18" rx="2"/><circle cx="8.5" cy="8.5" r="1.5"/><path d="m21 15-5-5L5 21"/>
                                </svg>
                                Add image
                              </label>
                              <button onClick={() => setShowDrawingEdit(true)}
                                className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors"
                                style={{ color: "var(--muted)" }}>
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/>
                                </svg>
                                Draw
                              </button>
                            </div>
                          )}
                        </div>
                        <div className="mt-4 flex items-center justify-between gap-4">
                          <span className="text-[13px]" style={{ color: "var(--muted)" }}>Draw answer mode</span>
                          <button onClick={() => setEditRequireDrawing(v => !v)}
                            className="relative flex-shrink-0 w-10 h-5 rounded-full transition-colors"
                            style={{ background: editRequireDrawing ? "var(--ink)" : "var(--border-strong)" }}>
                            <span className="absolute top-0.5 left-0.5 w-4 h-4 rounded-full bg-white shadow transition-transform"
                              style={{ transform: editRequireDrawing ? "translateX(20px)" : "translateX(0)" }} />
                          </button>
                        </div>
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
                      <div className="flex-shrink-0 flex flex-col items-center gap-1.5 mt-1.5 w-8">
                        <svg viewBox="0 0 10 16" className="w-2.5 h-3.5 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" fill="currentColor" style={{ color: "var(--border-strong)" }}>
                          <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
                          <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                          <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
                        </svg>
                        <span className="font-mono text-[11px] uppercase tracking-[0.14em] tabular-nums" style={{ color: "var(--soft)" }}>
                          {String(i + 1).padStart(2, "0")}
                        </span>
                      </div>
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
                            {playlists.length > 0 && (
                              <button
                                onClick={() => setOpenCardPlaylistId(openCardPlaylistId === card.id ? null : card.id)}
                                className="p-1.5 rounded-lg transition-colors hover:bg-[var(--bg-2)]"
                                style={{ color: openCardPlaylistId === card.id ? "var(--accent-deep)" : "var(--muted)" }}
                                title="Add to playlist"
                              >
                                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                                  <path d="M9 18V5l12-2v13"/><circle cx="6" cy="18" r="3"/><circle cx="18" cy="16" r="3"/>
                                </svg>
                              </button>
                            )}
                          </div>
                        </div>
                        {openCardPlaylistId === card.id && playlists.length > 0 && (
                          <div className="mt-2 flex flex-wrap gap-1.5">
                            {playlists.map(pl => {
                              const inPl = playlistCardIds.get(pl.id)?.has(card.id);
                              return (
                                <button key={pl.id} onClick={() => toggleCardInPlaylist(pl.id, card.id)}
                                  className="inline-flex items-center gap-1 font-mono text-[10px] uppercase tracking-[0.14em] px-2 py-1 rounded-full transition-colors"
                                  style={{ background: inPl ? "var(--ink)" : "var(--bg-2)", color: inPl ? "var(--bg)" : "var(--muted)" }}>
                                  {inPl ? "✓ " : "+ "}{pl.name}
                                </button>
                              );
                            })}
                          </div>
                        )}
                        {card.image_url && <CardImage path={card.image_url} className="mt-3" />}
                        <p className="mt-3 text-[14.5px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>{card.back}</p>

                        {card.hint && (
                          <p className="mt-2 text-[13px]" style={{ color: "var(--muted)" }}>
                            <span className="font-mono text-[10px] uppercase tracking-[0.14em] mr-1.5" style={{ color: "var(--soft)" }}>Hint</span>
                            {card.hint}
                          </p>
                        )}

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
            );
          })()}
        </div>
      </div>
      </div>
    </div>
  );
}

function StatCell({ label, value, accent, compact }: { label: string; value: number | string; accent?: boolean; compact?: boolean }) {
  return (
    <div className={`px-1 first:pl-0 ${compact ? "py-2.5" : "py-5"}`}>
      <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{label}</span>
      <div className="mt-1 flex items-baseline gap-2">
        <span className={`font-serif leading-none text-[var(--ink)] ${compact ? "text-[28px]" : "text-[40px]"}`}>{value}</span>
        {accent && <span className={`w-2 h-2 rounded-full ${compact ? "-translate-y-2" : "-translate-y-3"}`} style={{ background: "var(--complement)" }} />}
      </div>
    </div>
  );
}
