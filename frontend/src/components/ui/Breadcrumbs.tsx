import { cx } from "@/lib/cx";

export type Crumb = { label: string; onClick: () => void };

export function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm mb-8">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span className="text-line-mid">/</span>}
          <button
            onClick={c.onClick}
            className={cx("hover:underline transition-colors", i === crumbs.length - 1 ? "text-ink" : "text-ink-dim")}
          >
            {c.label}
          </button>
        </span>
      ))}
    </nav>
  );
}
