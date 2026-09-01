"use client";
import { useEffect, useMemo, useState } from "react";
import { usePathname } from "next/navigation";
import ProtectedRoute from "@/components/ProtectedRoute";
import AppShell from "@/components/AppShell";
import PaginationControls from "@/components/PaginationControls";
import { useSearchAndPaginate } from "@/hooks/useSearchAndPaginate";
import { Skeleton } from "@/components/Skeleton";
import Link from "next/link";
import { organizations, ApiError } from "@/lib/api";
import type { OrgDashboard, OrgCandidateInvite, OrgRound, OrgRole } from "@/lib/api";
import { useCurrency, formatPrice } from "@/lib/currency";

const ENTERPRISE_PRICE_PER_SEAT_RUPEES = 99;

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

const STATUS_STYLE: Record<OrgCandidateInvite["candidate_status"], { label: string; bg: string; color: string }> = {
  pending: { label: "Pending", bg: "#EFEDE6", color: "var(--ink-dim)" },
  live: { label: "Live", bg: "rgba(180,115,30,0.14)", color: "#7A5A12" },
  finished: { label: "Finished", bg: "var(--success-bg)", color: "#2F6B48" },
  expired: { label: "Expired", bg: "rgba(179,64,42,0.12)", color: "var(--danger)" },
};

function StatusBadge({ status }: { status: OrgCandidateInvite["candidate_status"] }) {
  const s = STATUS_STYLE[status];
  return (
    <span className="inline-flex w-fit justify-self-start items-center justify-center whitespace-nowrap text-xs font-medium px-2.5 py-1.5 rounded-full" style={{ background: s.bg, color: s.color }}>
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
      className="rounded-[16px] overflow-hidden"
      style={{ border: "1px solid var(--border-mid)", background: "var(--surface)" }}
    >
      <div
        className="flex items-start justify-between gap-4 px-4 sm:px-[22px] py-[18px]"
        style={{ borderBottom: "1px solid var(--border)" }}
      >
        <div>
          <h2 className="font-display text-xl font-bold tracking-[-0.025em]" style={{ color: "var(--ink)" }}>{title}</h2>
          {subtitle && <p className="text-xs mt-0.5" style={{ color: "var(--ink-dim)" }}>{subtitle}</p>}
        </div>
        {action}
      </div>
      <div className="px-4 sm:px-[22px] py-[22px]">{children}</div>
    </div>
  );
}

// One cell of the hairline stat strip — the 1px gaps come from the strip's
// background showing through, so cells stay borderless.
function StatCard({ label, value, tone }: { label: string; value: string | number; tone?: string }) {
  return (
    <div className="h-full px-[22px] py-5" style={{ background: "var(--surface)" }}>
      <p
        className="font-display text-[26px] sm:text-[32px] font-bold leading-none tracking-[-0.035em] tabular-nums"
        style={{ color: tone ?? "var(--ink)" }}
      >
        {value}
      </p>
      <p className="text-xs mt-2" style={{ color: "var(--ink-dim)" }}>{label}</p>
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
    <div className="rounded-[16px] p-[22px]" style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}>
      <div className="font-mono text-[10px] uppercase tracking-[0.16em] mb-3.5" style={{ color: "var(--lime)" }}>
        Upload question bank
      </div>
      <p className="text-sm leading-[1.55] mb-2" style={{ color: "#A3A29A" }}>
        .csv, .xlsx or .json with these columns:
      </p>
      <div
        className="font-mono text-[11px] leading-[1.9] rounded-[11px] p-3.5 mb-[18px]"
        style={{ background: "#17171A", border: "1px solid rgba(255,255,255,0.1)", color: "#D6D4CC" }}
      >
        Role · Round · Round Type
        <br />
        Question Text · Question Type
        <br />
        Ideal Answer
      </div>
      <div className="flex flex-wrap items-center gap-2">
        <label
          className="text-sm font-semibold px-[18px] py-[11px] rounded-full border cursor-pointer transition-colors hover:bg-white/[0.08]"
          style={{ borderColor: "rgba(255,255,255,0.22)" }}
        >
          {file ? "Change file…" : "Choose file…"}
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
          className="px-5 py-3 rounded-full text-sm font-bold transition-opacity disabled:cursor-not-allowed"
          style={
            file && !busy
              ? { background: "var(--lime)", color: "var(--ink)" }
              : { background: "rgba(255,255,255,0.12)", color: "#7E7D74" }
          }
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      <div
        className="font-mono text-[11px] mt-3 truncate"
        style={{ color: "#7E7D74" }}
      >
        {file ? file.name : "No file chosen"}
      </div>
      {error && <p className="text-sm mt-3" style={{ color: "#E58A72" }}>{error}</p>}
      {summary && <p className="text-sm mt-3" style={{ color: "var(--lime)" }}>{summary}</p>}
    </div>
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
      <div className="flex items-center gap-2 w-full sm:w-auto">
        <input
          type="number"
          min={1}
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(Number(e.target.value) || 1)}
          className="text-sm px-3 py-2 rounded-lg border w-full sm:w-24"
          style={{ borderColor: "var(--border-mid)", color: "var(--ink)", background: "var(--surface)" }}
          title="Expires in (days)"
        />
        <span className="text-sm whitespace-nowrap" style={{ color: "var(--ink-dim)" }}>day(s)</span>
      </div>
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
            className="w-full rounded-full px-4 py-2.5 text-sm mb-4 outline-none"
            style={{ background: "var(--surface-alt)", border: "1px solid var(--border-mid)", color: "var(--ink)" }}
          />

          {search.results.length === 0 ? (
            <p className="text-sm" style={{ color: "var(--ink-dim)" }}>No candidates match "{search.query}".</p>
          ) : (
            <div className="hidden md:block rounded-[14px] overflow-hidden" style={{ border: "1px solid var(--border-mid)" }}>
              <div
                className="grid font-mono text-[10px] uppercase tracking-[0.14em] px-[22px] py-3"
                style={{
                  gridTemplateColumns: columns,
                  background: "var(--surface-alt)",
                  color: "var(--ink-faint)",
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
                    className="dash-row"
                    style={{
                      borderBottom: i < search.results.length - 1 ? "1px solid var(--border)" : "none",
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
                      className="w-full grid items-center px-[22px] py-3.5 text-left cursor-pointer"
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

/* Loading state mirrors the dashboard's: a shimmer of the real layout for the
   view being loaded, rather than a bare "Loading…" line, so the page doesn't
   jump when the data lands. */
function EnterpriseSkeleton({ view }: { view: "overview" | "candidate" | "questions" }) {
  return (
    <div className="fade-up">
      {view === "overview" && (
        <div className="flex flex-wrap items-start justify-between gap-4 mb-8">
          <div>
            <Skeleton className="h-3 w-40 rounded mb-2.5" />
            <Skeleton className="h-7 w-56 rounded-lg" />
          </div>
          <div className="flex items-center gap-2">
            <Skeleton className="h-6 w-20 rounded-full" />
            <Skeleton className="h-6 w-16 rounded-full" />
          </div>
        </div>
      )}

      {view !== "questions" && (
        <div
          className="rounded-2xl px-5 py-4 mb-6"
          style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
        >
          <div className="flex items-center justify-between mb-2.5">
            <Skeleton className="h-4 w-32 rounded" />
            <Skeleton className="h-4 w-24 rounded" />
          </div>
          <Skeleton className="h-2 w-full rounded-full" />
        </div>
      )}

      {view === "overview" && (
        <div className="grid grid-cols-2 sm:grid-cols-5 gap-4 mb-8">
          {[1, 2, 3, 4, 5].map((n) => (
            <div
              key={n}
              className="rounded-2xl px-4 py-4"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <Skeleton className="h-7 w-12 rounded-lg mb-2" />
              <Skeleton className="h-3 w-20 rounded" />
            </div>
          ))}
        </div>
      )}

      {view !== "overview" && (
        <div className="space-y-6">
          {[1, 2].map((n) => (
            <div
              key={n}
              className="rounded-3xl overflow-hidden"
              style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
            >
              <div className="px-6 py-5" style={{ borderBottom: "1px solid var(--border)" }}>
                <Skeleton className="h-4 w-36 rounded mb-2" />
                <Skeleton className="h-3 w-52 rounded" />
              </div>
              <div className="px-6 py-5 space-y-3">
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-full rounded-xl" />
                <Skeleton className="h-10 w-3/4 rounded-xl" />
              </div>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

function EnterprisePageContent({ view = "overview" }: { view?: "overview" | "candidate" | "questions" }) {
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
        <main className={`max-w-[1120px] mx-auto px-4 sm:px-10 ${view === "overview" ? "pt-8 sm:pt-[34px]" : "pt-8"} pb-16 fade-up`}>

          {loading && <EnterpriseSkeleton view={view} />}

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
              {view === "overview" && (
                <div className="flex flex-wrap items-end justify-between gap-4 mb-7">
                  <div>
                    <div className="font-label mb-2.5">Enterprise dashboard</div>
                    <h1
                      className="font-display text-[32px] sm:text-[44px] font-bold leading-none tracking-[-0.035em]"
                      style={{ color: "var(--ink)" }}
                    >
                      {dashboard.organization.name}
                    </h1>
                  </div>
                  <div className="flex flex-wrap items-center gap-2">
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-full"
                      style={{ border: "1px solid var(--border-mid)", color: "var(--ink)" }}
                    >
                      {dashboard.role}
                    </span>
                    <span
                      className="font-mono text-[10px] uppercase tracking-[0.1em] px-3 py-1.5 rounded-full"
                      style={{
                        background: dashboard.organization.is_active ? "var(--success-bg)" : "rgba(179,64,42,0.12)",
                        color: dashboard.organization.is_active ? "#2F6B48" : "var(--danger)",
                      }}
                    >
                      {dashboard.organization.is_active ? "Active" : "Inactive"}
                    </span>
                  </div>
                </div>
              )}

              {view !== "questions" && (
                <div
                  className="rounded-[16px] px-[22px] py-[22px] mb-3.5"
                  style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
                >
                  <div className="flex items-baseline justify-between mb-3.5">
                    <span className="text-[15px] font-semibold" style={{ color: "var(--ink)" }}>
                      Candidate quota
                    </span>
                    <span className="font-mono text-[13px] tabular-nums" style={{ color: "var(--ink-dim)" }}>
                      {quotaUsed} / {quotaTotal} used
                    </span>
                  </div>
                  <div className="h-[9px] rounded-[5px] overflow-hidden" style={{ background: "var(--surface-2)" }}>
                    <div className="h-full rounded-[5px]" style={{ width: `${quotaPct}%`, background: quotaTone }} />
                  </div>
                </div>
              )}

              {view === "overview" && (
                <div
                  className="grid grid-cols-2 sm:grid-cols-5 gap-px overflow-hidden rounded-[16px] mb-3.5"
                  style={{ background: "var(--border-mid)", border: "1px solid var(--border-mid)" }}
                >
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
                <div className="grid grid-cols-1 gap-3.5 lg:grid-cols-[1.5fr_1fr] lg:items-start">
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
  const pathname = usePathname();
  const view = pathname.endsWith("/candidate")
    ? "candidate"
    : pathname.endsWith("/questions")
      ? "questions"
      : "overview";
  return <EnterprisePageContent view={view} />;
}
