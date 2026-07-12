"use client";

export default function PaginationControls({
  page,
  totalPages,
  onChange,
}: {
  page: number;
  totalPages: number;
  onChange: (page: number) => void;
}) {
  if (totalPages <= 1) return null;

  const pages = Array.from({ length: totalPages }, (_, i) => i + 1);

  return (
    <div className="flex items-center justify-center gap-2 mt-6">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-30"
        style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border-mid)" }}
      >
        ← Prev
      </button>
      {pages.map((p) => (
        <button
          key={p}
          onClick={() => onChange(p)}
          className="w-7 h-7 rounded-full text-xs font-semibold"
          style={
            p === page
              ? { background: "var(--accent)", color: "var(--accent-ink)" }
              : { background: "var(--surface)", color: "var(--ink-dim)", border: "1px solid var(--border-mid)" }
          }
        >
          {p}
        </button>
      ))}
      <button
        onClick={() => onChange(page + 1)}
        disabled={page >= totalPages}
        className="px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-30"
        style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border-mid)" }}
      >
        Next →
      </button>
    </div>
  );
}
