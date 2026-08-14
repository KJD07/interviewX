"use client";
import { useEffect, useState } from "react";
import ProtectedRoute from "@/components/ProtectedRoute";
import { organizations, ApiError } from "@/lib/api";
import type { OrgDashboard, OrgCandidateInvite, OrgRound } from "@/lib/api";

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
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
    <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h2 className="font-semibold mb-1" style={{ color: "var(--ink)" }}>Upload your question bank</h2>
      <p className="text-sm mb-3" style={{ color: "var(--ink-dim)" }}>
        .csv, .xlsx, or .json with columns: Role, Round, Round Type, Question Text, Question Type, Ideal Answer.
      </p>
      <div className="flex items-center gap-3">
        <input
          type="file"
          accept=".csv,.xlsx,.json"
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          className="text-sm"
        />
        <button
          onClick={handleUpload}
          disabled={!file || busy}
          className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {busy ? "Uploading…" : "Upload"}
        </button>
      </div>
      {error && <p className="text-sm mt-2" style={{ color: "var(--danger)" }}>{error}</p>}
      {summary && <p className="text-sm mt-2" style={{ color: "var(--success)" }}>{summary}</p>}
    </div>
  );
}

function QuestionBankCard({ dashboard }: { dashboard: OrgDashboard }) {
  const allRounds: (OrgRound & { roleTitle: string })[] = dashboard.question_bank.flatMap((role) =>
    role.rounds.map((round) => ({ ...round, roleTitle: role.title }))
  );

  return (
    <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h2 className="font-semibold mb-3" style={{ color: "var(--ink)" }}>Question bank</h2>
      {allRounds.length === 0 ? (
        <p className="text-sm" style={{ color: "var(--ink-faint)" }}>
          No rounds yet — upload a question bank to get started.
        </p>
      ) : (
        <ul className="space-y-2">
          {allRounds.map((round) => (
            <li key={round.id} className="text-sm flex items-center justify-between">
              <span style={{ color: "var(--ink)" }}>
                {round.roleTitle} — {round.title}
              </span>
              <span style={{ color: "var(--ink-faint)" }}>{round.questions.length} question(s)</span>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

function InviteCard({
  dashboard,
  invites,
  onInvited,
}: {
  dashboard: OrgDashboard;
  invites: OrgCandidateInvite[];
  onInvited: () => void;
}) {
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
    <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <h2 className="font-semibold mb-3" style={{ color: "var(--ink)" }}>Invite a candidate</h2>
      <div className="flex flex-wrap items-center gap-2 mb-3">
        <select
          value={roundId}
          onChange={(e) => setRoundId(e.target.value ? Number(e.target.value) : "")}
          className="text-sm px-3 py-2 rounded-lg border"
          style={{ borderColor: "var(--border)" }}
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
          className="text-sm px-3 py-2 rounded-lg border flex-1 min-w-[200px]"
          style={{ borderColor: "var(--border)" }}
        />
        <input
          type="number"
          min={1}
          value={expiresInDays}
          onChange={(e) => setExpiresInDays(Number(e.target.value) || 1)}
          className="text-sm px-3 py-2 rounded-lg border w-20"
          style={{ borderColor: "var(--border)" }}
          title="Expires in (days)"
        />
        <button
          onClick={handleInvite}
          disabled={!roundId || !email || busy}
          className="px-4 py-2 rounded-lg text-sm font-medium disabled:opacity-50"
          style={{ background: "var(--accent)", color: "white" }}
        >
          {busy ? "Sending…" : "Invite"}
        </button>
      </div>
      {error && <p className="text-sm mb-2" style={{ color: "var(--danger)" }}>{error}</p>}

      {invites.length > 0 && (
        <table className="w-full text-sm">
          <thead>
            <tr style={{ color: "var(--ink-faint)" }}>
              <th className="text-left font-normal pb-1">Candidate</th>
              <th className="text-left font-normal pb-1">Round</th>
              <th className="text-left font-normal pb-1">Status</th>
              <th className="text-left font-normal pb-1">Expires</th>
            </tr>
          </thead>
          <tbody>
            {invites.map((inv) => (
              <tr key={inv.id} style={{ borderTop: "1px solid var(--border)" }}>
                <td className="py-1" style={{ color: "var(--ink)" }}>{inv.candidate_email}</td>
                <td className="py-1" style={{ color: "var(--ink)" }}>{inv.role_title} — {inv.round_title}</td>
                <td className="py-1" style={{ color: "var(--ink-dim)" }}>{inv.status}</td>
                <td className="py-1" style={{ color: "var(--ink-faint)" }}>{formatDate(inv.expires_at)}</td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  );
}

export default function EnterprisePage() {
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

  return (
    <ProtectedRoute>
      <div className="min-h-screen px-6 py-10 max-w-4xl mx-auto" style={{ background: "var(--page)" }}>
        <h1 className="text-2xl font-semibold mb-6" style={{ color: "var(--ink)" }}>Enterprise dashboard</h1>

        {loading && <p style={{ color: "var(--ink-dim)" }}>Loading…</p>}

        {notMember && !loading && (
          <p style={{ color: "var(--ink-dim)" }}>
            You're not a member of any organization yet. Contact EvaluLabs to set up your company's account.
          </p>
        )}

        {error && !loading && <p style={{ color: "var(--danger)" }}>{error}</p>}

        {dashboard && (
          <div className="space-y-6">
            <div className="rounded-xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
              <h2 className="font-semibold mb-1" style={{ color: "var(--ink)" }}>{dashboard.organization.name}</h2>
              <p className="text-sm" style={{ color: "var(--ink-dim)" }}>
                {dashboard.organization.candidates_used} / {dashboard.organization.candidate_quota} interviews used ·
                {" "}contract ends {formatDate(dashboard.organization.contract_ends)}
              </p>
            </div>

            <UploadCard onUploaded={load} />
            <QuestionBankCard dashboard={dashboard} />
            <InviteCard dashboard={dashboard} invites={invites} onInvited={load} />
          </div>
        )}
      </div>
    </ProtectedRoute>
  );
}
