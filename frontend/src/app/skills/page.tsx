"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { skills, interviews, ApiError } from "@/lib/api";
import type { Company, CompanyDetail, Role } from "@/lib/api";
import { planOf, hasSkills } from "@/lib/plans";
import AppShell from "@/components/AppShell";
import PaginationControls from "@/components/PaginationControls";
import { useSearchAndPaginate } from "@/hooks/useSearchAndPaginate";
import { SkeletonCard } from "@/components/Skeleton";
import InterviewInstructionsModal from "@/components/InterviewInstructionsModal";
import { PageContainer, PageHeader, EmptyState, Notice, SearchField, IconSpark } from "@/components/ui";

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
  );
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
      className="company-row w-full text-left px-4 py-4 sm:px-[22px] flex items-center justify-between gap-4 disabled:opacity-40 border-b last:border-b-0"
      style={{ background: "var(--surface)", borderColor: "var(--border)" }}
    >
      <div className="flex items-center gap-3 sm:gap-4 min-w-0">
        {avatarLabel && (
          <span
            className="company-avatar w-[38px] h-[38px] rounded-[11px] flex items-center justify-center font-mono text-[13px] font-bold shrink-0"
            style={{ background: "var(--page)", border: "1px solid var(--border)", color: "var(--ink)" }}
          >
            {avatarLabel}
          </span>
        )}
        <div className="min-w-0">
          <p className="company-title font-display text-[17px] sm:text-[19px] font-semibold leading-snug truncate tracking-[-0.02em]" style={{ color: "var(--ink)" }}>
            {title}
          </p>
          {subtitle && (
            <p className="company-subtitle text-xs sm:text-[13px] mt-0.5 truncate" style={{ color: "var(--ink-faint)" }}>
              {subtitle}
            </p>
          )}
        </div>
      </div>
      <div className="flex items-center gap-3 sm:gap-4 shrink-0">
        {right}
        <span className="company-chevron" style={{ color: "var(--ink-faint)" }}>
          <ChevronRight />
        </span>
      </div>
    </button>
  );
}

function TonePill({ tone }: { tone: string }) {
  return (
    <span
      className="company-tonepill hidden sm:inline font-mono text-[10px] uppercase tracking-[0.08em] px-[11px] py-1.5 rounded-full"
      style={{ background: "var(--page)", border: "1px solid var(--border)", color: "var(--ink-dim)" }}
    >
      {tone.replace(/_/g, " ")}
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
  | { step: "skills" }
  | { step: "roles"; skill: CompanyDetail }
  | { step: "rounds"; skill: CompanyDetail; role: Role };

export default function SkillsPage() {
  const { user } = useAuth();
  const router = useRouter();
  const entitled = hasSkills(user?.subscription_plan);

  const [view, setView] = useState<View>({ step: "skills" });
  const [skillList, setSkillList] = useState<Company[]>([]);
  const [loading, setLoading] = useState(true);
  const [detailLoading, setDetailLoading] = useState(false);
  const [fetchError, setFetchError] = useState("");
  const [starting, setStarting] = useState<number | null>(null);
  const [startError, setStartError] = useState("");

  useEffect(() => {
    if (!entitled) {
      setLoading(false);
      return;
    }
    skills
      .list()
      .then(setSkillList)
      .catch((err) => {
        if (err instanceof ApiError) setFetchError(err.detail);
        else setFetchError("Could not load skills.");
      })
      .finally(() => setLoading(false));
  }, [entitled]);

  const skillSearch = useSearchAndPaginate(skillList, (s) => s.name);

  // Grouped by category from whatever the current page (or, while
  // searching, every match) contains - not the full unfiltered list.
  const grouped = useMemo(() => {
    const groups: Record<string, Company[]> = {};
    for (const s of skillSearch.results) {
      const key = s.category || "General";
      (groups[key] ??= []).push(s);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [skillSearch.results]);

  const handleSelectSkill = async (id: number) => {
    setDetailLoading(true);
    setFetchError("");
    try {
      const detail = await skills.detail(id);
      setView({ step: "roles", skill: detail });
    } catch (err) {
      if (err instanceof ApiError) setFetchError(err.detail);
      else setFetchError("Could not load skill details.");
    } finally {
      setDetailLoading(false);
    }
  };

  const handleSelectRole = (skill: CompanyDetail, role: Role) => {
    setView({ step: "rounds", skill, role });
  };

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

  const crumbs: Crumb[] = [
    { label: "Dashboard", onClick: () => router.push("/dashboard") },
    { label: "Skills", onClick: () => setView({ step: "skills" }) },
  ];
  if (view.step === "roles") {
    crumbs.push({ label: view.skill.name, onClick: () => {} });
  }
  if (view.step === "rounds") {
    const v = view as { step: "rounds"; skill: CompanyDetail; role: Role };
    crumbs.push({ label: v.skill.name, onClick: () => setView({ step: "roles", skill: v.skill }) });
    crumbs.push({ label: v.role.title, onClick: () => {} });
  }

  const plan = planOf(user?.subscription_plan);
  const monthlyUsed = (user as any)?.interviews_this_month ?? 0;
  const monthlyLimit = plan.monthlyLimit;
  const limitReached = monthlyLimit !== null && monthlyUsed >= monthlyLimit;

  return (
    <ProtectedRoute redirect={false}>
      <AppShell>
        <div className="min-h-screen" style={{ background: "var(--page)" }}>
          <PageContainer>
            <Breadcrumbs crumbs={crumbs} />

            {!entitled ? (
              <EmptyState
                icon={<IconSpark />}
                title="Skills is a Premium & Max feature"
                body="Practice a single skill — like React, SQL, or System Design — instead of a full company loop. Upgrade to Premium or Max to unlock it."
                action={
                  <button onClick={() => router.push("/pricing")} className="btn btn-primary">
                    Upgrade plan
                  </button>
                }
              />
            ) : (
              <>
                {fetchError && <Notice tone="error" className="mb-5">{fetchError}</Notice>}
                {startError && <Notice tone="error" className="mb-5">{startError}</Notice>}
                {limitReached && (
                  <Notice tone="warn" className="mb-5" title={`${plan.label} plan limit reached`}>
                    You&apos;ve used {monthlyUsed}/{monthlyLimit} interviews this month. Upgrade to continue.
                  </Notice>
                )}

                {/* ── SKILLS (grouped by category) ── */}
                {view.step === "skills" && (
                  <>
                    <PageHeader
                      eyebrow="Step 1 of 3 · Skill"
                      title="Practice by skill"
                      subtitle="Skip the company loop — drill a single skill directly."
                    />

                    {skillList.length > 0 && (
                      <SearchField
                        value={skillSearch.query}
                        onChange={skillSearch.setQuery}
                        placeholder="Search skills…"
                        className="mb-5"
                      />
                    )}

                    {loading || detailLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
                      </div>
                    ) : skillList.length === 0 ? (
                      <EmptyState compact icon={<IconSpark />} title="No skills available yet" />
                    ) : skillSearch.results.length === 0 ? (
                      <EmptyState
                        compact
                        title="No matches"
                        body={<>No skills match &quot;{skillSearch.query}&quot;.</>}
                        action={<button className="btn btn-secondary btn-sm" onClick={() => skillSearch.setQuery("")}>Clear search</button>}
                      />
                    ) : (
                      <>
                        <div className="space-y-6">
                          {grouped.map(([category, items]) => (
                            <div key={category}>
                              <h2 className="font-label mb-2.5">{category}</h2>
                              <div className="ui-card overflow-hidden">
                                {items.map((s) => (
                                  <ListCard
                                    key={s.id}
                                    title={s.name}
                                    subtitle={s.description || `Tone: ${s.tone_style}`}
                                    avatarLabel={initialsOf(s.name)}
                                    onClick={() => handleSelectSkill(s.id)}
                                    right={<TonePill tone={s.tone_style} />}
                                  />
                                ))}
                              </div>
                            </div>
                          ))}
                        </div>
                        {!skillSearch.isSearching && (
                          <PaginationControls
                            page={skillSearch.page}
                            totalPages={skillSearch.totalPages}
                            onChange={skillSearch.setPage}
                          />
                        )}
                      </>
                    )}
                  </>
                )}

                {/* ── ROLES (difficulty tracks) ── */}
                {view.step === "roles" && (
                  <>
                    <PageHeader
                      eyebrow="Step 2 of 3 · Track"
                      title={view.skill.name}
                      subtitle="Pick a difficulty track to see available rounds."
                    />

                    {view.skill.roles.length === 0 ? (
                      <EmptyState compact title="No tracks yet" body="No tracks available for this skill yet." />
                    ) : (
                      <div className="ui-card overflow-hidden">
                        {view.skill.roles.map((role) => (
                          <ListCard
                            key={role.id}
                            title={role.title}
                            subtitle={`${role.rounds.length} round${role.rounds.length !== 1 ? "s" : ""}`}
                            onClick={() => handleSelectRole(view.skill, role)}
                          />
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* ── ROUNDS ── */}
                {view.step === "rounds" && (() => {
                  const v = view as { step: "rounds"; skill: CompanyDetail; role: Role };
                  return (
                    <>
                      <PageHeader
                        eyebrow="Step 3 of 3 · Round"
                        title={v.role.title}
                        subtitle="Select a round to start your skill interview."
                      />

                      {v.role.rounds.length === 0 ? (
                        <EmptyState compact title="No rounds yet" body="No rounds configured yet." />
                      ) : (
                        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
                          {v.role.rounds.map((round, i) => (
                            <div key={round.id} className="ui-card card-hover p-5 flex flex-col gap-4">
                              <span className="font-mono text-[11px]" style={{ color: "var(--ink-faint)" }}>
                                Round {String(i + 1).padStart(2, "0")}
                              </span>
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
              </>
            )}
          </PageContainer>
        </div>
      </AppShell>

      {pendingRound && view.step === "rounds" && (
        <InterviewInstructionsModal
          companyName={view.skill.name}
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
