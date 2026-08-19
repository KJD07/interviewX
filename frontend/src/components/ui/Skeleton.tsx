import { cx } from "@/lib/cx";

export function Skeleton({ className }: { className?: string }) {
  return <div className={cx("rounded bg-line-mid animate-pulse", className)} />;
}

export function SkeletonCard() {
  return (
    <div className="rounded-card px-5 py-4 bg-surface border border-line-mid animate-pulse">
      <Skeleton className="h-4 w-32" />
      <Skeleton className="mt-2 h-3 w-20" />
    </div>
  );
}

export function SkeletonList({ count = 3 }: { count?: number }) {
  return (
    <div className="space-y-3">
      {Array.from({ length: count }, (_, i) => (
        <SkeletonCard key={i} />
      ))}
    </div>
  );
}
