import Link from "next/link";

export default function NavBar() {
  return (
    <div
      className="sticky top-0 z-40"
      style={{
        background: "rgba(245,243,236,0.85)",
        backdropFilter: "blur(12px)",
        WebkitBackdropFilter: "blur(12px)",
        borderBottom: "1px solid var(--border)",
      }}
    >
      <div className="max-w-6xl mx-auto px-6 py-3 flex items-center justify-between">
        <Link href="/dashboard" className="flex items-center gap-3">
          <div className="relative w-[28px] h-[28px] flex-shrink-0">
            <span className="absolute inset-0 rounded-full" style={{ background: "var(--accent)" }} />
            <span className="absolute inset-0 flex items-center justify-center font-serif text-sm text-[var(--ink)]" style={{ paddingTop: "3px" }}>M</span>
          </div>
          <span className="font-serif text-[18px] text-[var(--ink)]" style={{ lineHeight: "28px" }}>Memivo</span>
        </Link>
      </div>
    </div>
  );
}
