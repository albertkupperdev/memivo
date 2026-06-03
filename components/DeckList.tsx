"use client";

import { useRef, useState, useEffect } from "react";
import { DECK_LEVEL_NAMES } from "@/lib/levels";
import Link from "next/link";
import { useRouter } from "next/navigation";
import DocumentUploader from "@/components/DocumentUploader";
import { createClient } from "@/lib/supabase/client";
import type { Document, Folder } from "@/types";

interface DeckWithStats extends Document {
  cardCount: number;
  dueCount: number;
  deckLevel: number;
  deckXp: number;
}

type SortBy = "custom" | "name-asc" | "name-desc" | "date-new" | "date-old" | "due";

interface Props {
  decks: DeckWithStats[];
  folders: Folder[];
  streak: number;
  totalXp: number;
}

function Eyebrow({ children, className = "", style }: { children: React.ReactNode; className?: string; style?: React.CSSProperties }) {
  return (
    <span className={`font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)] ${className}`} style={style}>
      {children}
    </span>
  );
}

function applySortBy(list: DeckWithStats[], sortBy: SortBy): DeckWithStats[] {
  const s = [...list];
  switch (sortBy) {
    case "custom":    return s.sort((a, b) => (a.position ?? 99999) - (b.position ?? 99999));
    case "name-asc":  return s.sort((a, b) => a.title.localeCompare(b.title));
    case "name-desc": return s.sort((a, b) => b.title.localeCompare(a.title));
    case "date-new":  return s.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "date-old":  return s.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case "due":       return s.sort((a, b) => b.dueCount - a.dueCount);
  }
}

function applyFolderSortBy(list: Folder[], sortBy: SortBy, decks: DeckWithStats[]): Folder[] {
  const s = [...list];
  switch (sortBy) {
    case "custom":    return s;
    case "name-asc":  return s.sort((a, b) => a.name.localeCompare(b.name));
    case "name-desc": return s.sort((a, b) => b.name.localeCompare(a.name));
    case "date-new":  return s.sort((a, b) => b.created_at.localeCompare(a.created_at));
    case "date-old":  return s.sort((a, b) => a.created_at.localeCompare(b.created_at));
    case "due":       return s.sort((a, b) => {
      const dueA = decks.filter(d => d.folder_id === a.id).reduce((sum, d) => sum + d.dueCount, 0);
      const dueB = decks.filter(d => d.folder_id === b.id).reduce((sum, d) => sum + d.dueCount, 0);
      return dueB - dueA;
    });
  }
}

export default function DeckList({ decks: initialDecks, folders: initialFolders, streak, totalXp }: Props) {
  const router = useRouter();
  const [decks, setDecks] = useState(initialDecks);
  const [folders, setFolders] = useState(initialFolders);

  useEffect(() => { setDecks(initialDecks); }, [initialDecks]);
  useEffect(() => { setFolders(initialFolders); }, [initialFolders]);
  const [showUploader, setShowUploader] = useState(initialDecks.length === 0);
  const [sortBy, setSortBy] = useState<SortBy>("custom");

  // Folder creation
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [newFolderName, setNewFolderName] = useState("");
  const [savingFolder, setSavingFolder] = useState(false);

  // Folder rename
  const [renamingFolderId, setRenamingFolderId] = useState<string | null>(null);
  const [renameValue, setRenameValue] = useState("");

  // Deck actions
  const [openMoveId, setOpenMoveId] = useState<string | null>(null);
  const [confirmDeleteDeckId, setConfirmDeleteDeckId] = useState<string | null>(null);

  // Drag and drop
  const [draggingDeckId, setDraggingDeckId] = useState<string | null>(null);
  const [dragOverTarget, setDragOverTarget] = useState<string | null>(null);
  const [dragOverDeckId, setDragOverDeckId] = useState<string | null>(null);
  const [dragInsertBefore, setDragInsertBefore] = useState(true);
  const draggingRef = useRef<string | null>(null);
  const dragOverDeckRef = useRef<string | null>(null);
  const dragInsertBeforeRef = useRef(true);

  // Collapsed folders
  const [closedFolderIds, setClosedFolderIds] = useState<Set<string>>(new Set());

  // Search
  const [query, setQuery] = useState("");

  // Hero scroll
  const heroRef = useRef<HTMLDivElement>(null);
  const [heroHeight, setHeroHeight] = useState(0);
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    if (!heroRef.current) return;
    const obs = new ResizeObserver(() => setHeroHeight(heroRef.current?.offsetHeight ?? 0));
    obs.observe(heroRef.current);
    return () => obs.disconnect();
  }, []);

  useEffect(() => {
    const onScroll = () => setScrolled(window.scrollY > 10);
    window.addEventListener("scroll", onScroll, { passive: true });
    return () => window.removeEventListener("scroll", onScroll);
  }, []);

  const totalDue = decks.reduce((acc, d) => acc + d.dueCount, 0);
  const totalCards = decks.reduce((acc, d) => acc + d.cardCount, 0);

  async function handleSignOut() {
    const supabase = createClient();
    await supabase.auth.signOut();
    router.push("/login");
  }

  async function createFolder() {
    if (!newFolderName.trim()) return;
    setSavingFolder(true);
    const res = await fetch("/api/folders", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name: newFolderName }),
    });
    if (res.ok) {
      const folder = await res.json();
      setFolders((prev) => [...prev, folder]);
      setNewFolderName("");
      setCreatingFolder(false);
    }
    setSavingFolder(false);
  }

  async function renameFolder(id: string, name: string) {
    const res = await fetch(`/api/folders/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ name }),
    });
    if (res.ok) {
      const updated = await res.json();
      setFolders((prev) => prev.map((f) => (f.id === id ? updated : f)));
      setRenamingFolderId(null);
    }
  }

  async function deleteFolder(id: string) {
    const res = await fetch(`/api/folders/${id}`, { method: "DELETE" });
    if (res.ok) {
      setFolders((prev) => prev.filter((f) => f.id !== id));
      setDecks((prev) => prev.map((d) => d.folder_id === id ? { ...d, folder_id: null } : d));
    }
  }

  async function moveDeck(deckId: string, folderId: string | null) {
    setOpenMoveId(null);
    setDecks((prev) => prev.map((d) => d.id === deckId ? { ...d, folder_id: folderId } : d));
    await fetch(`/api/documents/${deckId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ folder_id: folderId }),
    });
  }

  async function togglePinDeck(deckId: string) {
    const deck = decks.find((d) => d.id === deckId);
    if (!deck) return;
    const is_pinned = !deck.is_pinned;
    setDecks((prev) => prev.map((d) => d.id === deckId ? { ...d, is_pinned } : d));
    await fetch(`/api/documents/${deckId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_pinned }),
    });
  }

  async function togglePinFolder(folderId: string) {
    const folder = folders.find((f) => f.id === folderId);
    if (!folder) return;
    const is_pinned = !folder.is_pinned;
    setFolders((prev) => prev.map((f) => f.id === folderId ? { ...f, is_pinned } : f));
    await fetch(`/api/folders/${folderId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ is_pinned }),
    });
  }

  async function deleteDeck(deckId: string) {
    setDecks((prev) => prev.filter((d) => d.id !== deckId));
    setConfirmDeleteDeckId(null);
    await fetch(`/api/documents/${deckId}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleted_at: new Date().toISOString() }),
    });
  }

  async function reorderSection(sectionDecks: DeckWithStats[], draggedId: string, targetId: string, before: boolean) {
    const without = sectionDecks.filter((d) => d.id !== draggedId);
    const dragged = sectionDecks.find((d) => d.id === draggedId)!;
    const targetIdx = without.findIndex((d) => d.id === targetId);
    const insertAt = before ? targetIdx : targetIdx + 1;
    without.splice(insertAt, 0, dragged);
    const reordered = without.map((d, i) => ({ ...d, position: i }));
    setDecks((prev) => {
      const map = new Map(reordered.map((d) => [d.id, d]));
      return prev.map((d) => map.get(d.id) ?? d);
    });
    await Promise.all(reordered.map((d) =>
      fetch(`/api/documents/${d.id}`, {
        method: "PATCH",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ position: d.position }),
      })
    ));
  }

  function handleDeckDrop(sectionDecks: DeckWithStats[], targetDeckId: string) {
    const draggedId = draggingRef.current;
    const before = dragInsertBeforeRef.current;
    if (!draggedId || draggedId === targetDeckId) return;
    const dragged = decks.find((d) => d.id === draggedId);
    const target = decks.find((d) => d.id === targetDeckId);
    if (!dragged || !target) return;
    if (dragged.folder_id === target.folder_id && sortBy === "custom") {
      reorderSection(sectionDecks, draggedId, targetDeckId, before);
    } else if (dragged.folder_id !== target.folder_id) {
      moveDeck(draggedId, target.folder_id);
    }
    draggingRef.current = null;
    dragOverDeckRef.current = null;
    setDragOverDeckId(null);
    setDraggingDeckId(null);
  }

  const q = query.trim().toLowerCase();
  const filteredDecks = q ? decks.filter((d) => d.title.toLowerCase().includes(q)) : decks;
  const filteredFolders = q
    ? folders.filter((f) => f.name.toLowerCase().includes(q) || filteredDecks.some((d) => d.folder_id === f.id))
    : folders;
  const unfiledSorted = applySortBy(filteredDecks.filter((d) => !d.folder_id), sortBy);
  const unfiledDecks = [...unfiledSorted.filter(d => d.is_pinned), ...unfiledSorted.filter(d => !d.is_pinned)];
  const foldersSorted = applyFolderSortBy(filteredFolders, sortBy, filteredDecks);
  const sortedFolders = [...foldersSorted.filter(f => f.is_pinned), ...foldersSorted.filter(f => !f.is_pinned)];
  const folderMap = new Map(folders.map((f) => [f.id, f]));

  return (
    <div className="flex-1 w-full">

      {/* Fixed hero */}
      <div ref={heroRef} className="fixed left-0 right-0 z-20" style={{ top: 47, background: "var(--bg)", borderBottom: "1px solid var(--border)" }}>
        <div className={`max-w-4xl mx-auto px-6 duration-300 transition-[padding] ${scrolled ? "py-3" : "py-10"}`}>

          {/* Top row — always visible */}
          <div className="flex items-center justify-between gap-4 mb-2">
            <Eyebrow>Library · {new Date().getFullYear()}</Eyebrow>
            <div className="flex items-center gap-2">
              <Link href="/trash" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] rounded-full transition-colors" style={{ color: "var(--muted)" }}>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                Trash
              </Link>
              <Link href="/settings" className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] rounded-full transition-colors" style={{ color: "var(--muted)" }}>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12.22 2h-.44a2 2 0 0 0-2 2v.18a2 2 0 0 1-1 1.73l-.43.25a2 2 0 0 1-2 0l-.15-.08a2 2 0 0 0-2.73.73l-.22.38a2 2 0 0 0 .73 2.73l.15.1a2 2 0 0 1 1 1.72v.51a2 2 0 0 1-1 1.74l-.15.09a2 2 0 0 0-.73 2.73l.22.38a2 2 0 0 0 2.73.73l.15-.08a2 2 0 0 1 2 0l.43.25a2 2 0 0 1 1 1.73V20a2 2 0 0 0 2 2h.44a2 2 0 0 0 2-2v-.18a2 2 0 0 1 1-1.73l.43-.25a2 2 0 0 1 2 0l.15.08a2 2 0 0 0 2.73-.73l.22-.39a2 2 0 0 0-.73-2.73l-.15-.08a2 2 0 0 1-1-1.74v-.5a2 2 0 0 1 1-1.74l.15-.09a2 2 0 0 0 .73-2.73l-.22-.38a2 2 0 0 0-2.73-.73l-.15.08a2 2 0 0 1-2 0l-.43-.25a2 2 0 0 1-1-1.73V4a2 2 0 0 0-2-2z"/><circle cx="12" cy="12" r="3"/></svg>
                Settings
              </Link>
              <button onClick={handleSignOut} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 font-mono text-[11px] uppercase tracking-[0.14em] rounded-full transition-colors" style={{ color: "var(--muted)" }}>
                <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M9 21H5a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h4"/><path d="M16 17l5-5-5-5"/><path d="M21 12H9"/></svg>
                Sign out
              </button>
            </div>
          </div>

          {/* Title — always visible, shrinks on scroll */}
          <h1 className={`font-serif leading-[1.0] text-[var(--ink)] duration-300 transition-[font-size] ${scrolled ? "text-[24px]" : "text-[56px]"}`}>
            Your <em className="not-italic" style={{ color: "var(--accent-deep)" }}>decks</em>.
          </h1>

          {/* Stats + streak — hidden when scrolled */}
          {!scrolled && (
            <>
              <div className="mt-7 grid grid-cols-3 divide-x" style={{ borderTop: "1px solid var(--border)", borderBottom: "1px solid var(--border)" }}>
                <StatCell label="Decks" value={decks.length} />
                <StatCell label="Cards" value={totalCards} />
                <StatCell label="Due now" value={totalDue} accent={totalDue > 0} />
              </div>
              {(streak > 0 || totalXp > 0) && (
                <div className="mt-4 flex items-center gap-4">
                  {streak > 0 && (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.12em]" style={{ color: "var(--ink)" }}>
                      🔥 <span className="font-serif text-[18px]">{streak}</span> day streak
                    </span>
                  )}
                  {totalXp > 0 && (
                    <span className="inline-flex items-center gap-1.5 font-mono text-[12px] uppercase tracking-[0.12em]" style={{ color: "var(--accent-deep)" }}>
                      ⚡ <span className="font-serif text-[18px]">{totalXp.toLocaleString()}</span> XP
                    </span>
                  )}
                </div>
              )}
            </>
          )}

          {/* Search + sort — always visible */}
          <div className={`flex gap-2 ${scrolled ? "mt-2" : "mt-5"}`}>
            <div className="relative flex-1">
              <svg viewBox="0 0 24 24" className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 pointer-events-none" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: "var(--muted)" }}>
                <circle cx="11" cy="11" r="8"/><path d="m21 21-4.35-4.35"/>
              </svg>
              <input
                value={query}
                onChange={(e) => setQuery(e.target.value)}
                placeholder="Search decks and folders…"
                className="w-full pl-10 pr-8 py-2.5 rounded-xl text-[14px] bg-white outline-none"
                style={{ border: "1px solid var(--border)", color: "var(--ink)" }}
              />
              {query && (
                <button onClick={() => setQuery("")} className="absolute right-3 top-1/2 -translate-y-1/2" style={{ color: "var(--muted)" }}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round"><path d="M18 6 6 18M6 6l12 12"/></svg>
                </button>
              )}
            </div>
            <select
              value={sortBy}
              onChange={(e) => setSortBy(e.target.value as SortBy)}
              className="pl-3 pr-3 py-2.5 rounded-xl text-[13px] font-mono bg-white outline-none appearance-none cursor-pointer"
              style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              <option value="custom">Sort by: Custom</option>
              <option value="name-asc">Sort by: Name A→Z</option>
              <option value="name-desc">Sort by: Name Z→A</option>
              <option value="date-new">Sort by: Newest</option>
              <option value="date-old">Sort by: Oldest</option>
              <option value="due">Sort by: Most due</option>
            </select>
          </div>
        </div>
      </div>

      {/* Scrollable content */}
      <div className="duration-300 transition-[padding-top]" style={{ paddingTop: heroHeight }}>
      <div className="max-w-4xl mx-auto px-6 pt-8 pb-40">

        {/* Actions */}
        <div className="mb-8 flex gap-2">
          {!showUploader && (
            <button
              onClick={() => setShowUploader(true)}
              className="flex-1 group inline-flex items-center justify-between gap-3 px-5 py-4 text-[15px] font-medium text-[var(--ink)] bg-white rounded-2xl transition-colors"
              style={{ border: "1.5px dashed var(--border-strong)" }}
            >
              <span className="inline-flex items-center gap-3">
                <span className="w-7 h-7 rounded-full flex items-center justify-center" style={{ background: "var(--accent-bg)", color: "var(--accent-deep)" }}>
                  <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 5v14M5 12h14"/>
                  </svg>
                </span>
                New deck
              </span>
              <Eyebrow className="opacity-60">PDF or URL</Eyebrow>
            </button>
          )}
          {!creatingFolder && (
            <button
              onClick={() => { setCreatingFolder(true); setNewFolderName(""); }}
              className="inline-flex items-center gap-1.5 px-4 py-4 text-sm font-medium rounded-2xl transition-colors bg-white"
              style={{ border: "1px solid var(--border)", color: "var(--muted)" }}
            >
              <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                <path d="M12 11v6M9 14h6"/>
              </svg>
              New folder
            </button>
          )}
        </div>

        {showUploader && (
          <div className="mb-8">
            <DocumentUploader onCancel={decks.length > 0 ? () => setShowUploader(false) : undefined} />
          </div>
        )}

        {creatingFolder && (
          <div className="mb-6 p-5 rounded-2xl bg-white" style={{ border: "1px solid var(--border)" }}>
            <Eyebrow>New folder</Eyebrow>
            <input
              value={newFolderName}
              onChange={(e) => setNewFolderName(e.target.value)}
              onKeyDown={(e) => { if (e.key === "Enter") createFolder(); if (e.key === "Escape") setCreatingFolder(false); }}
              placeholder="Folder name…"
              className="mt-2 w-full font-serif text-[22px] text-[var(--ink)] bg-transparent outline-none"
              autoFocus
            />
            <div className="mt-3 flex gap-2">
              <button onClick={createFolder} disabled={savingFolder || !newFolderName.trim()} className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-50" style={{ background: "var(--ink)" }}>
                {savingFolder ? "Creating…" : "Create"}
              </button>
              <button onClick={() => setCreatingFolder(false)} className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium" style={{ color: "var(--muted)" }}>
                Cancel
              </button>
            </div>
          </div>
        )}

        {q && filteredDecks.length === 0 && filteredFolders.length === 0 ? (
          <div className="py-12 text-center">
            <Eyebrow>No results for &ldquo;{query}&rdquo;</Eyebrow>
          </div>
        ) : decks.length === 0 && folders.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid var(--border)" }}>
            <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-6" style={{ background: "var(--accent-bg)", color: "var(--accent-deep)" }}>
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M12 5v14M5 12h14"/>
              </svg>
            </div>
            <h3 className="font-serif text-[28px] leading-tight text-[var(--ink)]">
              Nothing here <em className="not-italic" style={{ color: "var(--accent-deep)" }}>yet</em>.
            </h3>
            <p className="mt-3 text-[15px] max-w-xs mx-auto leading-relaxed" style={{ color: "var(--ink-soft)" }}>
              Upload a PDF or paste a URL above. We&apos;ll write the cards in under a minute.
            </p>
          </div>
        ) : (
          <div className="flex flex-col gap-8">
            {sortedFolders.length > 0 && (
              <div className="flex items-center gap-2 -mb-2">
                <Eyebrow>Folders</Eyebrow>
                <span className="font-mono text-[11px]" style={{ color: "var(--border-strong)" }}>·</span>
                <Eyebrow>{sortedFolders.length}</Eyebrow>
              </div>
            )}
            {sortedFolders.map((folder) => {
              const folderDecks = applySortBy(filteredDecks.filter((d) => d.folder_id === folder.id), sortBy);
              const isOver = dragOverTarget === folder.id;
              const isClosed = closedFolderIds.has(folder.id);
              return (
                <div
                  key={folder.id}
                  onDragOver={(e) => { e.preventDefault(); dragOverDeckRef.current = null; setDragOverDeckId(null); setDragOverTarget(folder.id); }}
                  onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDragOverTarget(null); dragOverDeckRef.current = null; setDragOverDeckId(null); } }}
                  onDrop={(e) => {
                    e.preventDefault();
                    if (dragOverDeckRef.current) return;
                    const id = draggingRef.current;
                    if (id) moveDeck(id, folder.id);
                    draggingRef.current = null;
                    setDragOverTarget(null);
                    setDraggingDeckId(null);
                  }}
                  className="bg-white rounded-2xl overflow-hidden transition-all duration-150"
                  style={{ border: `1.5px solid ${isOver ? "var(--accent)" : "var(--border)"}`, boxShadow: isOver ? "0 0 0 3px var(--accent-bg)" : undefined }}
                >
                  {/* Folder header */}
                  <div className="group flex items-center gap-4 px-6 py-5">
                    <div className="w-10 h-10 rounded-xl flex items-center justify-center flex-shrink-0" style={{ background: isOver ? "var(--accent-bg)" : "var(--bg-2)" }}>
                      <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" style={{ color: isOver ? "var(--accent-deep)" : "var(--muted)" }}>
                        <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                      </svg>
                    </div>

                    <div className="flex-1 min-w-0">
                      {renamingFolderId === folder.id ? (
                        <input
                          value={renameValue}
                          onChange={(e) => setRenameValue(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === "Enter") renameFolder(folder.id, renameValue);
                            if (e.key === "Escape") setRenamingFolderId(null);
                          }}
                          onBlur={() => { if (renameValue.trim()) renameFolder(folder.id, renameValue); else setRenamingFolderId(null); }}
                          className="w-full font-serif text-[20px] leading-tight bg-transparent outline-none border-b"
                          style={{ borderColor: "var(--accent)", color: "var(--ink)" }}
                          autoFocus
                        />
                      ) : (
                        <h3 className="font-serif text-[20px] leading-tight text-[var(--ink)] truncate">{folder.name}</h3>
                      )}
                      <p className="mt-0.5 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                        {folderDecks.length} {folderDecks.length === 1 ? "deck" : "decks"}
                        {isOver && <span style={{ color: "var(--accent-deep)" }}> · drop to add</span>}
                      </p>
                    </div>

                    <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity">
                      <button onClick={() => togglePinFolder(folder.id)} className="p-2 rounded-lg hover:bg-[var(--bg-2)] transition-colors" style={{ color: folder.is_pinned ? "var(--accent-deep)" : "var(--muted)" }} title={folder.is_pinned ? "Unpin" : "Pin"}>
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill={folder.is_pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/></svg>
                      </button>
                      <button onClick={() => { setRenamingFolderId(folder.id); setRenameValue(folder.name); }} className="p-2 rounded-lg hover:bg-[var(--bg-2)] transition-colors" style={{ color: "var(--muted)" }} title="Rename">
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M17 3a2.85 2.83 0 1 1 4 4L7.5 20.5 2 22l1.5-5.5Z"/></svg>
                      </button>
                      <button onClick={() => deleteFolder(folder.id)} className="p-2 rounded-lg hover:bg-[var(--bg-2)] transition-colors" style={{ color: "var(--muted)" }} title="Delete folder">
                        <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round"><path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/></svg>
                      </button>
                    </div>

                    <button
                      onClick={() => setClosedFolderIds(prev => { const s = new Set(prev); s.has(folder.id) ? s.delete(folder.id) : s.add(folder.id); return s; })}
                      className="p-2 rounded-lg hover:bg-[var(--bg-2)] transition-colors flex-shrink-0"
                      style={{ color: "var(--muted)" }}
                      title={isClosed ? "Expand" : "Collapse"}
                    >
                      <svg viewBox="0 0 24 24" className="w-4 h-4 transition-transform" style={{ transform: isClosed ? "rotate(-90deg)" : "rotate(0deg)" }} fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                        <path d="M6 9l6 6 6-6"/>
                      </svg>
                    </button>
                  </div>

                  {/* Deck list */}
                  {!isClosed && (
                    <div style={{ borderTop: "1px solid var(--border)" }}>
                      {folderDecks.length === 0 ? (
                        <div className="px-6 py-8 text-center">
                          <Eyebrow style={{ color: isOver ? "var(--accent-deep)" : undefined }}>{isOver ? "Drop here" : "No decks yet — drag one in"}</Eyebrow>
                        </div>
                      ) : (
                        <ul className="flex flex-col gap-3 p-3">
                          {folderDecks.map((deck, i) => (
                            <DeckCard
                              key={deck.id}
                              deck={deck}
                              index={i}
                              folders={folders}
                              openMoveId={openMoveId}
                              setOpenMoveId={setOpenMoveId}
                              onMove={moveDeck}
                              onDragStart={(id) => { draggingRef.current = id; setDraggingDeckId(id); setDragOverDeckId(null); }}
                              onDragEnd={() => { draggingRef.current = null; dragOverDeckRef.current = null; setDraggingDeckId(null); setDragOverDeckId(null); setDragOverTarget(null); }}
                              isDragging={draggingDeckId === deck.id}
                              onDragOverDeck={(id, before) => { dragOverDeckRef.current = id; dragInsertBeforeRef.current = before; setDragOverDeckId(id); setDragInsertBefore(before); setDragOverTarget(null); }}
                              onDropOnDeck={(targetId) => { handleDeckDrop(folderDecks, targetId); }}
                              dragOverDeckId={dragOverDeckId}
                              dragInsertBefore={dragInsertBefore}
                              canReorder={sortBy === "custom"}
                              confirmDeleteDeckId={confirmDeleteDeckId}
                              onRequestDelete={(id) => setConfirmDeleteDeckId(id)}
                              onConfirmDelete={deleteDeck}
                              onCancelDelete={() => setConfirmDeleteDeckId(null)}
                              currentFolderName={folderMap.get(deck.folder_id ?? "")?.name}
                              onPin={togglePinDeck}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}

            {(unfiledDecks.length > 0 || (draggingDeckId && decks.find(d => d.id === draggingDeckId)?.folder_id)) && (
              <div
                onDragOver={(e) => { e.preventDefault(); dragOverDeckRef.current = null; setDragOverDeckId(null); setDragOverTarget("unfiled"); }}
                onDragLeave={(e) => { if (!e.currentTarget.contains(e.relatedTarget as Node)) { setDragOverTarget(null); dragOverDeckRef.current = null; setDragOverDeckId(null); } }}
                onDrop={(e) => {
                  e.preventDefault();
                  if (dragOverDeckRef.current) return;
                  const id = draggingRef.current;
                  if (id) moveDeck(id, null);
                  draggingRef.current = null;
                  setDragOverTarget(null);
                  setDraggingDeckId(null);
                }}
                className="rounded-2xl transition-all duration-150 p-2 -m-2"
                style={dragOverTarget === "unfiled" ? { background: "var(--bg-2)", outline: "2px solid var(--border-strong)", outlineOffset: -2 } : {}}
              >
                {folders.length > 0 && (
                  <div className="flex items-center gap-2 mb-3">
                    <Eyebrow style={{ color: dragOverTarget === "unfiled" ? "var(--ink)" : undefined }}>
                      {dragOverTarget === "unfiled" ? "Drop to unfile" : "Unfiled"}
                    </Eyebrow>
                    {dragOverTarget !== "unfiled" && (
                      <>
                        <span className="font-mono text-[11px]" style={{ color: "var(--border-strong)" }}>·</span>
                        <Eyebrow>{unfiledDecks.length}</Eyebrow>
                      </>
                    )}
                  </div>
                )}
                <ul className="flex flex-col gap-3">
                  {unfiledDecks.map((deck, i) => (
                    <DeckCard
                      key={deck.id}
                      deck={deck}
                      index={i}
                      folders={folders}
                      openMoveId={openMoveId}
                      setOpenMoveId={setOpenMoveId}
                      onMove={moveDeck}
                      onDragStart={(id) => { draggingRef.current = id; setDraggingDeckId(id); setDragOverDeckId(null); }}
                      onDragEnd={() => { draggingRef.current = null; dragOverDeckRef.current = null; setDraggingDeckId(null); setDragOverDeckId(null); setDragOverTarget(null); }}
                      isDragging={draggingDeckId === deck.id}
                      onDragOverDeck={(id, before) => { dragOverDeckRef.current = id; dragInsertBeforeRef.current = before; setDragOverDeckId(id); setDragInsertBefore(before); setDragOverTarget(null); }}
                      onDropOnDeck={(targetId) => { handleDeckDrop(unfiledDecks, targetId); }}
                      dragOverDeckId={dragOverDeckId}
                      dragInsertBefore={dragInsertBefore}
                      canReorder={sortBy === "custom"}
                      confirmDeleteDeckId={confirmDeleteDeckId}
                      onRequestDelete={(id) => setConfirmDeleteDeckId(id)}
                      onConfirmDelete={deleteDeck}
                      onCancelDelete={() => setConfirmDeleteDeckId(null)}
                      currentFolderName={undefined}
                      onPin={togglePinDeck}
                    />
                  ))}
                </ul>
              </div>
            )}
          </div>
        )}
      </div>
      </div>
    </div>
  );
}

function DeckCard({
  deck, index, folders, openMoveId, setOpenMoveId, onMove,
  onDragStart, onDragEnd, isDragging,
  onDragOverDeck, onDropOnDeck, dragOverDeckId, dragInsertBefore, canReorder,
  confirmDeleteDeckId, onRequestDelete, onConfirmDelete, onCancelDelete,
  currentFolderName, onPin,
}: {
  deck: DeckWithStats;
  index: number;
  folders: Folder[];
  openMoveId: string | null;
  setOpenMoveId: (id: string | null) => void;
  onMove: (deckId: string, folderId: string | null) => void;
  onDragStart: (id: string) => void;
  onDragEnd: () => void;
  isDragging: boolean;
  onDragOverDeck: (id: string, before: boolean) => void;
  onDropOnDeck: (targetId: string) => void;
  dragOverDeckId: string | null;
  dragInsertBefore: boolean;
  canReorder: boolean;
  confirmDeleteDeckId: string | null;
  onRequestDelete: (id: string) => void;
  onConfirmDelete: (id: string) => void;
  onCancelDelete: () => void;
  currentFolderName?: string;
  onPin: (deckId: string) => void;
}) {
  const isOpen = openMoveId === deck.id;
  const isDropTarget = dragOverDeckId === deck.id;
  const confirmingDelete = confirmDeleteDeckId === deck.id;

  return (
    <li className="relative">
      {/* Reorder indicator above */}
      {isDropTarget && dragInsertBefore && canReorder && (
        <div className="absolute -top-1.5 left-0 right-0 h-0.5 rounded-full z-10" style={{ background: "var(--accent)" }} />
      )}

      {confirmingDelete ? (
        <div className="bg-white rounded-2xl p-5" style={{ border: "1px solid var(--complement-border)", background: "var(--complement-bg)" }}>
          <p className="text-[14px] leading-relaxed" style={{ color: "var(--complement-deeper)" }}>
            Move <span className="font-medium text-[var(--ink)]">&ldquo;{deck.title}&rdquo;</span> to trash? You can restore it any time.
          </p>
          <div className="mt-3 flex gap-2">
            <button onClick={() => onConfirmDelete(deck.id)} className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg text-white" style={{ background: "var(--complement)" }}>
              Move to trash
            </button>
            <button onClick={onCancelDelete} className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium" style={{ color: "var(--muted)" }}>
              Cancel
            </button>
          </div>
        </div>
      ) : (
        <Link
          href={`/deck/${deck.id}`}
          draggable
          onDragStart={(e) => { e.dataTransfer.effectAllowed = "move"; onDragStart(deck.id); }}
          onDragEnd={onDragEnd}
          onDragOver={(e) => {
            e.preventDefault();
            e.stopPropagation();
            const rect = e.currentTarget.getBoundingClientRect();
            onDragOverDeck(deck.id, e.clientY < rect.top + rect.height / 2);
          }}
          onDragLeave={() => {}}
          onDrop={(e) => { e.preventDefault(); e.stopPropagation(); onDropOnDeck(deck.id); }}
          className="group block bg-white rounded-2xl p-6 transition-all relative overflow-hidden"
          style={{ border: "1px solid var(--border)", opacity: isDragging ? 0.4 : 1 }}
        >
          <span className="absolute left-0 top-6 bottom-6 w-[3px] rounded-r-full opacity-0 group-hover:opacity-100 transition-opacity" style={{ background: "var(--accent)" }} />

          <div className="flex items-start gap-5">
            <div className="flex-shrink-0 pt-1 flex flex-col items-center gap-1.5">
              <svg viewBox="0 0 10 16" className="w-2.5 h-4 opacity-0 group-hover:opacity-100 transition-opacity cursor-grab active:cursor-grabbing" fill="currentColor" style={{ color: "var(--border-strong)" }}>
                <circle cx="2" cy="2" r="1.5"/><circle cx="8" cy="2" r="1.5"/>
                <circle cx="2" cy="8" r="1.5"/><circle cx="8" cy="8" r="1.5"/>
                <circle cx="2" cy="14" r="1.5"/><circle cx="8" cy="14" r="1.5"/>
              </svg>
              <span className="font-mono text-[11px] uppercase tracking-[0.14em] tabular-nums" style={{ color: "var(--soft)" }}>
                {String(index + 1).padStart(2, "0")}
              </span>
            </div>
            <div className="flex-1 min-w-0">
              <h3 className="font-serif text-[22px] leading-[1.15] text-[var(--ink)]">{deck.title}</h3>
              <div className="mt-2 flex items-center gap-2 text-[13px]" style={{ color: "var(--muted)" }}>
                {deck.source_type === "pdf" ? (
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8z"/><path d="M14 2v6h6"/>
                  </svg>
                ) : (
                  <svg viewBox="0 0 24 24" className="w-3.5 h-3.5 flex-shrink-0" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M10 13a5 5 0 0 0 7.07 0l3-3a5 5 0 1 0-7.07-7.07l-1.5 1.5"/><path d="M14 11a5 5 0 0 0-7.07 0l-3 3a5 5 0 1 0 7.07 7.07l1.5-1.5"/>
                  </svg>
                )}
                <span className="truncate">{deck.source_url ?? `${deck.title}.pdf`}</span>
              </div>
              <div className="mt-4 flex items-center gap-4 flex-wrap">
                <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                  <span className="tabular-nums" style={{ color: "var(--ink)" }}>{deck.cardCount}</span> cards
                </span>
                {deck.dueCount > 0 ? (
                  <span className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--accent-deep)" }}>
                    <span className="w-1.5 h-1.5 rounded-full" style={{ background: "var(--accent)" }} />
                    <span className="tabular-nums" style={{ color: "var(--ink)" }}>{deck.dueCount}</span> due
                  </span>
                ) : (
                  <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--soft)" }}>· All caught up</span>
                )}
                <span className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                  Lv.{deck.deckLevel ?? 1} {DECK_LEVEL_NAMES[deck.deckLevel ?? 1]}
                </span>
                {folders.length > 0 && (
                  <button
                    onClick={(e) => { e.preventDefault(); e.stopPropagation(); setOpenMoveId(isOpen ? null : deck.id); }}
                    className="inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full transition-colors"
                    style={{ background: isOpen ? "var(--accent-bg)" : "var(--bg-2)", color: isOpen ? "var(--accent-deep)" : "var(--soft)" }}
                  >
                    <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                      <path d="M22 19a2 2 0 0 1-2 2H4a2 2 0 0 1-2-2V5a2 2 0 0 1 2-2h5l2 3h9a2 2 0 0 1 2 2z"/>
                    </svg>
                    {currentFolderName ?? "Move"}
                  </button>
                )}
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onPin(deck.id); }}
                  className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full transition-all"
                  style={{ background: deck.is_pinned ? "var(--accent-bg)" : "var(--bg-2)", color: deck.is_pinned ? "var(--accent-deep)" : "var(--soft)" }}
                >
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill={deck.is_pinned ? "currentColor" : "none"} stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M12 17v5"/><path d="M9 10.76a2 2 0 0 1-1.11 1.79l-1.78.9A2 2 0 0 0 5 15.24V16a1 1 0 0 0 1 1h12a1 1 0 0 0 1-1v-.76a2 2 0 0 0-1.11-1.79l-1.78-.9A2 2 0 0 1 15 10.76V7h1a2 2 0 0 0 0-4H8a2 2 0 0 0 0 4h1z"/>
                  </svg>
                  {deck.is_pinned ? "Pinned" : "Pin"}
                </button>
                <button
                  onClick={(e) => { e.preventDefault(); e.stopPropagation(); onRequestDelete(deck.id); }}
                  className="opacity-0 group-hover:opacity-100 inline-flex items-center gap-1 font-mono text-[11px] uppercase tracking-[0.14em] px-2 py-0.5 rounded-full transition-all"
                  style={{ background: "var(--complement-bg)", color: "var(--complement-deep)" }}
                >
                  <svg viewBox="0 0 24 24" className="w-3 h-3" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                    <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
                  </svg>
                  Delete
                </button>
              </div>
            </div>
            <svg viewBox="0 0 24 24" className="w-5 h-5 mt-1 transition-all group-hover:translate-x-0.5 flex-shrink-0" style={{ color: "var(--border-strong)" }} fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
              <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
            </svg>
          </div>
        </Link>
      )}

      {/* Folder picker */}
      {isOpen && (
        <div className="absolute left-6 z-10 mt-1 py-1 rounded-xl shadow-lg bg-white" style={{ border: "1px solid var(--border)", minWidth: 160 }}>
          <button onClick={() => onMove(deck.id, null)} className="w-full text-left px-4 py-2 text-[13px] transition-colors hover:bg-[var(--bg-2)]" style={{ color: deck.folder_id === null ? "var(--accent-deep)" : "var(--ink)" }}>
            No folder
          </button>
          {folders.map((f) => (
            <button key={f.id} onClick={() => onMove(deck.id, f.id)} className="w-full text-left px-4 py-2 text-[13px] transition-colors hover:bg-[var(--bg-2)]" style={{ color: deck.folder_id === f.id ? "var(--accent-deep)" : "var(--ink)" }}>
              {f.name}
            </button>
          ))}
        </div>
      )}

      {/* Reorder indicator below */}
      {isDropTarget && !dragInsertBefore && canReorder && (
        <div className="absolute -bottom-1.5 left-0 right-0 h-0.5 rounded-full z-10" style={{ background: "var(--accent)" }} />
      )}
    </li>
  );
}

function StatCell({ label, value, accent }: { label: string; value: number; accent?: boolean }) {
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
