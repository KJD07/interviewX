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
import { Breadcrumbs, type Crumb } from "@/components/ui/Breadcrumbs";
import { ListCard } from "@/components/ui/ListCard";
import { SkeletonList } from "@/components/ui/Skeleton";
import { Alert } from "@/components/ui/Alert";
import { Button } from "@/components/ui/Button";
import { Card } from "@/components/ui/Card";
import { TonePill } from "@/components/ui/Badge";
import { Input } from "@/components/ui/Field";
import { RevealGroup, RevealItem } from "@/components/motion/Reveal";

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
        <div className="min-h-screen bg-page">
          <main className="max-w-2xl mx-auto px-6 py-10">
            <Breadcrumbs crumbs={crumbs} />

            {!entitled ? (
              <Card pad="lg" className="text-center py-8">
                <h1 className="font-display text-xl font-bold mb-2 text-ink">
                  Skills is a Premium & Max feature
                </h1>
                <p className="text-sm mb-5 text-ink-dim">
                  Practice a single skill — like React, SQL, or System Design — instead of a
                  full company loop. Upgrade to Premium or Max to unlock it.
                </p>
                <Button variant="primary" size="md" onClick={() => router.push("/pricing")}>
                  Upgrade plan
                </Button>
              </Card>
            ) : (
              <>
                {fetchError && <Alert tone="danger" className="mb-6">{fetchError}</Alert>}

                {startError && <Alert tone="danger" className="mb-6">{startError}</Alert>}

                {limitReached && (
                  <Card tone="muted" pad="sm" className="mb-6">
                    <p className="text-sm font-medium text-accent">
                      {plan.label} plan limit reached
                    </p>
                    <p className="text-xs mt-1 text-ink-dim">
                      You've used {monthlyUsed}/{monthlyLimit} interviews this month. Upgrade to continue.
                    </p>
                  </Card>
                )}

                {/* ── SKILLS (grouped by category) ── */}
                {view.step === "skills" && (
                  <>
                    <div className="mb-6">
                      <h1 className="font-display text-2xl font-bold text-ink">
                        Practice by skill
                      </h1>
                      <p className="mt-1 text-sm text-ink-dim">
                        Skip the company loop — drill a single skill directly.
                      </p>
                    </div>

                    {skillList.length > 0 && (
                      <Input
                        type="text"
                        value={skillSearch.query}
                        onChange={(e) => skillSearch.setQuery(e.target.value)}
                        placeholder="Search skills…"
                        className="mb-5"
                      />
                    )}

                    {loading || detailLoading ? (
                      <SkeletonList />
                    ) : skillList.length === 0 ? (
                      <p className="text-sm text-ink-dim">
                        No skills available yet.
                      </p>
                    ) : skillSearch.results.length === 0 ? (
                      <p className="text-sm text-ink-dim">
                        No skills match "{skillSearch.query}".
                      </p>
                    ) : (
                      <>
                        <div className="space-y-8">
                          {grouped.map(([category, items]) => (
                            <div key={category}>
                              <h2 className="text-xs font-semibold uppercase tracking-wider mb-3 text-ink-faint">
                                {category}
                              </h2>
                              <RevealGroup className="space-y-3">
                                {items.map((s) => (
                                  <RevealItem key={s.id}>
                                    <ListCard
                                      title={s.name}
                                      subtitle={s.description || `Tone: ${s.tone_style}`}
                                      onClick={() => handleSelectSkill(s.id)}
                                      right={<TonePill tone={s.tone_style} />}
                                    />
                                  </RevealItem>
                                ))}
                              </RevealGroup>
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
                    <div className="mb-6">
                      <h1 className="font-display text-2xl font-bold text-ink">
                        {view.skill.name}
                      </h1>
                      <p className="mt-1 text-sm text-ink-dim">
                        Pick a difficulty track to see available rounds.
                      </p>
                    </div>

                    {view.skill.roles.length === 0 ? (
                      <p className="text-sm text-ink-dim">
                        No tracks available for this skill yet.
                      </p>
                    ) : (
                      <RevealGroup className="space-y-3">
                        {view.skill.roles.map((role) => (
                          <RevealItem key={role.id}>
                            <ListCard
                              title={role.title}
                              subtitle={`${role.rounds.length} round${role.rounds.length !== 1 ? "s" : ""}`}
                              onClick={() => handleSelectRole(view.skill, role)}
                            />
                          </RevealItem>
                        ))}
                      </RevealGroup>
                    )}
                  </>
                )}

                {/* ── ROUNDS ── */}
                {view.step === "rounds" && (() => {
                  const v = view as { step: "rounds"; skill: CompanyDetail; role: Role };
                  return (
                    <>
                      <div className="mb-6">
                        <h1 className="font-display text-2xl font-bold text-ink">
                          {v.role.title}
                        </h1>
                        <p className="mt-1 text-sm text-ink-dim">
                          Select a round to start your skill interview.
                        </p>
                      </div>

                      {v.role.rounds.length === 0 ? (
                        <p className="text-sm text-ink-dim">
                          No rounds configured yet.
                        </p>
                      ) : (
                        <RevealGroup className="space-y-3">
                          {v.role.rounds.map((round) => (
                            <RevealItem key={round.id}>
                              <Card pad="sm" className="flex items-center justify-between gap-4">
                                <p className="text-sm font-medium text-ink">
                                  {round.title}
                                </p>
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
              </>
            )}
          </main>
        </div>
      </AppShell>
    </ProtectedRoute>
  );
}
