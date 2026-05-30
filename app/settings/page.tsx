"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { DEFAULT_SETTINGS } from "@/types";
import { formatInterval } from "@/lib/sm2";

type Unit = "minutes" | "hours" | "days";

function toDays(amount: number, unit: Unit): number {
  if (unit === "minutes") return amount / (24 * 60);
  if (unit === "hours") return amount / 24;
  return amount;
}

function fromDays(days: number): { amount: number; unit: Unit } {
  if (days < 1 / 24) return { amount: Math.round(days * 24 * 60), unit: "minutes" };
  if (days < 1) return { amount: parseFloat((days * 24).toFixed(1)), unit: "hours" };
  return { amount: parseFloat(days.toFixed(1)), unit: "days" };
}

function Eyebrow({ children }: { children: React.ReactNode }) {
  return <span className="font-mono text-[11px] uppercase tracking-[0.14em] text-[var(--muted)]">{children}</span>;
}

function IntervalInput({
  label, description, days, onChange,
}: {
  label: string; description: string; days: number; onChange: (days: number) => void;
}) {
  const init = fromDays(days);
  const [amount, setAmount] = useState(init.amount);
  const [unit, setUnit] = useState<Unit>(init.unit);

  useEffect(() => {
    const init = fromDays(days);
    setAmount(init.amount);
    setUnit(init.unit);
  }, [days]);

  function handleChange(newAmount: number, newUnit: Unit) {
    setAmount(newAmount);
    setUnit(newUnit);
    onChange(toDays(newAmount, newUnit));
  }

  return (
    <div className="flex items-center justify-between py-5" style={{ borderBottom: "1px solid var(--border)" }}>
      <div>
        <p className="text-[15px] font-medium text-[var(--ink)]">{label}</p>
        <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>{description}</p>
      </div>
      <div className="flex items-center gap-2 ml-6 shrink-0">
        <input
          type="number"
          min={1}
          step={unit === "days" ? 0.5 : 1}
          value={amount}
          onChange={(e) => handleChange(parseFloat(e.target.value) || 1, unit)}
          className="w-20 px-3 py-2 text-[14px] text-right rounded-xl outline-none"
          style={{ border: "1px solid var(--border)", background: "white", color: "var(--ink)" }}
        />
        <select
          value={unit}
          onChange={(e) => handleChange(amount, e.target.value as Unit)}
          className="px-3 py-2 text-[13px] font-mono rounded-xl outline-none appearance-none cursor-pointer"
          style={{ border: "1px solid var(--border)", background: "white", color: "var(--muted)" }}
        >
          <option value="minutes">min</option>
          <option value="hours">hours</option>
          <option value="days">days</option>
        </select>
        <span className="w-14 text-right font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--accent-deep)" }}>
          {formatInterval(toDays(amount, unit))}
        </span>
      </div>
    </div>
  );
}

export default function SettingsPage() {
  const [settings, setSettings] = useState(DEFAULT_SETTINGS);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [saved, setSaved] = useState(false);

  useEffect(() => {
    fetch("/api/settings")
      .then((r) => r.json())
      .then((data) => { setSettings(data); setLoading(false); });
  }, []);

  async function save() {
    setSaving(true);
    setSaved(false);
    await fetch("/api/settings", {
      method: "PUT",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify(settings),
    });
    setSaving(false);
    setSaved(true);
    setTimeout(() => setSaved(false), 2000);
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

        <h1 className="font-serif text-[44px] leading-[1.05] text-[var(--ink)]">Review intervals</h1>
        <p className="mt-3 text-[15px] leading-relaxed" style={{ color: "var(--ink-soft)" }}>
          Customize how long until a card comes back after each rating. SM-2 takes over automatically after the first two reviews.
        </p>

        {loading ? (
          <div className="mt-10 space-y-1">
            {[0, 1, 2, 3].map((i) => (
              <div key={i} className="h-16 rounded-xl animate-pulse" style={{ background: "var(--bg-2)" }} />
            ))}
          </div>
        ) : (
          <div className="mt-10">
            <IntervalInput
              label="Again"
              description="Card you failed — show again soon"
              days={settings.interval_again}
              onChange={(v) => setSettings((s) => ({ ...s, interval_again: v }))}
            />
            <IntervalInput
              label="Hard"
              description="You barely remembered — show again soon"
              days={settings.interval_hard}
              onChange={(v) => setSettings((s) => ({ ...s, interval_hard: v }))}
            />
            <IntervalInput
              label="Good"
              description="First milestone interval for a correct answer"
              days={settings.interval_good}
              onChange={(v) => setSettings((s) => ({ ...s, interval_good: v }))}
            />
            <IntervalInput
              label="Easy"
              description="Second milestone — card you know well"
              days={settings.interval_easy}
              onChange={(v) => setSettings((s) => ({ ...s, interval_easy: v }))}
            />

            {/* Type-in answer toggle */}
            <div className="flex items-center justify-between py-5" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <p className="text-[15px] font-medium text-[var(--ink)]">Type-in answer</p>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>Auto-activate type-in on every card — you can always skip with "Show answer"</p>
              </div>
              <button
                onClick={() => setSettings((s) => ({ ...s, type_in_answer: !s.type_in_answer }))}
                className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ml-6"
                style={{ background: settings.type_in_answer ? "var(--ink)" : "var(--border-strong)" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: settings.type_in_answer ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            </div>

            {/* Skip max level toggle */}
            <div className="flex items-center justify-between py-5" style={{ borderBottom: "1px solid var(--border)" }}>
              <div>
                <p className="text-[15px] font-medium text-[var(--ink)]">Skip max-level cards</p>
                <p className="mt-0.5 text-[13px]" style={{ color: "var(--muted)" }}>Exclude cards that have reached level 10 (max) from review sessions</p>
              </div>
              <button
                onClick={() => setSettings((s) => ({ ...s, skip_max_level: !s.skip_max_level }))}
                className="relative flex-shrink-0 w-11 h-6 rounded-full transition-colors ml-6"
                style={{ background: settings.skip_max_level ? "var(--ink)" : "var(--border-strong)" }}
              >
                <span
                  className="absolute top-0.5 left-0.5 w-5 h-5 rounded-full bg-white shadow transition-transform"
                  style={{ transform: settings.skip_max_level ? "translateX(20px)" : "translateX(0)" }}
                />
              </button>
            </div>

            <div className="mt-8 flex items-center gap-4">
              <button
                onClick={save}
                disabled={saving}
                className="inline-flex items-center justify-center px-6 py-3 text-[15px] font-medium rounded-xl text-white transition-colors disabled:opacity-50"
                style={{ background: "var(--ink)" }}
              >
                {saving ? "Saving…" : "Save settings"}
              </button>
              {saved && <span className="font-mono text-[11px] uppercase tracking-[0.14em]" style={{ color: "var(--accent-deep)" }}>Saved</span>}
              <button
                onClick={() => setSettings(DEFAULT_SETTINGS)}
                className="font-mono text-[11px] uppercase tracking-[0.14em] transition-colors ml-auto"
                style={{ color: "var(--muted)" }}
              >
                Reset to defaults
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
