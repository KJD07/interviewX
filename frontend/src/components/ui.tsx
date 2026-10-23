// Shared building blocks for the candidate app (dashboard, companies, skills,
// practice, jobs, progress, profile). Every page uses the same container
// width, header, card, stat tile, empty state and notice so the screens read
// as one product. Styling lives in the "Candidate app UI kit" block of
// globals.css; these are thin wrappers over those classes.

export function PageContainer({ children, className = "" }: { children: React.ReactNode; className?: string }) {
  return (
    <main className={`w-full max-w-[1120px] mx-auto px-4 sm:px-8 lg:px-10 pt-6 sm:pt-9 pb-16 fade-up ${className}`}>
      {children}
    </main>
  );
}

export function PageHeader({
  eyebrow,
  title,
  subtitle,
  actions,
}: {
  eyebrow?: React.ReactNode;
  title: React.ReactNode;
  subtitle?: React.ReactNode;
  actions?: React.ReactNode;
}) {
  return (
    <header className="flex flex-col gap-4 sm:flex-row sm:items-end sm:justify-between mb-7">
      <div className="min-w-0">
        {eyebrow && <div className="font-label mb-2.5">{eyebrow}</div>}
        <h1
          className="font-display text-[30px] sm:text-[40px] font-bold leading-[1.05] break-words"
          style={{ color: "var(--ink)", letterSpacing: "-0.035em" }}
        >
          {title}
        </h1>
        {subtitle && (
          <div className="mt-2 text-sm sm:text-[15px] max-w-2xl" style={{ color: "var(--ink-dim)" }}>
            {subtitle}
          </div>
        )}
      </div>
      {actions && <div className="flex flex-wrap items-center gap-2.5 shrink-0">{actions}</div>}
    </header>
  );
}

export function Card({
  children,
  className = "",
  padded = true,
  as: Tag = "div",
}: {
  children: React.ReactNode;
  className?: string;
  padded?: boolean;
  as?: "div" | "section" | "li" | "form";
}) {
  return <Tag className={`ui-card ${padded ? "p-5 sm:p-6" : ""} ${className}`}>{children}</Tag>;
}

// Title row inside a card: heading (+ optional meta) on the left, action on the right.
export function CardHeader({
  title,
  meta,
  action,
  className = "",
}: {
  title: React.ReactNode;
  meta?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  return (
    <div className={`flex flex-wrap items-center justify-between gap-3 mb-4 ${className}`}>
      <div className="flex items-baseline gap-2.5 min-w-0">
        <h2 className="font-display text-[19px] font-bold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
          {title}
        </h2>
        {meta && (
          <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
            {meta}
          </span>
        )}
      </div>
      {action}
    </div>
  );
}

export function StatTile({
  label,
  value,
  suffix,
  hint,
  tone = "default",
}: {
  label: string;
  value: React.ReactNode;
  suffix?: string;
  hint?: React.ReactNode;
  tone?: "default" | "lime";
}) {
  const lime = tone === "lime";
  return (
    <div
      className="ui-card h-full p-5 flex flex-col justify-between gap-4 min-h-[118px]"
      style={lime ? { background: "var(--lime)", borderColor: "transparent" } : undefined}
    >
      <span
        className="font-mono text-[10px] uppercase tracking-[0.16em]"
        style={{ color: lime ? "#3C4118" : "var(--ink-faint)" }}
      >
        {label}
      </span>
      <div>
        <span
          className="font-display text-[32px] font-bold leading-none tracking-[-0.035em] tabular-nums"
          style={{ color: "var(--ink)" }}
        >
          {value}
          {suffix && (
            <span className="text-[16px] font-medium" style={{ color: lime ? "#5A6123" : "var(--ink-faint)" }}>
              {suffix}
            </span>
          )}
        </span>
        {hint && (
          <p className="text-xs mt-1.5" style={{ color: lime ? "#3C4118" : "var(--ink-dim)" }}>
            {hint}
          </p>
        )}
      </div>
    </div>
  );
}

export function EmptyState({
  icon,
  title,
  body,
  action,
  compact = false,
}: {
  icon?: React.ReactNode;
  title: string;
  body?: React.ReactNode;
  action?: React.ReactNode;
  compact?: boolean;
}) {
  return (
    <div className={`ui-card text-center flex flex-col items-center ${compact ? "px-6 py-8" : "px-6 py-12"}`}>
      {icon && (
        <span
          className="w-11 h-11 rounded-[13px] flex items-center justify-center mb-4"
          style={{ background: "var(--surface-2)", color: "var(--ink-dim)" }}
        >
          {icon}
        </span>
      )}
      <p className="font-display text-[18px] font-bold tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
        {title}
      </p>
      {body && (
        <div className="mt-1.5 text-sm max-w-md" style={{ color: "var(--ink-dim)" }}>
          {body}
        </div>
      )}
      {action && <div className="mt-5 flex flex-wrap justify-center gap-2.5">{action}</div>}
    </div>
  );
}

const NOTICE_TONES = {
  error: { bg: "rgba(179,64,42,0.07)", border: "rgba(179,64,42,0.22)", title: "var(--danger)" },
  warn: { bg: "rgba(180,115,30,0.08)", border: "rgba(180,115,30,0.25)", title: "#7A5A12" },
  success: { bg: "var(--success-bg)", border: "rgba(63,143,94,0.25)", title: "#2F6B48" },
  info: { bg: "var(--surface)", border: "var(--border-mid)", title: "var(--ink)" },
} as const;

export function Notice({
  tone = "info",
  title,
  children,
  action,
  className = "",
}: {
  tone?: keyof typeof NOTICE_TONES;
  title?: React.ReactNode;
  children?: React.ReactNode;
  action?: React.ReactNode;
  className?: string;
}) {
  const t = NOTICE_TONES[tone];
  return (
    <div
      role={tone === "error" ? "alert" : undefined}
      className={`rounded-[14px] px-4 py-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${className}`}
      style={{ background: t.bg, border: `1px solid ${t.border}` }}
    >
      <div className="text-sm min-w-0">
        {title && (
          <p className="font-semibold" style={{ color: t.title }}>
            {title}
          </p>
        )}
        {children && (
          <div className={title ? "mt-0.5 text-[13px]" : ""} style={{ color: title ? "var(--ink-dim)" : t.title }}>
            {children}
          </div>
        )}
      </div>
      {action && <div className="flex flex-wrap gap-2 shrink-0">{action}</div>}
    </div>
  );
}

export function Segmented<T extends string>({
  options,
  value,
  onChange,
  className = "",
}: {
  options: { id: T; label: React.ReactNode }[];
  value: T;
  onChange: (v: T) => void;
  className?: string;
}) {
  return (
    <div className={`segmented ${className}`}>
      {options.map((o) => (
        <button key={o.id} type="button" aria-pressed={value === o.id} onClick={() => onChange(o.id)}>
          {o.label}
        </button>
      ))}
    </div>
  );
}

// Same anchors the interview grader uses: 0-2 is a fail, 3-5 shaky, 6+ solid.
export function scoreColor(v: number, outOf = 10) {
  const x = (v / outOf) * 10;
  return x >= 6 ? "var(--success)" : x >= 3 ? "var(--warn)" : "var(--danger)";
}

// Horizontal meter for a score, used for topic/company/ATS scores.
export function ScoreBar({ value, outOf = 10, height = 6 }: { value: number; outOf?: number; height?: number }) {
  return (
    <span className="relative block w-full rounded-full overflow-hidden" style={{ height, background: "var(--surface-2)" }}>
      <span
        className="absolute inset-y-0 left-0 rounded-full"
        style={{ width: `${Math.max(0, Math.min(1, value / outOf)) * 100}%`, background: scoreColor(value, outOf) }}
      />
    </span>
  );
}

// ── Icons shared by empty states / action tiles ─────────────────────────────

export function IconSpark() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor">
      <path d="M8 2.5c0 3.05 2.45 5.5 5.5 5.5-3.05 0-5.5 2.45-5.5 5.5 0-3.05-2.45-5.5-5.5-5.5 3.05 0 5.5-2.45 5.5-5.5Z" />
      <path d="M14.75 12.25c0 1.5 1.25 2.75 2.75 2.75-1.5 0-2.75 1.25-2.75 2.75 0-1.5-1.25-2.75-2.75-2.75 1.5 0 2.75-1.25 2.75-2.75Z" />
    </svg>
  );
}

export function IconChat() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" fillRule="evenodd">
      <path d="M4.25 2.5h11.5A2.25 2.25 0 0 1 18 4.75v7A2.25 2.25 0 0 1 15.75 14H9.75L6 17.25V14H4.25A2.25 2.25 0 0 1 2 11.75v-7A2.25 2.25 0 0 1 4.25 2.5Zm1.5 4h8.5v1.75h-8.5V6.5Zm0 3.25h5.75v1.75H5.75V9.75Z" />
    </svg>
  );
}

export function IconBriefcase() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" fillRule="evenodd">
      <path d="M7.25 3.5h5.5A1.75 1.75 0 0 1 14.5 5.25V6h1.75A1.75 1.75 0 0 1 18 7.75v7.5A1.75 1.75 0 0 1 16.25 17H3.75A1.75 1.75 0 0 1 2 15.25v-7.5A1.75 1.75 0 0 1 3.75 6H5.5v-.75A1.75 1.75 0 0 1 7.25 3.5Zm0 1.75V6h5.5v-.75h-5.5ZM8.5 10h3v1.75h-3V10Z" />
    </svg>
  );
}

export function IconDoc() {
  return (
    <svg width="18" height="18" viewBox="0 0 20 20" fill="currentColor" fillRule="evenodd">
      <path d="M5.25 2h6.5L16 6.25v9.5A2.25 2.25 0 0 1 13.75 18h-8.5A2.25 2.25 0 0 1 3 15.75V4.25A2.25 2.25 0 0 1 5.25 2ZM6.5 9.25h7V11h-7V9.25Zm0 3.5h5V14.5h-5v-1.75Z" />
    </svg>
  );
}

export function IconSearch() {
  return (
    <svg width="16" height="16" viewBox="0 0 20 20" fill="none" stroke="currentColor" strokeWidth="2" strokeLinecap="round">
      <circle cx="8.75" cy="8.75" r="5.25" />
      <path d="m13 13 4 4" />
    </svg>
  );
}

export function IconArrowRight() {
  return (
    <svg width="14" height="14" viewBox="0 0 16 16" fill="none" stroke="currentColor" strokeWidth="1.7" strokeLinecap="round" strokeLinejoin="round">
      <path d="M3 8h10M9 4l4 4-4 4" />
    </svg>
  );
}

// Pill search field (icon + input), used on list pages.
export function SearchField({
  value,
  onChange,
  placeholder,
  className = "",
}: {
  value: string;
  onChange: (v: string) => void;
  placeholder: string;
  className?: string;
}) {
  return (
    <label className={`ui-search flex items-center gap-2.5 rounded-full px-4 h-11 ${className}`}>
      <span style={{ color: "var(--ink-faint)" }}>
        <IconSearch />
      </span>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="flex-1 min-w-0 h-full bg-transparent text-sm border-0 outline-none"
        style={{ color: "var(--ink)" }}
      />
    </label>
  );
}
