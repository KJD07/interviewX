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
    <div className="ui-card p-5 min-h-[118px] flex flex-col justify-between">
      <Skeleton className="h-2.5 w-20 rounded" />
      <Skeleton className="h-8 w-16 rounded-lg" />
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
    <div className="ui-card overflow-hidden">
      <div
        className="grid font-mono text-[10px] uppercase tracking-[0.14em] px-5 py-3"
        style={{
          gridTemplateColumns: "1fr 130px 70px 70px 80px 110px",
          columnGap: "24px",
          background: "var(--surface-alt)",
          color: "var(--ink-faint)",
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
    <div className="ui-card px-5 py-4 flex items-center gap-4">
      <Skeleton className="w-10 h-10 !rounded-[11px] shrink-0" />
      <div className="flex-1">
        <Skeleton className="h-4 w-40 rounded mb-2" />
        <Skeleton className="h-3 w-24 rounded" />
      </div>
    </div>
  );
}
