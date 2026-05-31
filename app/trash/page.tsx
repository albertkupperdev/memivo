"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import Link from "next/link";
import { createClient } from "@/lib/supabase/client";
import type { Document } from "@/types";

function Eyebrow({ children, style }: { children: React.ReactNode; style?: React.CSSProperties }) {
  return (
    <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]" style={style}>
      {children}
    </span>
  );
}

function timeAgo(dateStr: string): string {
  const diff = Date.now() - new Date(dateStr).getTime();
  const days = Math.floor(diff / 86400000);
  if (days === 0) return "today";
  if (days === 1) return "yesterday";
  if (days < 30) return `${days} days ago`;
  const months = Math.floor(days / 30);
  return months === 1 ? "1 month ago" : `${months} months ago`;
}

export default function TrashPage() {
  const router = useRouter();
  const [docs, setDocs] = useState<Document[]>([]);
  const [loading, setLoading] = useState(true);
  const [confirmId, setConfirmId] = useState<string | null>(null);
  const [working, setWorking] = useState<string | null>(null);

  useEffect(() => {
    async function load() {
      const supabase = createClient();
      const { data: { user } } = await supabase.auth.getUser();
      if (!user) { router.push("/login"); return; }
      const { data } = await supabase
        .from("documents")
        .select("*")
        .eq("user_id", user.id)
        .not("deleted_at", "is", null)
        .order("deleted_at", { ascending: false });
      setDocs(data ?? []);
      setLoading(false);
    }
    load();
  }, []);

  async function restore(id: string) {
    setWorking(id);
    await fetch(`/api/documents/${id}`, {
      method: "PATCH",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ deleted_at: null }),
    });
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setWorking(null);
  }

  async function deletePermanently(id: string) {
    setWorking(id);
    await fetch(`/api/documents/${id}`, { method: "DELETE" });
    setDocs((prev) => prev.filter((d) => d.id !== id));
    setConfirmId(null);
    setWorking(null);
  }

  async function emptyTrash() {
    setWorking("all");
    await Promise.all(docs.map((d) => fetch(`/api/documents/${d.id}`, { method: "DELETE" })));
    setDocs([]);
    setWorking(null);
  }

  return (
    <div className="flex-1 w-full">
      <div className="max-w-4xl mx-auto px-6 py-16">
        <Link
          href="/dashboard"
          className="inline-flex items-center gap-2 mb-10 font-mono text-[11px] uppercase tracking-[0.14em] transition-colors"
          style={{ color: "var(--muted)" }}
        >
          <svg viewBox="0 0 24 24" className="w-3.5 h-3.5" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
            <path d="M19 12H5"/><path d="m12 5-7 7 7 7"/>
          </svg>
          Dashboard
        </Link>

        <div className="flex items-end justify-between mb-10">
          <div>
            <Eyebrow>Papierkorb</Eyebrow>
            <h1 className="mt-2 font-serif text-[48px] leading-[1.05] text-[var(--ink)]">
              Trash
            </h1>
          </div>
          {docs.length > 0 && (
            <button
              onClick={emptyTrash}
              disabled={working === "all"}
              className="inline-flex items-center gap-1.5 font-mono text-[11px] uppercase tracking-[0.14em] px-3 py-2 rounded-xl transition-colors disabled:opacity-40"
              style={{ background: "var(--complement-bg)", color: "var(--complement-deep)" }}
            >
              {working === "all" ? "Emptying…" : "Empty trash"}
            </button>
          )}
        </div>

        {loading ? (
          <div className="flex flex-col gap-3">
            {[0, 1, 2].map((i) => (
              <div key={i} className="h-24 rounded-2xl animate-pulse" style={{ background: "var(--bg-2)" }} />
            ))}
          </div>
        ) : docs.length === 0 ? (
          <div className="bg-white rounded-2xl p-12 text-center" style={{ border: "1px solid var(--border)" }}>
            <div className="mx-auto w-12 h-12 rounded-full flex items-center justify-center mb-6" style={{ background: "var(--bg-2)", color: "var(--muted)" }}>
              <svg viewBox="0 0 24 24" className="w-6 h-6" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                <path d="M3 6h18"/><path d="M8 6V4a2 2 0 0 1 2-2h4a2 2 0 0 1 2 2v2"/><path d="M19 6l-1 14a2 2 0 0 1-2 2H8a2 2 0 0 1-2-2L5 6"/>
              </svg>
            </div>
            <h3 className="font-serif text-[28px] leading-tight text-[var(--ink)]">Trash is empty.</h3>
            <p className="mt-3 text-[15px]" style={{ color: "var(--ink-soft)" }}>Deleted decks show up here and can be restored any time.</p>
          </div>
        ) : (
          <div className="flex flex-col gap-3">
            {docs.map((doc) => (
              <div key={doc.id} className="bg-white rounded-2xl p-6" style={{ border: "1px solid var(--border)" }}>
                {confirmId === doc.id ? (
                  <div>
                    <p className="text-[14px] leading-relaxed" style={{ color: "var(--complement-deeper)" }}>
                      Permanently delete <span className="font-medium text-[var(--ink)]">&ldquo;{doc.title}&rdquo;</span>? This cannot be undone — all cards and review history will be gone.
                    </p>
                    <div className="mt-3 flex gap-2">
                      <button
                        onClick={() => deletePermanently(doc.id)}
                        disabled={working === doc.id}
                        className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium rounded-lg text-white disabled:opacity-50"
                        style={{ background: "var(--complement)" }}
                      >
                        {working === doc.id ? "Deleting…" : "Delete permanently"}
                      </button>
                      <button
                        onClick={() => setConfirmId(null)}
                        className="inline-flex items-center justify-center px-3 py-1.5 text-sm font-medium"
                        style={{ color: "var(--muted)" }}
                      >
                        Cancel
                      </button>
                    </div>
                  </div>
                ) : (
                  <div className="flex items-center gap-4">
                    <div className="flex-1 min-w-0">
                      <h3 className="font-serif text-[20px] leading-tight text-[var(--ink)] truncate">{doc.title}</h3>
                      <p className="mt-1 font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--muted)" }}>
                        Deleted {doc.deleted_at ? timeAgo(doc.deleted_at) : ""}
                      </p>
                    </div>
                    <div className="flex items-center gap-2 flex-shrink-0">
                      <button
                        onClick={() => restore(doc.id)}
                        disabled={!!working}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-xl transition-colors disabled:opacity-40"
                        style={{ background: "var(--accent-bg)", color: "var(--accent-deep)" }}
                      >
                        {working === doc.id ? "Restoring…" : "Restore"}
                      </button>
                      <button
                        onClick={() => setConfirmId(doc.id)}
                        className="inline-flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium rounded-xl transition-colors"
                        style={{ background: "var(--complement-bg)", color: "var(--complement-deep)" }}
                      >
                        Delete permanently
                      </button>
                    </div>
                  </div>
                )}
              </div>
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
