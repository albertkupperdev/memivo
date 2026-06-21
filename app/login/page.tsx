"use client";

import { useState } from "react";
import { useRouter } from "next/navigation";
import Image from "next/image";
import { createClient } from "@/lib/supabase/client";

export default function LoginPage() {
  const router = useRouter();
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [guestLoading, setGuestLoading] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const valid = /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email);

  async function handleGuest() {
    setGuestLoading(true);
    setError(null);

    const supabase = createClient();
    const { error: signInError } = await supabase.auth.signInAnonymously();

    if (signInError) {
      setError(signInError.message);
      setGuestLoading(false);
      return;
    }

    await fetch("/api/guest/seed", { method: "POST" });
    router.push("/dashboard");
  }

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!valid) return;
    setLoading(true);
    setError(null);

    const supabase = createClient();
    const { error } = await supabase.auth.signInWithOtp({
      email,
      options: { emailRedirectTo: `${window.location.origin}/auth/callback` },
    });

    if (error) {
      setError(error.message);
      setLoading(false);
      return;
    }

    setSubmitted(true);
    setLoading(false);
  }

  return (
    <div className="flex-1 flex flex-col items-center justify-center px-6 py-20 relative overflow-hidden">
      {/* Decorative orbs */}
      <div aria-hidden className="absolute -top-32 -right-32 w-[420px] h-[420px] rounded-full opacity-40 blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, #c8dba6 0%, transparent 70%)" }} />
      <div aria-hidden className="absolute -bottom-40 -left-32 w-[380px] h-[380px] rounded-full opacity-30 blur-3xl pointer-events-none" style={{ background: "radial-gradient(circle, #e4b29a 0%, transparent 70%)" }} />

      <div className="w-full max-w-md relative z-10">
        <div className="flex flex-col items-center text-center mb-10">
          {/* Logo */}
          <Image src="/logo-mark.png" alt="Memivo" width={44} height={44} className="mb-7" />

          <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
            Memivo · Sign in
          </span>

          <h1 className="mt-3 font-serif text-[44px] leading-[1.05] text-[var(--ink)]">
            {submitted ? (
              <>Check your <em className="not-italic" style={{ color: "var(--accent-deep)" }}>inbox</em>.</>
            ) : (
              <>Welcome <em className="not-italic" style={{ color: "var(--accent-deep)" }}>back</em>.</>
            )}
          </h1>

          <p className="mt-4 text-[15px] leading-relaxed max-w-sm" style={{ color: "var(--ink-soft)" }}>
            {submitted ? (
              <>We sent a magic link to <span className="font-medium text-[var(--ink)]">{email}</span>. It expires in 15 minutes.</>
            ) : (
              "No password. Drop your email, click the link we send, and you're in."
            )}
          </p>
        </div>

        {!submitted ? (
          <form onSubmit={handleSubmit} className="bg-white rounded-2xl p-8" style={{ border: "1px solid var(--border)", boxShadow: "0 1px 2px rgba(22,23,15,0.04)" }}>
            <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">
              Email address
            </span>
            <div className="mt-2">
              <input
                id="email"
                type="email"
                inputMode="email"
                autoComplete="email"
                placeholder="you@university.edu"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                className="w-full px-4 py-3.5 text-base text-[var(--ink)] placeholder:text-[var(--soft)] rounded-xl outline-none transition-all"
                style={{
                  background: "var(--bg-3)",
                  border: "1px solid var(--border-strong)",
                }}
                onFocus={(e) => {
                  e.target.style.borderColor = "var(--accent)";
                  e.target.style.boxShadow = "0 0 0 4px var(--accent-bg)";
                }}
                onBlur={(e) => {
                  e.target.style.borderColor = "var(--border-strong)";
                  e.target.style.boxShadow = "none";
                }}
              />
            </div>
            {error && <p className="mt-3 text-sm" style={{ color: "var(--complement-deep)" }}>{error}</p>}
            <button
              type="submit"
              disabled={!valid || loading}
              className="mt-5 w-full inline-flex items-center justify-center gap-2 px-4 py-3.5 text-[15px] font-medium rounded-xl transition-colors group"
              style={{
                background: valid && !loading ? "var(--ink)" : "var(--border-strong)",
                color: valid && !loading ? "var(--bg)" : "var(--soft)",
                cursor: valid && !loading ? "pointer" : "not-allowed",
              }}
            >
              {loading ? "Sending…" : "Send magic link"}
              {!loading && (
                <svg viewBox="0 0 24 24" className="w-4 h-4" fill="none" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12h14"/><path d="m12 5 7 7-7 7"/>
                </svg>
              )}
            </button>
            <p className="mt-5 text-xs text-center" style={{ color: "var(--muted-soft)" }}>
              By continuing, you agree to our Terms and Privacy Policy.
            </p>
          </form>
        ) : null}

        {!submitted && (
          <div className="mt-4 text-center">
            <button
              type="button"
              onClick={handleGuest}
              disabled={guestLoading}
              className="text-sm font-medium underline-offset-4 hover:underline transition-colors"
              style={{ color: "var(--ink-soft)", cursor: guestLoading ? "not-allowed" : "pointer" }}
            >
              {guestLoading ? "Setting up your demo…" : "Try it as a guest — no email needed"}
            </button>
          </div>
        )}

        {submitted && (
          <div className="bg-white rounded-2xl p-8" style={{ border: "1px solid var(--border)", boxShadow: "0 1px 2px rgba(22,23,15,0.04)" }}>
            <div className="flex items-start gap-4">
              <div className="flex-shrink-0 w-10 h-10 rounded-full flex items-center justify-center" style={{ background: "var(--accent-bg)", color: "var(--accent-deep)" }}>
                <svg viewBox="0 0 24 24" className="w-5 h-5" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round">
                  <path d="M5 12l5 5L20 7"/>
                </svg>
              </div>
              <div className="flex-1">
                <p className="text-[15px] font-medium text-[var(--ink)]">Magic link sent</p>
                <p className="mt-1 text-sm leading-relaxed" style={{ color: "var(--ink-soft)" }}>
                  Open the email and click the link to sign in.
                </p>
              </div>
            </div>
            <button
              onClick={() => setSubmitted(false)}
              className="mt-6 w-full inline-flex items-center justify-center px-4 py-2.5 text-sm font-medium transition-colors"
              style={{ color: "var(--muted)" }}
            >
              Use a different email
            </button>
          </div>
        )}
      </div>
    </div>
  );
}
