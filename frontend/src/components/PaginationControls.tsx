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

  // Show a bounded window around the current page (plus first/last) instead
  // of one button per page — with hundreds of items, PAGE_SIZE=5 can push
  // totalPages into the dozens, which used to overflow the whole row.
  const windowSize = 1;
  const pages: (number | "ellipsis")[] = [];
  for (let p = 1; p <= totalPages; p++) {
    const isEdge = p === 1 || p === totalPages;
    const isNearCurrent = Math.abs(p - page) <= windowSize;
    if (isEdge || isNearCurrent) {
      pages.push(p);
    } else if (pages[pages.length - 1] !== "ellipsis") {
      pages.push("ellipsis");
    }
  }

  return (
    <div className="flex flex-wrap items-center justify-center gap-2 mt-6">
      <button
        onClick={() => onChange(page - 1)}
        disabled={page <= 1}
        className="px-3 py-1.5 rounded-full text-xs font-semibold disabled:opacity-30"
        style={{ background: "var(--surface)", color: "var(--ink)", border: "1px solid var(--border-mid)" }}
      >
        ← Prev
      </button>
      {pages.map((p, i) =>
        p === "ellipsis" ? (
          <span key={`ellipsis-${i}`} className="px-1 text-xs" style={{ color: "var(--ink-dim)" }}>
            …
          </span>
        ) : (
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
        )
      )}
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
