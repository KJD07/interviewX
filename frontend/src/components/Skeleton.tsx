// Lightweight skeleton primitives — pure CSS shimmer (no animation library),
// so loading states stay cheap on low-end devices instead of feeling laggy.

export function Skeleton({
  className = "",
  style,
}: {
  className?: string;
  style?: React.CSSProperties;
}) {
  return <div className={`skeleton ${className}`} style={style} />;
}

export function SkeletonStatCard() {
  return (
    <div
      className="rounded-[18px] p-[22px]"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <Skeleton className="h-9 w-16 rounded-lg mb-3" />
      <Skeleton className="h-3 w-24 rounded" />
    </div>
  );
}

export function SkeletonRow({ last = false }: { last?: boolean }) {
  return (
    <div
      className="grid items-center px-5 py-4"
      style={{
        gridTemplateColumns: "1fr 130px 70px 70px 80px 110px",
        columnGap: "24px",
        borderBottom: last ? "none" : "1px solid var(--border)",
      }}
    >
      <Skeleton className="h-4 w-40 rounded" />
      <Skeleton className="h-6 w-20 rounded-full" />
      <Skeleton className="h-4 w-8 rounded" />
      <Skeleton className="h-4 w-8 rounded" />
      <Skeleton className="h-4 w-8 rounded" />
      <Skeleton className="h-3 w-16 rounded" />
    </div>
  );
}

export function SkeletonTable({ rows = 5 }: { rows?: number }) {
  return (
    <div
      className="rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(28,26,22,0.06)]"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <div
        className="grid text-xs font-medium uppercase tracking-wider px-5 py-3"
        style={{
          gridTemplateColumns: "1fr 130px 70px 70px 80px 110px",
          columnGap: "24px",
          background: "var(--surface-2)",
          color: "var(--ink-dim)",
          borderBottom: "1px solid var(--border)",
        }}
      >
        <span>Session</span>
        <span>Status</span>
        <span>Comm.</span>
        <span>Tech.</span>
        <span>Overall</span>
        <span>Date</span>
      </div>
      {Array.from({ length: rows }).map((_, i) => (
        <SkeletonRow key={i} last={i === rows - 1} />
      ))}
    </div>
  );
}

export function SkeletonCard() {
  return (
    <div
      className="rounded-lg px-5 py-4"
      style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
    >
      <Skeleton className="h-4 w-32 rounded mb-2" />
      <Skeleton className="h-3 w-20 rounded" />
    </div>
  );
}
