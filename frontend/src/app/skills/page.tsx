"use client";
import { useEffect, useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { useAuth } from "@/context/AuthContext";
import ProtectedRoute from "@/components/ProtectedRoute";
import { skills, interviews, ApiError } from "@/lib/api";
import type { Company, CompanyDetail, Role } from "@/lib/api";
import { planOf, hasSkills } from "@/lib/plans";
import AppShell from "@/components/AppShell";

// ── Icons ─────────────────────────────────────────────────────────────────────

function ChevronRight() {
  return (
    <svg width="16" height="16" viewBox="0 0 16 16" fill="none">
      <path d="M6 3l5 5-5 5" stroke="currentColor" strokeWidth="1.5" strokeLinecap="round" strokeLinejoin="round" />
    </svg>
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
      style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
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

  const grouped = useMemo(() => {
    const groups: Record<string, Company[]> = {};
    for (const s of skillList) {
      const key = s.category || "General";
      (groups[key] ??= []).push(s);
    }
    return Object.entries(groups).sort(([a], [b]) => a.localeCompare(b));
  }, [skillList]);

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
      router.push(`/interview/${res.session_id}`);
    } catch (err) {
      if (err instanceof ApiError) setStartError(err.detail);
      else setStartError("Failed to start interview. Try again.");
      setStarting(null);
    }
  };

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
    <ProtectedRoute>
      <AppShell>
        <div className="min-h-screen" style={{ background: "var(--page)" }}>
          <main className="max-w-2xl mx-auto px-6 py-10 fade-up">
            <Breadcrumbs crumbs={crumbs} />

            {!entitled ? (
              <div
                className="rounded-lg px-6 py-8 text-center"
                style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
              >
                <h1 className="font-display text-xl font-bold mb-2" style={{ color: "var(--ink)" }}>
                  Skills is a Premium & Max feature
                </h1>
                <p className="text-sm mb-5" style={{ color: "var(--ink-dim)" }}>
                  Practice a single skill — like React, SQL, or System Design — instead of a
                  full company loop. Upgrade to Premium or Max to unlock it.
                </p>
                <button
                  onClick={() => router.push("/upgrade")}
                  className="px-4 py-2 rounded-full text-sm font-semibold"
                  style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                >
                  Upgrade plan
                </button>
              </div>
            ) : (
              <>
                {fetchError && (
                  <p
                    className="mb-6 text-sm rounded px-3 py-2"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--danger)" }}
                  >
                    {fetchError}
                  </p>
                )}

                {startError && (
                  <p
                    className="mb-6 text-sm rounded px-3 py-2"
                    style={{ background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.3)", color: "var(--danger)" }}
                  >
                    {startError}
                  </p>
                )}

                {limitReached && (
                  <div
                    className="mb-6 rounded-lg px-5 py-4"
                    style={{ background: "rgba(99,102,241,0.08)", border: "1px solid rgba(99,102,241,0.25)" }}
                  >
                    <p className="text-sm font-medium" style={{ color: "var(--accent)" }}>
                      {plan.label} plan limit reached
                    </p>
                    <p className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>
                      You've used {monthlyUsed}/{monthlyLimit} interviews this month. Upgrade to continue.
                    </p>
                  </div>
                )}

                {/* ── SKILLS (grouped by category) ── */}
                {view.step === "skills" && (
                  <>
                    <div className="mb-6">
                      <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
                        Practice by skill
                      </h1>
                      <p className="mt-1 text-sm" style={{ color: "var(--ink-dim)" }}>
                        Skip the company loop — drill a single skill directly.
                      </p>
                    </div>

                    {loading || detailLoading ? (
                      <div className="space-y-3">
                        {[1, 2, 3].map((n) => <SkeletonCard key={n} />)}
                      </div>
                    ) : skillList.length === 0 ? (
                      <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                        No skills available yet.
                      </p>
                    ) : (
                      <div className="space-y-8">
                        {grouped.map(([category, items]) => (
                          <div key={category}>
                            <h2
                              className="text-xs font-semibold uppercase tracking-wider mb-3"
                              style={{ color: "var(--ink-faint)" }}
                            >
                              {category}
                            </h2>
                            <div className="space-y-3">
                              {items.map((s) => (
                                <ListCard
                                  key={s.id}
                                  title={s.name}
                                  subtitle={s.description || `Tone: ${s.tone_style}`}
                                  onClick={() => handleSelectSkill(s.id)}
                                  right={<TonePill tone={s.tone_style} />}
                                />
                              ))}
                            </div>
                          </div>
                        ))}
                      </div>
                    )}
                  </>
                )}

                {/* ── ROLES (difficulty tracks) ── */}
                {view.step === "roles" && (
                  <>
                    <div className="mb-6">
                      <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
                        {view.skill.name}
                      </h1>
                      <p className="mt-1 text-sm" style={{ color: "var(--ink-dim)" }}>
                        Pick a difficulty track to see available rounds.
                      </p>
                    </div>

                    {view.skill.roles.length === 0 ? (
                      <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                        No tracks available for this skill yet.
                      </p>
                    ) : (
                      <div className="space-y-3">
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
                      <div className="mb-6">
                        <h1 className="font-display text-2xl font-bold" style={{ color: "var(--ink)" }}>
                          {v.role.title}
                        </h1>
                        <p className="mt-1 text-sm" style={{ color: "var(--ink-dim)" }}>
                          Select a round to start your skill interview.
                        </p>
                      </div>

                      {v.role.rounds.length === 0 ? (
                        <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                          No rounds configured yet.
                        </p>
                      ) : (
                        <div className="space-y-3">
                          {v.role.rounds.map((round) => (
                            <div
                              key={round.id}
                              className="rounded-lg px-5 py-4 flex items-center justify-between gap-4"
                              style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
                            >
                              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                                {round.title}
                              </p>
                              <button
                                onClick={() => handleStartInterview(round.id)}
                                disabled={limitReached || starting === round.id}
                                className="shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-opacity disabled:opacity-40"
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
              </>
            )}
          </main>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
