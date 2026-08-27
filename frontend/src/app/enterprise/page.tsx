"use client";
import { useEffect, useMemo, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import PaginationControls from "@/components/PaginationControls";
import { useSearchAndPaginate } from "@/hooks/useSearchAndPaginate";
import Link from "next/link";
import { organizations, ApiError } from "@/lib/api";
import type { OrgDashboard, OrgCandidateInvite, OrgRound, OrgRole } from "@/lib/api";
import { useCurrency, formatPrice } from "@/lib/currency";

const ENTERPRISE_PRICE_PER_SEAT_RUPEES = 99;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_STYLE: Record<OrgCandidateInvite["candidate_status"], { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "var(--surface-2)", color: "var(--ink-dim)" },
  live: { label: "Live", bg: "var(--accent-glow)", color: "var(--accent)" },
  finished: { label: "Finished", bg: "var(--success-bg)", color: "var(--success)" },
  expired: { label: "Expired", bg: "#F7EAE7", color: "var(--danger)" },
};

function StatusBadge({ status }: { status: OrgCandidateInvite["candidate_status"] }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="text-xs font-medium px-2 py-0.5 rounded-full" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function formatScores(scores: Record<string, number> | null) {
  if (!scores || scores.overall === undefined) return null;
  return `${scores.overall}/10`;
}

function Card({ title, subtitle, action, children }: {
  title: string;
  subtitle?: string;
  action?: React.ReactNode;
  children: React.ReactNode;
}) {
  return (
    <div
      className="rounded-3xl overflow-hidden shadow-[0_8px_32px_rgba(28,26,22,0.06)]"
      style={{ border: "1px solid var(--border)", background: "var(--surface)" }}
    >
      <div
        className="flex items-start justify-between gap-4 px-4 sm:px-6 py-5"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <h2 className="font-display text-base font-bold" style={{ color: "var(--ink)" }}>{title}</h2>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--ink-dim)" }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="px-4 sm:px-6 py-5">{children}</div>
    </div>
  );
}

function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div
      className="rounded-2xl px-4 py-4 shadow-[0_4px_16px_rgba(28,26,22,0.05)]"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="font-display text-2xl font-bold tabular-nums" style={{ color: tone ?? "var(--ink)" }}>
        {value}
      </p>
      <p className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>{label}</p>
    </div>
  );
}

function UploadCard({ onUploaded }: { onUploaded: () => void }) {
  const [file, setFile] = useState<File | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");
  const [summary, setSummary] = useState("");

  const handleUpload = async () => {
    if (!file) return;
    setBusy(true);
    setError("");
    setSummary("");
    try {
      const result = await organizations.uploadQuestions(file);
      setSummary(
        `Imported ${result.questions_created} question(s) ` +
          `(${result.roles_created} new role(s), ${result.rounds_created} new round(s)) ` +
          `out of ${result.rows_seen} row(s) seen. Skipped ${result.rows_skipped}.`
      );
      setFile(null);
      onUploaded();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Upload failed.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Upload question bank" subtitle=".csv, .xlsx, or .json — Role, Round, Round Type, Question Text, Question Type, Ideal Answer">
      <div className="flex flex-wrap items-center gap-3">
        <label
          className="text-sm px-3.5 py-2 rounded-lg border cursor-pointer transition-colors"
          style={{ borderColor: "var(--border-mid)", color: "var(--ink-dim)" }}
        >
          {file ? file.name : "Choose file…"}
          <input
            type="file"
            accept=".csv,.xlsx,.json"
            onChange={(e) => setFile(e.target.files?.[0] ?? null)}
            className="hidden"
          />
        </label>
        <button
          onClick={handleUpload}
          disabled={!file || busy}
          className="px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-40 transition-opacity"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      {error && <p className="text-sm mt-3" style={{ color: "var(--danger)" }}>{error}</p>}
      {summary && <p className="text-sm mt-3" style={{ color: "var(--success)" }}>{summary}</p>}
    </Card>
  );
}

function QuestionBankCard({ dashboard }: { dashboard: OrgDashboard }) {
  const roles: OrgRole[] = dashboard.question_bank;
  const totalQuestions = roles.reduce(
    (sum, role) => sum + role.rounds.reduce((s, r) => s + r.questions.length, 0),
    0
  );
  const [openRole, setOpenRole] = useState<number | null>(roles[0]?.id ?? null);

  return (
    <Card
      title="Question bank"
      subtitle={roles.length > 0 ? `${roles.length} role(s) · ${totalQuestions} question(s) total` : undefined}
    >
      {roles.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
          No roles yet — upload a question bank to get started.
        </p>
      ) : (
        <div className="space-y-2">
          {roles.map((role) => {
            const roleQuestionCount = role.rounds.reduce((s, r) => s + r.questions.length, 0);
            const isOpen = openRole === role.id;
            return (
              <div key={role.id} className="rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
                <button
                  onClick={() => setOpenRole(isOpen ? null : role.id)}
                  className="w-full flex items-start sm:items-center justify-between gap-3 px-4 py-3 text-left transition-colors"
                  style={{ background: "var(--surface-2)" }}
                >
                  <span className="text-sm font-medium min-w-0 break-words" style={{ color: "var(--ink)" }}>{role.title}</span>
                  <span className="flex items-center gap-2 shrink-0">
                    <span className="text-xs text-right" style={{ color: "var(--ink-faint)" }}>
                      {role.rounds.length} round(s) · {roleQuestionCount} question(s)
                    </span>
                    <span
                      className="text-xs transition-transform"
                      style={{ color: "var(--ink-faint)", transform: isOpen ? "rotate(180deg)" : "none" }}
                    >
                      ▾
                    </span>
                  </span>
                </button>
                {isOpen && (
                  <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
                    {role.rounds.map((round: OrgRound) => (
                      <li key={round.id} className="text-sm flex items-center justify-between px-4 py-2.5" style={{ borderTop: "1px solid var(--border)" }}>
                        <span style={{ color: "var(--ink)" }}>
                          {round.title}
                          <span className="ml-1.5 text-xs" style={{ color: "var(--ink-faint)" }}>
                            {round.round_type}
                          </span>
                        </span>
                        <span className="text-xs" style={{ color: "var(--ink-faint)" }}>
                          {round.questions.length} question(s)
                        </span>
                      </li>
                    ))}
                  </ul>
                )}
              </div>
            );
          })}
        </div>
      )}
    </Card>
  );
}

function InviteForm({ dashboard, onInvited }: { dashboard: OrgDashboard; onInvited: () => void }) {
  const rounds: (OrgRound & { roleTitle: string })[] = dashboard.question_bank.flatMap((role) =>
    role.rounds.map((round) => ({ ...round, roleTitle: role.title }))
  );
  const [roundId, setRoundId] = useState<number | "">("");
  const [email, setEmail] = useState("");
  const [expiresInDays, setExpiresInDays] = useState(7);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState("");

  const handleInvite = async () => {
    if (!roundId || !email) return;
    setBusy(true);
    setError("");
    try {
      const expiresAt = new Date(Date.now() + expiresInDays * 86400000).toISOString();
      await organizations.invites.create(Number(roundId), email, expiresAt);
      setEmail("");
      onInvited();
    } catch (err) {
      setError(err instanceof ApiError ? err.detail : "Could not create invite.");
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card title="Invite a candidate" subtitle={rounds.length === 0 ? "Upload a question bank first" : undefined}>
      <div className="flex flex-wrap items-center gap-2">
        <select
          value={roundId}
          onChange={(e) => setRoundId(e.target.value ? Number(e.target.value) : "")}
          disabled={rounds.length === 0}
          className="text-sm px-3 py-2 rounded-lg border disabled:opacity-40 w-full sm:w-auto"
          style={{ borderColor: "var(--border-mid)", color: "var(--ink)", background: "var(--surface)" }}
        >
          <option value="">Select round…</option>
          {rounds.map((r) => (
            <option key={r.id} value={r.id}>
              {r.roleTitle} — {r.title}
            </option>
          ))}
        </select>
        <input
          type="email"
          placeholder="candidate@email.com"
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          className="text-sm px-3 py-2 rounded-lg border flex-1 min-w-0 w-full sm:min-w-[200px]"
          style={{ borderColor: "var(--border-mid)", color: "var(--ink)", background: "var(--surface)" }}
        />
        <input
          type="number"
          min={1}
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(Number(e.target.value) || 1)}
          className="text-sm px-3 py-2 rounded-lg border w-full sm:w-24"
          style={{ borderColor: "var(--border-mid)", color: "var(--ink)", background: "var(--surface)" }}
          title="Expires in (days)"
        />
        <button
          onClick={handleInvite}
          disabled={!roundId || !email || busy}
          className="px-4 py-2 rounded-full text-sm font-semibold disabled:opacity-40 transition-opacity"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          {busy ? "Sending…" : "Send invite"}
        </button>
      </div>
      {error && <p className="text-sm mt-3" style={{ color: "var(--danger)" }}>{error}</p>}
    </Card>
  );
}

const SCORE_LABELS: Record<string, string> = {
  overall: "Overall",
  communication: "Communication",
  technical: "Technical",
  problem_solving: "Problem solving",
};

function CandidateDetail({ invite }: { invite: OrgCandidateInvite }) {
  const scoreEntries = invite.scores
    ? Object.entries(invite.scores).filter(([key]) => key in SCORE_LABELS)
    : [];

  return (
    <div className="px-4 pb-5 pt-1">
      <div className="rounded-xl p-4 space-y-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
        {scoreEntries.length > 0 ? (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--ink-faint)" }}>
              Score breakdown
            </p>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-3">
              {scoreEntries.map(([key, value]) => (
                <div key={key} className="rounded-lg px-3 py-2" style={{ background: "var(--surface)", border: "1px solid var(--border)" }}>
                  <p className="font-display text-lg font-bold tabular-nums" style={{ color: "var(--ink)" }}>{value}/10</p>
                  <p className="text-xs mt-0.5" style={{ color: "var(--ink-dim)" }}>{SCORE_LABELS[key]}</p>
                </div>
              ))}
            </div>
          </div>
        ) : (
          <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
            No scores yet — this candidate hasn't finished their interview.
          </p>
        )}

        {invite.feedback && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--ink-faint)" }}>
              AI suggestion
            </p>
            <p className="text-sm whitespace-pre-line" style={{ color: "var(--ink)" }}>{invite.feedback}</p>
          </div>
        )}

        {invite.insights?.improvement_areas && invite.insights.improvement_areas.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--ink-faint)" }}>
              Improvement areas
            </p>
            <ul className="space-y-1.5">
              {invite.insights.improvement_areas.map((item, i) => (
                <li key={i} className="text-sm" style={{ color: "var(--ink-dim)" }}>
                  <span className="font-medium" style={{ color: "var(--ink)" }}>{item.area}:</span> {item.suggestion}
                </li>
              ))}
            </ul>
          </div>
        )}

        {invite.insights?.topics && invite.insights.topics.length > 0 && (
          <div>
            <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--ink-faint)" }}>
              Topics covered
            </p>
            <div className="flex flex-wrap gap-2">
              {invite.insights.topics.map((topic, i) => (
                <span
                  key={i}
                  className="text-xs px-2.5 py-1 rounded-full"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)", color: "var(--ink-dim)" }}
                  title={topic.note}
                >
                  {topic.name} · {topic.score}/10
                </span>
              ))}
            </div>
          </div>
        )}
      </div>
    </div>
  );
}

function InvitesTable({ invites, liveCameraEnabled }: { invites: OrgCandidateInvite[]; liveCameraEnabled: boolean }) {
  const search = useSearchAndPaginate(
    invites,
    (inv) => `${inv.candidate_email} ${inv.role_title} ${inv.round_title} ${inv.candidate_status}`
  );
  const [expandedId, setExpandedId] = useState<number | null>(null);
  const columns = liveCameraEnabled
    ? "1.3fr 1.3fr 90px 70px 110px 90px"
    : "1.4fr 1.4fr 100px 80px 90px";

  return (
    <Card title="Candidates" subtitle={`${invites.length} invite(s) sent`}>
      {invites.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ink-faint)" }}>No candidates invited yet.</p>
      ) : (
        <>
          <input
            type="text"
            value={search.query}
            onChange={(e) => search.setQuery(e.target.value)}
            placeholder="Search by candidate, role, or round…"
            className="w-full rounded-lg px-3.5 py-2.5 text-sm mb-4"
            style={{ background: "var(--surface-2)", border: "1px solid var(--border-mid)", color: "var(--ink)" }}
          />

          {search.results.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-dim)" }}>No candidates match "{search.query}".</p>
          ) : (
            <div className="hidden md:block rounded-xl overflow-hidden" style={{ border: "1px solid var(--border)" }}>
              <div
                className="grid text-xs font-medium uppercase tracking-wider px-4 py-2.5"
                style={{
                  gridTemplateColumns: columns,
                  background: "var(--surface-2)",
                  color: "var(--ink-dim)",
                  borderBottom: "1px solid var(--border)",
                }}
              >
                <span>Candidate</span>
                <span>Role / round</span>
                <span>Status</span>
                <span>Score</span>
                {liveCameraEnabled && <span>Live view</span>}
                <span className="text-right">Expires</span>
              </div>
              {search.results.map((inv, i) => {
                const isOpen = expandedId === inv.id;
                return (
                  <div
                    key={inv.id}
                    style={{
                      borderBottom: i < search.results.length - 1 ? "1px solid var(--border)" : "none",
                      background: i % 2 === 0 ? "transparent" : "var(--surface-2)",
                    }}
                  >
                    <div
                      role="button"
                      tabIndex={0}
                      onClick={() => setExpandedId(isOpen ? null : inv.id)}
                      onKeyDown={(e) => {
                        if (e.key === "Enter" || e.key === " ") {
                          e.preventDefault();
                          setExpandedId(isOpen ? null : inv.id);
                        }
                      }}
                      className="w-full grid items-center px-4 py-3 text-left cursor-pointer"
                      style={{ gridTemplateColumns: columns }}
                    >
                      <span className="text-sm truncate flex items-center gap-1.5" style={{ color: "var(--ink)" }}>
                        <span
                          className="text-xs transition-transform duration-200"
                          style={{ color: "var(--ink-faint)", transform: isOpen ? "rotate(90deg)" : "none" }}
                        >
                          ▸
                        </span>
                        {inv.candidate_email}
                      </span>
                      <span className="text-sm truncate" style={{ color: "var(--ink-dim)" }}>
                        {inv.role_title} — {inv.round_title}
                      </span>
                      <StatusBadge status={inv.candidate_status} />
                      <span className="text-sm tabular-nums" style={{ color: "var(--ink-dim)" }}>
                        {formatScores(inv.scores) ?? "—"}
                      </span>
                      {liveCameraEnabled && (
                        <span>
                          {inv.candidate_status === "live" && inv.session ? (
                            <Link
                              href={`/enterprise/live/${inv.session}`}
                              onClick={(e) => e.stopPropagation()}
                              className="text-xs font-semibold px-2.5 py-1 rounded-full"
                              style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                            >
                              Watch live
                            </Link>
                          ) : (
                            <span className="text-xs" style={{ color: "var(--ink-faint)" }}>—</span>
                          )}
                        </span>
                      )}
                      <span className="text-xs text-right" style={{ color: "var(--ink-faint)" }}>{formatDate(inv.expires_at)}</span>
                    </div>
                    <div
                      className="grid transition-all duration-300 ease-in-out"
                      style={{ gridTemplateRows: isOpen ? "1fr" : "0fr", opacity: isOpen ? 1 : 0 }}
                    >
                      <div className="overflow-hidden">
                        <CandidateDetail invite={inv} />
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>
          )}

          {search.results.length > 0 && (
            <div className="md:hidden space-y-3">
              {search.results.map((inv) => {
                const isOpen = expandedId === inv.id;
                return (
                  <div key={inv.id} className="rounded-xl p-4" style={{ background: "var(--surface-2)", border: "1px solid var(--border)" }}>
                    <button
                      onClick={() => setExpandedId(isOpen ? null : inv.id)}
                      className="w-full text-left"
                    >
                      <div className="flex items-start justify-between gap-3">
                        <span className="text-sm font-medium break-all" style={{ color: "var(--ink)" }}>{inv.candidate_email}</span>
                        <StatusBadge status={inv.candidate_status} />
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-xs" style={{ color: "var(--ink-dim)" }}>
                        <span>{inv.role_title} — {inv.round_title}</span>
                        <span>Score: {formatScores(inv.scores) ?? "—"}</span>
                        <span>Expires {formatDate(inv.expires_at)}</span>
                      </div>
                    </button>
                    {liveCameraEnabled && inv.candidate_status === "live" && inv.session && (
                      <Link
                        href={`/enterprise/live/${inv.session}`}
                        className="inline-flex mt-3 text-xs font-semibold px-3 py-1.5 rounded-full"
                        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
                      >
                        Watch live
                      </Link>
                    )}
                    {isOpen && <CandidateDetail invite={inv} />}
                  </div>
                );
              })}
            </div>
          )}

          {!search.isSearching && (
            <PaginationControls page={search.page} totalPages={search.totalPages} onChange={search.setPage} />
          )}
        </>
      )}
    </Card>
  );
}

function EnterprisePricingCard() {
  const currency = useCurrency();
  return (
    <div
      className="rounded-3xl p-8 shadow-[0_8px_32px_rgba(28,26,22,0.06)] mt-6 text-left"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <p className="text-xs font-semibold uppercase tracking-wider mb-2" style={{ color: "var(--ink-faint)" }}>
        Enterprise pricing
      </p>
      <div className="flex items-baseline gap-1.5 mb-4">
        <span className="font-display text-4xl font-bold" style={{ color: "var(--ink)" }}>
          {formatPrice(ENTERPRISE_PRICE_PER_SEAT_RUPEES, currency)}
        </span>
        <span className="text-sm" style={{ color: "var(--ink-faint)" }}>/ seat / month</span>
      </div>
      <ul className="space-y-2 mb-6">
        {[
          "Bulk candidate invites with expiring links",
          "Custom question bank upload (.csv, .xlsx, .json)",
          "Org-wide candidate quota & progress tracking",
          "Priority support",
        ].map((f) => (
          <li key={f} className="flex items-start gap-2.5 text-sm" style={{ color: "var(--ink)" }}>
            <span style={{ color: "var(--accent)" }}>✓</span>
            {f}
          </li>
        ))}
      </ul>
      <a
        href="/contact"
        className="inline-flex px-5 py-2.5 rounded-full text-sm font-semibold transition-transform duration-200 hover:scale-[1.02]"
        style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
      >
        Talk to sales →
      </a>
    </div>
  );
}

type EnterpriseView = "overview" | "candidate" | "questions";

export function EnterprisePageContent({ view = "overview" }: { view?: EnterpriseView }) {
  const [dashboard, setDashboard] = useState<OrgDashboard | null>(null);
  const [invites, setInvites] = useState<OrgCandidateInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [notMember, setNotMember] = useState(false);
  const [error, setError] = useState("");

  const load = () => {
    setLoading(true);
    Promise.all([organizations.dashboard(), organizations.invites.list()])
      .then(([d, inv]) => {
        setDashboard(d);
        setInvites(inv);
      })
      .catch((err) => {
        if (err instanceof ApiError && err.status === 404) {
          setNotMember(true);
        } else {
          setError(err instanceof ApiError ? err.detail : "Could not load your organization.");
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    load();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const quotaUsed = dashboard?.organization.candidates_used ?? 0;
  const quotaTotal = dashboard?.organization.candidate_quota ?? 0;
  const quotaPct = quotaTotal > 0 ? Math.min(100, Math.round((quotaUsed / quotaTotal) * 100)) : 0;
  const quotaTone = quotaPct >= 90 ? "var(--danger)" : quotaPct >= 70 ? "#B8862F" : "var(--success)";

  const counts = dashboard?.invite_counts ?? {};
  const totalQuestions = useMemo(
    () =>
      dashboard?.question_bank.reduce(
        (sum, role) => sum + role.rounds.reduce((s, r) => s + r.questions.length, 0),
        0
      ) ?? 0,
    [dashboard]
  );

  return (
    <ProtectedRoute>
      <AppShell enterprise>
      <div className="min-h-screen" style={{ background: "var(--page)" }}>
        <main className={`max-w-5xl mx-auto px-6 ${view === "overview" ? "pt-16 sm:pt-20" : "pt-10"} pb-10 fade-up`}>

          {loading && <p className="text-sm" style={{ color: "var(--ink-dim)" }}>Loading…</p>}

          {notMember && !loading && (
            <div
              className="rounded-3xl p-10 text-center shadow-[0_8px_32px_rgba(28,26,22,0.06)]"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                You're not a member of any organization yet.
              </p>
              <p className="mt-1 text-sm" style={{ color: "var(--ink-dim)" }}>
                Contact EvaluLabs to set up your company's account.
              </p>
              <EnterprisePricingCard />
            </div>
          )}

          {error && !loading && <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>}

          {dashboard && (
            <>
              {view !== "questions" && (
                <div
                  className="rounded-2xl px-5 py-4 mb-6 shadow-[0_4px_16px_rgba(28,26,22,0.05)]"
                  style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
                >
                  <div className="flex items-center justify-between mb-2">
                    <span className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                      Candidate quota
                    </span>
                    <span className="text-sm tabular-nums" style={{ color: "var(--ink-dim)" }}>
                      {quotaUsed} / {quotaTotal} used
                    </span>
                  </div>
                  <div className="h-2 rounded-full overflow-hidden" style={{ background: "var(--surface-2)" }}>
                    <div className="h-full rounded-full" style={{ width: `${quotaPct}%`, background: quotaTone }} />
                  </div>
                </div>
              )}

              {view === "overview" && (
                <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
                    <StatCard label="Roles in bank" value={dashboard.question_bank.length} />
                    <StatCard label="Questions" value={totalQuestions} />
                    <StatCard label="Pending" value={counts.pending ?? 0} />
                    <StatCard label="Live" value={counts.started ?? 0} tone="var(--accent)" />
                    <StatCard label="Finished" value={counts.completed ?? 0} tone="var(--success)" />
                </div>
              )}

              {view === "candidate" && (
                <div className="space-y-6">
                  <InviteForm dashboard={dashboard} onInvited={load} />
                  <InvitesTable invites={invites} liveCameraEnabled={dashboard.organization.live_camera_enabled} />
                </div>
              )}
              {view === "questions" && (
                <div className="space-y-6">
                  <QuestionBankCard dashboard={dashboard} />
                  <UploadCard onUploaded={load} />
                </div>
              )}
            </>
          )}
        </main>
      </div>
      </AppShell>
    </ProtectedRoute>
  );
}

export default function EnterprisePage() {
  return <EnterprisePageContent />;
}
