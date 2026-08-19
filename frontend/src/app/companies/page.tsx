"use client";
import { useEffect, useState } from "react";
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
import { ArrowLeft } from "@/components/ui/Icon";
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { ListCard } from "@/components/ui/ListCard";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TonePill, RoundTypeBadge, FreeTierBadge } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";

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

  const companySearch = useSearchAndPaginate(companyList, (c) => c.name);

  return (
    <ProtectedRoute>
      <AppShell>
      <div className="min-h-screen bg-page">

        {/* Nav — only shown for free plan; paid plans use the sidebar instead */}
        {!isPro && (
          <nav className="flex items-center justify-between px-6 py-4 border-b border-surface">
            <button
              onClick={() => router.push("/dashboard")}
              className="text-lg font-bold tracking-tight text-ink"
            >
              EvaluLabs
            </button>
            <button
              onClick={() => router.push("/dashboard")}
              className="flex items-center gap-1.5 text-sm hover:underline text-ink-dim"
            >
              <ArrowLeft />
              Dashboard
            </button>
          </nav>
        )}

        <main className="max-w-2xl mx-auto px-6 py-10">

          <Breadcrumbs crumbs={crumbs} />

          {/* Global fetch error */}
          {fetchError && (
            <Alert tone="danger" className="mb-6">{fetchError}</Alert>
          )}

          {/* Start error */}
          {startError && (
            <Alert tone="danger" className="mb-6">{startError}</Alert>
          )}

          {/* Limit warning */}
          {limitReached && (
            <Card tone="muted" pad="sm" className="mb-6">
              <p className="text-sm font-medium text-accent">
                {plan.label} plan limit reached
              </p>
              <p className="text-xs mt-1 text-ink-dim">
                You've used {monthlyUsed}/{monthlyLimit} interviews this month.
              </p>
              <div className="flex flex-wrap gap-2.5 mt-3">
                <Button variant="primary" size="sm" onClick={() => setShowTopup(true)}>
                  Buy more interviews
                </Button>
                <Button variant="outline-accent" size="sm" onClick={() => router.push("/pricing")}>
                  Upgrade plan →
                </Button>
              </div>
            </Card>
          )}

          {/* ── COMPANIES ── */}
          {view.step === "companies" && (
            <>
              <div className="mb-6">
                <h1 className="font-display text-2xl font-bold text-ink">
                  Choose a company
                </h1>
                <p className="mt-1 text-sm text-ink-dim">
                  Select a company to browse roles and interview rounds.
                </p>
              </div>

              {companyList.length > 0 && (
                <Input
                  type="text"
                  value={companySearch.query}
                  onChange={(e) => companySearch.setQuery(e.target.value)}
                  placeholder="Search companies…"
                  className="mb-5"
                />
              )}

              {loading || detailLoading ? (
                <SkeletonList />
              ) : companyList.length === 0 ? (
                <p className="text-sm text-ink-dim">
                  No companies available yet.
                </p>
              ) : companySearch.results.length === 0 ? (
                <p className="text-sm text-ink-dim">
                  No companies match "{companySearch.query}".
                </p>
              ) : (
                <>
                  <RevealGroup className="space-y-3">
                    {companySearch.results.map((c) => (
                      <RevealItem key={c.id}>
                        <ListCard
                          title={c.name}
                          subtitle={`Tone: ${c.tone_style} · ${c.question_count ?? 0} question${c.question_count === 1 ? "" : "s"}`}
                          onClick={() => handleSelectCompany(c.id)}
                          right={
                            <div className="flex items-center gap-2">
                              {c.is_free && <FreeTierBadge />}
                              <TonePill tone={c.tone_style} />
                            </div>
                          }
                        />
                      </RevealItem>
                    ))}
                  </RevealGroup>
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
                <h1 className="font-display text-2xl font-bold text-ink">
                  {view.company.name}
                </h1>
                <p className="mt-1 text-sm text-ink-dim">
                  Pick a role to see available interview rounds.
                </p>
              </div>

              {view.company.roles.length === 0 ? (
                <p className="text-sm text-ink-dim">
                  No roles available for this company yet.
                </p>
              ) : (
                <RevealGroup className="space-y-3">
                  {view.company.roles.map((role) => (
                    <RevealItem key={role.id}>
                      <ListCard
                        title={role.title}
                        subtitle={`${role.rounds.length} round${role.rounds.length !== 1 ? "s" : ""}`}
                        onClick={() => handleSelectRole(view.company, role)}
                      />
                    </RevealItem>
                  ))}
                </RevealGroup>
              )}
            </>
          )}

          {/* ── ROUNDS ── */}
          {view.step === "rounds" && (() => {
            const v = view as { step: "rounds"; company: CompanyDetail; role: Role };
            return (
              <>
                <div className="mb-6">
                  <h1 className="font-display text-2xl font-bold text-ink">
                    {v.role.title}
                  </h1>
                  <p className="mt-1 text-sm text-ink-dim">
                    Select a round to start your AI interview.
                  </p>
                </div>

                {v.role.rounds.length === 0 ? (
                  <p className="text-sm text-ink-dim">
                    No rounds configured for this role yet.
                  </p>
                ) : (
                  <RevealGroup className="space-y-3">
                    {v.role.rounds.map((round) => (
                      <RevealItem key={round.id}>
                        <Card pad="sm" className="flex items-center justify-between gap-4">
                          <div className="min-w-0">
                            <p className="text-sm font-medium text-ink">
                              {round.title}
                            </p>
                            <div className="mt-1.5">
                              <RoundTypeBadge type={round.round_type} />
                            </div>
                          </div>
                          <Button
                            variant="primary"
                            size="sm"
                            className="shrink-0"
                            disabled={limitReached || starting === round.id}
                            onClick={() => handleStartInterview(round.id)}
                          >
                            {starting === round.id ? "Starting…" : "Start interview"}
                          </Button>
                        </Card>
                      </RevealItem>
                    ))}
                  </RevealGroup>
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
