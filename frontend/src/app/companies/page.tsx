"use client";
import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { companies, interviews, ApiError } from "@/lib/api";
import type { Company, CompanyDetail, Role, Round } from "@/lib/api";
import { planOf, isPaidPlan } from "@/lib/plans";
import AppShell from "@/components/AppShell";

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

// ── Skeleton loader ───────────────────────────────────────────────────────────

function SkeletonCard() {
  return (
    <div
      className="rounded-lg px-5 py-4 animate-pulse"
      style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
    >
      <div className="h-4 w-32 rounded" style={{ background: "var(--border-mid)" }} />
      <div className="mt-2 h-3 w-20 rounded" style={{ background: "var(--border-mid)" }} />
    </div>
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
}: {
  title: string;
  subtitle?: string;
  onClick: () => void;
  right?: React.ReactNode;
  disabled?: boolean;
}) {
  return (
    <button
      onClick={onClick}
      disabled={disabled}
      className="w-full text-left rounded-lg px-5 py-4 flex items-center justify-between gap-4 transition-colors disabled:opacity-40"
      style={{
        background: "var(--surface)",
        border: "1px solid var(--border-mid)",
      }}
      onMouseEnter={(e) =>
        !disabled && ((e.currentTarget as HTMLElement).style.borderColor = "var(--border-mid)")
      }
    >
      <div className="min-w-0">
        <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
          {title}
        </p>
        {subtitle && (
          <p className="text-xs mt-0.5 truncate" style={{ color: "var(--ink-dim)" }}>
            {subtitle}
          </p>
        )}
      </div>
      <div className="flex items-center gap-3 shrink-0">
        {right}
        <span style={{ color: "var(--ink-faint)" }}>
          <ChevronRight />
        </span>
      </div>
    </button>
  );
}

// ── Tone style pill ───────────────────────────────────────────────────────────

function TonePill({ tone }: { tone: string }) {
  return (
    <span
      className="text-xs px-2 py-0.5 rounded-full font-medium capitalize"
      style={{ background: "var(--border-mid)", color: "var(--ink-dim)" }}
    >
      {tone}
    </span>
  );
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
  const limitReached = monthlyLimit !== null && monthlyUsed >= monthlyLimit;

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
              InterviewX
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

        <main className="max-w-2xl mx-auto px-6 py-10 fade-up">

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
                You've used {monthlyUsed}/{monthlyLimit} interviews this month. Upgrade to continue.
              </p>
            </div>
          )}

          {/* ── COMPANIES ── */}
          {view.step === "companies" && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
                  Choose a company
                </h1>
                <p className="mt-1 text-sm" style={{ color: "var(--ink-dim)" }}>
                  Select a company to browse roles and interview rounds.
                </p>
              </div>

              {loading || detailLoading ? (
                <div className="space-y-3">
                  {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
                </div>
              ) : companyList.length === 0 ? (
                <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                  No companies available yet.
                </p>
              ) : (
                <div className="space-y-3">
                  {companyList.map((c) => (
                    <ListCard
                      key={c.id}
                      title={c.name}
                      subtitle={`Tone: ${c.tone_style}`}
                      onClick={() => handleSelectCompany(c.id)}
                      right={
                        <div className="flex items-center gap-2">
                          {c.is_free && (
                            <span
                              className="text-xs font-medium px-2 py-0.5 rounded-full"
                              style={{ background: "rgba(34,197,94,0.10)", color: "#22c55e" }}
                            >
                              Free tier
                            </span>
                          )}
                          <TonePill tone={c.tone_style} />
                        </div>
                      }
                    />
                  ))}
                </div>
              )}
            </>
          )}

          {/* ── ROLES ── */}
          {view.step === "roles" && (
            <>
              <div className="mb-6">
                <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
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
                  <h1 className="text-2xl font-bold" style={{ color: "var(--ink)" }}>
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
                        className="rounded-lg px-5 py-4 flex items-center justify-between gap-4"
                        style={{
                          background: "var(--surface)",
                          border: "1px solid var(--border-mid)",
                        }}
                      >
                        <div className="min-w-0">
                          <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                            {round.title}
                          </p>
                          <div className="mt-1.5">
                            <RoundTypeBadge type={round.round_type} />
                          </div>
                        </div>
                        <button
                          onClick={() => handleStartInterview(round.id)}
                          disabled={limitReached || starting === round.id}
                          className="shrink-0 px-4 py-2 rounded text-sm font-semibold transition-opacity disabled:opacity-40"
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
    </ProtectedRoute>
  );
}