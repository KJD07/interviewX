"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { companies, interviews, ApiError } from "@/lib/api";
import type { Company, CompanyDetail, Role, Round } from "@/lib/api";
import { planOf, isPaidPlan, isPlatformFree } from "@/lib/plans";
import AppShell from "@/components/AppShell";
import TopupModal from "@/components/TopupModal";
import InterviewInstructionsModal from "@/components/InterviewInstructionsModal";
import PaginationControls from "@/components/PaginationControls";
import { useSearchAndPaginate } from "@/hooks/useSearchAndPaginate";
import { SkeletonCard } from "@/components/Skeleton";
import { PageContainer, PageHeader, EmptyState, Notice, SearchField, IconSpark } from "@/components/ui";

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

const ROUND_TYPES: Record<string, { cls: string; label: string }> = {
  technical:     { cls: "tag",             label: "Technical"     },
  behavioral:    { cls: "tag tag-success", label: "Behavioral"    },
  system_design: { cls: "tag tag-warn",    label: "System Design" },
  hr:            { cls: "tag tag-outline", label: "HR"            },
};

function RoundTypeBadge({ type }: { type: string }) {
  const c = ROUND_TYPES[type] ?? { cls: "tag tag-outline", label: type };
  return <span className={c.cls}>{c.label}</span>;
}

// ── Breadcrumb ────────────────────────────────────────────────────────────────

type Crumb = { label: string; onClick: () => void };

function Breadcrumbs({ crumbs }: { crumbs: Crumb[] }) {
  return (
    <nav className="flex flex-wrap items-center gap-1.5 text-[13px] mb-5">
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
      className="company-row w-full text-left px-4 py-4 sm:px-[22px] flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between sm:gap-4 disabled:opacity-40 border-b last:border-b-0"
      style={{
        background: "var(--surface)",
        borderColor: "var(--border)",
      }}
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0 w-full sm:w-auto">
        {avatarLabel && (
          <span
            className="company-avatar w-[38px] h-[38px] rounded-[11px] flex items-center justify-center font-mono text-[13px] font-bold shrink-0"
            style={{ background: "var(--page)", border: "1px solid var(--border)", color: "var(--ink)" }}
          >
            {avatarLabel}
          </span>
        )}
        <div className="min-w-0 flex-1">
          <p className="company-title font-display text-[17px] sm:text-[19px] font-semibold leading-snug break-words tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
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
      className="company-tonepill font-mono text-[10px] uppercase tracking-[0.08em] px-[11px] py-1.5 rounded-full"
      style={{ background: "var(--page)", border: "1px solid var(--border)", color: "var(--ink-dim)" }}
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
      const { trackEvent } = await import("@/lib/posthog");
      trackEvent("interview_started", { round_id: roundId });
      router.push(`/interview/${res.session_id}`);
    } catch (err) {
      if (err instanceof ApiError) setStartError(err.detail);
      else setStartError("Failed to start interview. Try again.");
      setStarting(null);
    }
  };

  const [pendingRound, setPendingRound] = useState<{ id: number; title: string } | null>(null);

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
  const platformFree = isPlatformFree(user);
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
    <ProtectedRoute redirect={false}>
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

        <PageContainer>

          <Breadcrumbs crumbs={crumbs} />

          {/* Global fetch error */}
          {fetchError && <Notice tone="error" className="mb-5">{fetchError}</Notice>}

          {/* Start error */}
          {startError && <Notice tone="error" className="mb-5">{startError}</Notice>}

          {/* Limit warning */}
          {limitReached && (
            <Notice
              tone="warn"
              className="mb-5"
              title={platformFree ? "Monthly interview limit reached" : `${plan.label} plan limit reached`}
              action={
                // Interviews aren't sold while the platform is free — no top-ups/upgrades.
                !platformFree && (
                  <>
                    <button onClick={() => setShowTopup(true)} className="btn btn-primary btn-sm">
                      Buy more interviews
                    </button>
                    <button onClick={() => router.push("/pricing")} className="btn btn-secondary btn-sm">
                      Upgrade plan →
                    </button>
                  </>
                )
              }
            >
              You&apos;ve used {monthlyUsed}/{monthlyLimit} interviews this month.
              {platformFree && " Your free interviews reset 30 days after your cycle started."}
            </Notice>
          )}

          {/* ── COMPANIES ── */}
          {view.step === "companies" && (
            <>
              <PageHeader
                eyebrow="Step 1 of 3 · Company"
                title="Choose a company"
                subtitle={
                  <>
                    Select a company to browse roles and interview rounds.
                    {companyList.length > 0 && (
                      <> All {companyList.length} companies have verified question banks.</>
                    )}
                  </>
                }
              />

              {companyList.length > 0 && (
                <div className="flex flex-col sm:flex-row items-stretch gap-2 mb-3.5">
                  <SearchField
                    value={companySearch.query}
                    onChange={companySearch.setQuery}
                    placeholder={`Search ${companyList.length}+ companies…`}
                    className="w-full sm:flex-1"
                  />
                  <div className="relative shrink-0">
                    <button
                      onClick={() => setSortMenuOpen((v) => !v)}
                      className="btn btn-secondary !h-11 w-full sm:w-auto"
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
                <EmptyState compact icon={<IconSpark />} title="No companies available yet" />
              ) : companySearch.results.length === 0 ? (
                <EmptyState
                  compact
                  title="No matches"
                  body={<>No companies match &quot;{companySearch.query}&quot;.</>}
                  action={<button className="btn btn-secondary btn-sm" onClick={() => companySearch.setQuery("")}>Clear search</button>}
                />
              ) : (
                <>
                  <div className="ui-card overflow-hidden">
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
              <PageHeader
                eyebrow="Step 2 of 3 · Role"
                title={view.company.name}
                subtitle="Pick a role to see available interview rounds."
              />

              {view.company.roles.length === 0 ? (
                <EmptyState compact title="No roles yet" body="No roles available for this company yet." />
              ) : (
                <div className="ui-card overflow-hidden">
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
                <PageHeader
                  eyebrow="Step 3 of 3 · Round"
                  title={v.role.title}
                  subtitle="Select a round to start your AI interview."
                />

                {v.role.rounds.length === 0 ? (
                  <EmptyState compact title="No rounds yet" body="No rounds configured for this role yet." />
                ) : (
                  <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                    {v.role.rounds.map((round, i) => (
                      <div key={round.id} className="ui-card card-hover p-5 flex flex-col gap-4">
                        <div className="flex items-center justify-between gap-3">
                          <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                            Round {String(i + 1).padStart(2, "0")}
                          </span>
                          <RoundTypeBadge type={round.round_type} />
                        </div>
                        <p className="flex-1 font-display text-[17px] font-bold leading-snug tracking-[-0.015em] break-words" style={{ color: "var(--ink)" }}>
                          {round.title}
                        </p>
                        <button
                          onClick={() => setPendingRound({ id: round.id, title: round.title })}
                          disabled={limitReached || starting === round.id}
                          className="btn btn-primary w-full"
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

        </PageContainer>
      </div>
      </AppShell>

      {showTopup && <TopupModal onClose={() => setShowTopup(false)} />}

      {pendingRound && view.step === "rounds" && (
        <InterviewInstructionsModal
          companyName={view.company.name}
          roleTitle={view.role.title}
          roundTitle={pendingRound.title}
          confirming={starting === pendingRound.id}
          error={startError}
          onCancel={() => setPendingRound(null)}
          onConfirm={() => handleStartInterview(pendingRound.id)}
        />
      )}
    </ProtectedRoute>
  );
}