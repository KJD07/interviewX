"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { companies, interviews, ApiError } from "@/lib/api";
import type { Company, CompanyDetail, Role, Round } from "@/lib/api";
import { planOf, isPaidPlan } from "@/lib/plans";
import AppShell from "@/components/AppShell";
import TopupModal from "@/components/TopupModal";
import PaginationControls from "@/components/PaginationControls";
import { useSearchAndPaginate } from "@/hooks/useSearchAndPaginate";
import { SkeletonCard } from "@/components/Skeleton";

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

function ArrowLeft() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M10 13L5 8l5-5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
}

// ── Round type badge ──────────────────────────────────────────────────────────

const ROUND_COLORS: Record<string, { bg: string; color: string; label: string }> = {
  technical:    { bg: "rgba(99,102,241,0.12)",  color: "var(--accent)",   label: "Technical"    },
  behavioral:   { bg: "rgba(34,197,94,0.10)",   color: "#22c55e",         label: "Behavioral"   },
  system_design:{ bg: "rgba(245,158,11,0.12)",  color: "#f59e0b",         label: "System Design"},
  hr:           { bg: "rgba(100,116,139,0.15)", color: "var(--ink-dim)",    label: "HR"           },
};

function RoundTypeBadge({ type }: { type: string }) {
  const c = ROUND_COLORS[type] ?? { bg: "rgba(100,116,139,0.15)", color: "var(--ink-dim)", label: type };
  return (
    <span
      className="text-xs font-medium px-2 py-0.5 rounded-full"
      style={{ background: c.bg, color: c.color }}
    >
      {c.label}
    </span>
  );
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

type Crumb = { label: string; onClick: () => void };

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex items-center gap-1.5 text-sm mb-8">
      {crumbs.map((c, i) => (
        <span key={i} className="flex items-center gap-1.5">
          {i > 0 && <span style={{ color: "var(--border-mid)" }}>/</span>}
          <button
            onClick={c.onClick}
            className="hover:underline transition-colors"
            style={{ color: i === crumbs.length - 1 ? "var(--ink)" : "var(--ink-dim)" }}
          >
            {c.label}
          </button>
        </span>
      ))}
    </nav>
  );
}

// ── Shared list card ─────────────────────────────────────────────────────────

function ListCard({
  title,
  subtitle,
  onClick,
  right,
  disabled,
  avatarLabel,
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
  right?: React.ReactNode;
  disabled?: boolean;
  avatarLabel?: string;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="company-row w-full text-left rounded-2xl px-4 py-4 sm:px-6 sm:py-5 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 transition-colors disabled:opacity-40"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border)",
      }}
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full sm:w-auto">
        {avatarLabel && (
          <span
            className="company-avatar w-10 h-10 sm:w-11 sm:h-11 rounded-[10px] flex items-center justify-center text-[14px] sm:text-[15px] font-semibold tracking-tight shrink-0"
            style={{ background: "var(--surface-2)", color: "var(--ink)" }}
          >
            {avatarLabel}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="company-title text-base sm:text-[17.5px] font-semibold leading-snug break-words" style={{ color: "var(--ink)", letterSpacing: "-0.015em" }}>
            {title}
          </p>
          {subtitle && (
            <p className="company-subtitle text-xs sm:text-[13px] mt-0.5 break-words" style={{ color: "var(--ink-faint)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center justify-between w-full sm:w-auto gap-3 sm:gap-4 shrink-0">
        {right}
        <span className="company-chevron" style={{ color: "var(--ink-faint)" }}>
          <ChevronRight />
        </span>
      </div>
    </button>
  );
}

// ── Tone style pill ───────────────────────────────────────────────────────────

function formatTone(tone: string) {
  const [first, ...rest] = tone.split("_");
  return [first.charAt(0).toUpperCase() + first.slice(1), ...rest].join(" · ");
}

function TonePill({ tone }: { tone: string }) {
  return (
    <span
      className="company-tonepill text-[11.5px] px-3 py-1 rounded-full font-medium"
      style={{ background: "var(--surface-2)", color: "var(--ink)" }}
    >
      {formatTone(tone)}
    </span>
  );
}

function initialsOf(name: string) {
  const parts = name.trim().split(/\s+/);
  if (parts.length === 1) return parts[0].slice(0, 2);
  return (parts[0][0] || "") + (parts[1][0] || "");
}

// ── Main page ─────────────────────────────────────────────────────────────────

type View =
  | { step: "companies" }
  | { step: "roles"; company: CompanyDetail }
  | { step: "rounds"; company: CompanyDetail; role: Role };

export default function CompaniesPage() {
  const { user } = useAuth();
  const router = useRouter();

  const [view, setView] = useState<View>({ step: "companies" });
  const [companyList, setCompanyList] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [starting, setStarting] = useState<number | null>(null); // round id being started
  const [startError, setStartError] = useState("");
  const [showTopup, setShowTopup] = useState(false);
  const [sortDesc, setSortDesc] = useState(false);
  const [sortMenuOpen, setSortMenuOpen] = useState(false);

  // Initial company list fetch
  useEffect(() => {
    companies.list()
      .then(setCompanyList)
      .catch((err) => {
        if (err instanceof ApiError) setFetchError(err.detail);
        else setFetchError("Could not load companies.");
      })
      .finally(() => setLoading(false));
  }, []);

  // Drill into a company
  const handleSelectCompany = async (id: number) => {
    setDetailLoading(true);
    setFetchError("");
    try {
      const detail = await companies.detail(id);
      setView({ step: "roles", company: detail });
    } catch (err) {
      if (err instanceof ApiError) setFetchError(err.detail);
      else setFetchError("Could not load company details.");
    } finally {
      setDetailLoading(false);
    }
  };

  // Drill into a role
  const handleSelectRole = (company: CompanyDetail, role: Role) => {
    setView({ step: "rounds", company, role });
  };

  // Start interview for a round
  const handleStartInterview = async (roundId: number) => {
    setStarting(roundId);
    setStartError("");
    try {
      const res = await interviews.start(roundId);
      router.push(`/interview/${res.session_id}`);
    } catch (err) {
      if (err instanceof ApiError) setStartError(err.detail);
      else setStartError("Failed to start interview. Try again.");
      setStarting(null);
    }
  };

  // ── Breadcrumb logic ────────────────────────────────────────────────────────

  const crumbs: Crumb[] = [
    { label: "Dashboard", onClick: () => router.push("/dashboard") },
    { label: "Companies", onClick: () => setView({ step: "companies" }) },
  ];

  if (view.step === "roles") {
    crumbs.push({ label: view.company.name, onClick: () => {} });
  }
  if (view.step === "rounds") {
    crumbs.push({
      label: (view as { step: "rounds"; company: CompanyDetail; role: Role }).company.name,
      onClick: () =>
        setView({
          step: "roles",
          company: (view as { step: "rounds"; company: CompanyDetail; role: Role }).company,
        }),
    });
    crumbs.push({ label: (view as { step: "rounds"; company: CompanyDetail; role: Role }).role.title, onClick: () => {} });
  }

  // ── Render ──────────────────────────────────────────────────────────────────

  const plan = planOf(user?.subscription_plan);
  const isPro = isPaidPlan(user?.subscription_plan);
  const monthlyUsed = (user as any)?.interviews_this_month ?? 0;
  const monthlyLimit = plan.monthlyLimit; // null = unlimited
  const bonusInterviews = user?.bonus_interviews ?? 0;
  // Plan quota used up AND no purchased top-up credits left — bonus credits
  // let a user keep going past their monthly limit without upgrading.
  const limitReached = monthlyLimit !== null && monthlyUsed >= monthlyLimit && bonusInterviews <= 0;

  const sortedCompanyList = useMemo(() => {
    const list = [...companyList].sort((a, b) => a.name.localeCompare(b.name));
    return sortDesc ? list.reverse() : list;
  }, [companyList, sortDesc]);
  const companySearch = useSearchAndPaginate(sortedCompanyList, (c) => c.name);

  return (
    <ProtectedRoute>
      <AppShell>
      <div className="min-h-screen" style={{ background: "var(--page)" }}>

        {/* Nav — only shown for free plan; paid plans use the sidebar instead */}
        {!isPro && (
          <nav
            className="flex items-center justify-between px-6 py-4 border-b"
            style={{ borderColor: "var(--surface)" }}
          >
            <button
              onClick={() => router.push("/dashboard")}
              className="text-lg font-bold tracking-tight"
              style={{ color: "var(--ink)" }}
            >
              EvaluLabs
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1.5 text-sm hover:underline"
              style={{ color: "var(--ink-dim)" }}
            >
              <ArrowLeft />
              Dashboard
            </button>
          </nav>
        )}

        <main className="max-w-[1080px] mx-auto px-4 sm:px-[44px] pt-6 sm:pt-9 pb-[60px] fade-up">

          <Breadcrumbs crumbs={crumbs} />

          {/* Global fetch error */}
          {fetchError && (
            <p
              className="mb-6 text-sm rounded px-3 py-2"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "var(--danger)",
              }}
            >
              {fetchError}
            </p>
          )}

          {/* Start error */}
          {startError && (
            <p
              className="mb-6 text-sm rounded px-3 py-2"
              style={{
                background: "rgba(239,68,68,0.1)",
                border: "1px solid rgba(239,68,68,0.3)",
                color: "var(--danger)",
              }}
            >
              {startError}
            </p>
          )}

          {/* Limit warning */}
          {limitReached && (
            <div
              className="mb-6 rounded-lg px-5 py-4"
              style={{
                background: "rgba(99,102,241,0.08)",
                border: "1px solid rgba(99,102,241,0.25)",
              }}
            >
              <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                {plan.label} plan limit reached
              </p>
              <p className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>
                You've used {monthlyUsed}/{monthlyLimit} interviews this month.
              </p>
              <div className="flex flex-wrap gap-2.5 mt-3">
                <button
                  onClick={() => setShowTopup(true)}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                >
                  Buy more interviews
                </button>
                <button
                  onClick={() => router.push("/pricing")}
                  className="px-3.5 py-1.5 rounded-full text-xs font-semibold"
                  style={{ background: "transparent", color: "var(--accent)", border: "1px solid var(--accent)" }}
                >
                  Upgrade plan →
                </button>
              </div>
            </div>
          )}

          {/* ── COMPANIES ── */}
          {view.step === "companies" && (
            <>
              <div className="mb-8">
                <h1
                  className="font-display text-[28px] sm:text-[44px] font-semibold leading-none"
                  style={{ color: "var(--ink)", letterSpacing: "-0.035em" }}
                >
                  Choose a company
                </h1>
                <p className="mt-3 text-sm sm:text-[15px]" style={{ color: "var(--ink-dim)" }}>
                  Select a company to browse roles and interview rounds.
                  {companyList.length > 0 && (
                    <> All {companyList.length} companies have verified question banks.</>
                  )}
                </p>
              </div>

              {companyList.length > 0 && (
                <div className="flex flex-col sm:flex-row items-stretch gap-2 mb-3.5">
                  <div
                    className="flex-1 rounded-[18px] p-2 flex items-center gap-3"
                    style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                  >
                    <span className="pl-3" style={{ color: "var(--ink-faint)" }}>⌕</span>
                    <input
                      type="text"
                      value={companySearch.query}
                      onChange={(e) => companySearch.setQuery(e.target.value)}
                      placeholder={`Search ${companyList.length}+ companies…`}
                      className="flex-1 bg-transparent outline-none text-[14.5px] py-2.5 min-w-0"
                      style={{ color: "var(--ink)" }}
                    />
                  </div>
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setSortMenuOpen((v) => !v)}
                      className="w-full sm:w-auto px-4 py-2.5 rounded-full text-[13px] font-medium flex items-center justify-center gap-1.5"
                      style={{ background: "transparent", border: "1px solid var(--border-mid)", color: "var(--ink)" }}
                    >
                      {sortDesc ? "Z-A" : "A-Z"}
                      <span style={{ color: "var(--ink-faint)" }}>▾</span>
                    </button>
                    {sortMenuOpen && (
                      <div
                        className="absolute right-0 top-full mt-1.5 rounded-xl overflow-hidden z-10 shadow-[0_8px_24px_rgba(28,26,22,0.12)]"
                        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                      >
                        {[
                          { label: "A-Z", desc: false },
                          { label: "Z-A", desc: true },
                        ].map((opt) => (
                          <button
                            key={opt.label}
                            onClick={() => {
                              setSortDesc(opt.desc);
                              setSortMenuOpen(false);
                            }}
                            className="block w-full text-left px-4 py-2.5 text-[14px] whitespace-nowrap hover:bg-[var(--surface-2)]"
                            style={{ color: "var(--ink)" }}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              )}

              {loading || detailLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
                </div>
              ) : companyList.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                  No companies available yet.
                </p>
              ) : companySearch.results.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                  No companies match "{companySearch.query}".
                </p>
              ) : (
                <>
                  <div className="flex flex-col gap-[10px]">
                    {companySearch.results.map((c) => (
                      <ListCard
                        key={c.id}
                        title={c.name}
                        subtitle={`${c.category ? c.category + " · " : ""}${c.question_count ?? 0} verified question${c.question_count === 1 ? "" : "s"}`}
                        avatarLabel={initialsOf(c.name)}
                        onClick={() => handleSelectCompany(c.id)}
                        right={<TonePill tone={c.tone_style} />}
                      />
                    ))}
                  </div>
                  {!companySearch.isSearching && (
                    <PaginationControls
                      page={companySearch.page}
                      totalPages={companySearch.totalPages}
                      onChange={companySearch.setPage}
                    />
                  )}
                </>
              )}
            </>
          )}

          {/* ── ROLES ── */}
          {view.step === "roles" && (
            <>
              <div className="mb-6">
                <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
                  {view.company.name}
                </h1>
                <p className="mt-1 text-sm" style={{ color: "var(--ink-dim)" }}>
                  Pick a role to see available interview rounds.
                </p>
              </div>

              {view.company.roles.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                  No roles available for this company yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {view.company.roles.map((role) => (
                    <ListCard
                      key={role.id}
                      title={role.title}
                      subtitle={`${role.rounds.length} round${role.rounds.length !== 1 ? "s" : ""}`}
                      onClick={() => handleSelectRole(view.company, role)}
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── ROUNDS ── */}
          {view.step === "rounds" && (() => {
            const v = view as { step: "rounds"; company: CompanyDetail; role: Role };
            return (
              <>
                <div className="mb-6">
                  <h1 className="font-display text-2xl sm:text-3xl font-semibold tracking-tight" style={{ color: "var(--ink)" }}>
                    {v.role.title}
                  </h1>
                  <p className="mt-1 text-sm" style={{ color: "var(--ink-dim)" }}>
                    Select a round to start your AI interview.
                  </p>
                </div>

                {v.role.rounds.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                    No rounds configured for this role yet.
                  </p>
                ) : (
                  <div className="space-y-3">
                    {v.role.rounds.map((round) => (
                      <div
                        key={round.id}
                        className="rounded-lg px-4 py-4 sm:px-5 sm:py-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 sm:gap-4"
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border-mid)",
                        }}
                      >
                        <div className="min-w-0 w-full sm:w-auto">
                          <p className="text-sm sm:text-[15px] font-medium break-words" style={{ color: "var(--ink)" }}>
                            {round.title}
                          </p>
                          <div className="mt-1.5">
                            <RoundTypeBadge type={round.round_type} />
                          </div>
                        </div>
                        <button
                          onClick={() => handleStartInterview(round.id)}
                          disabled={limitReached || starting === round.id}
                          className="w-full sm:w-auto shrink-0 px-4 py-2.5 rounded-full text-sm font-semibold transition-opacity disabled:opacity-40"
                          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                        >
                          {starting === round.id ? "Starting…" : "Start interview"}
                        </button>
                      </div>
                    ))}
                  </div>
                )}
              </>
            );
          })()}

        </main>
      </div>
      </AppShell>

      {showTopup && <TopupModal onClose={() => setShowTopup(false)} />}
    </ProtectedRoute>
  );
}