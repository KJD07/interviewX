"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import { ApiError, partnerReferrals, type PartnerDashboard } from "@/lib/api";
import { useAuth } from "@/context/AuthContext";
import { useCurrency, formatPrice, type DisplayCurrency } from "@/lib/currency";

function moneyFromPaise(paise: number, currency: DisplayCurrency) {
  return formatPrice(paise / 100, currency);
}

function statusLabel(status: string) {
  switch (status) {
    case "paid":
      return "Paid";
    case "pending":
      return "Pending (auto-pays in 7 days)";
    case "approved":
      return "Approved";
    case "void":
      return "Void";
    default:
      return status;
  }
}

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="font-label mb-2">{title}</div>
      <div className="font-display text-2xl font-semibold" style={{ color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

function PartnerRegisterForm({ onRegistered }: { onRegistered: () => void }) {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [preferredCode, setPreferredCode] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await partnerReferrals.register({
        name: name.trim(),
        contact_email: user?.email,
        preferred_code: preferredCode.trim(),
        payout_notes: payoutNotes.trim(),
      });
      await refreshUser().catch(() => undefined);
      onRegistered();
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unable to register as a partner.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="rounded-2xl border p-6 sm:p-8 max-w-xl"
      style={{ borderColor: "var(--border)", background: "var(--surface)" }}
    >
      <div className="font-label mb-2">Partner program</div>
      <h1 className="font-display text-3xl font-semibold" style={{ color: "var(--ink)" }}>
        Register your company
      </h1>
      <p className="mt-2 text-sm leading-relaxed" style={{ color: "var(--ink-dim)" }}>
        Get a unique referral code and link. When an organization signs up for enterprise with
        your code, they appear on your dashboard automatically and you earn 20% commission —
        paid out within 7 days.
      </p>

      <form onSubmit={handleSubmit} className="mt-6 space-y-4">
        <label className="block">
          <span className="font-label mb-2 block">Company / agency name</span>
          <input
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none"
            style={{ borderColor: "var(--border-mid)", background: "var(--page)", color: "var(--ink)" }}
            placeholder="e.g. Campus Connect"
          />
        </label>
        <label className="block">
          <span className="font-label mb-2 block">Preferred referral code (optional)</span>
          <input
            value={preferredCode}
            onChange={(e) => setPreferredCode(e.target.value)}
            className="w-full rounded-xl border px-4 py-3 text-sm outline-none font-mono uppercase"
            style={{ borderColor: "var(--border-mid)", background: "var(--page)", color: "var(--ink)" }}
            placeholder="e.g. CAMPUS20"
          />
        </label>
        <label className="block">
          <span className="font-label mb-2 block">Payout details (optional)</span>
          <textarea
            value={payoutNotes}
            onChange={(e) => setPayoutNotes(e.target.value)}
            className="w-full min-h-[90px] rounded-xl border px-4 py-3 text-sm outline-none resize-y"
            style={{ borderColor: "var(--border-mid)", background: "var(--page)", color: "var(--ink)" }}
            placeholder="UPI / bank account notes for commission payouts"
          />
        </label>
        {error && (
          <p className="text-sm" style={{ color: "var(--danger)" }}>{error}</p>
        )}
        <button
          type="submit"
          disabled={submitting}
          className="rounded-full px-6 py-3 text-sm font-semibold disabled:opacity-60"
          style={{ background: "var(--ink)", color: "var(--page)" }}
        >
          {submitting ? "Creating partner account…" : "Join partner program →"}
        </button>
      </form>
    </div>
  );
}

function PartnerDashboardContent() {
  const currency = useCurrency();
  const { refreshUser } = useAuth();
  const [data, setData] = useState<PartnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [needsRegistration, setNeedsRegistration] = useState(false);
  const [copied, setCopied] = useState<"link" | "code" | null>(null);

  const loadDashboard = () => {
    setLoading(true);
    setError(null);
    partnerReferrals
      .dashboard()
      .then((payload) => {
        setData(payload);
        setNeedsRegistration(false);
      })
      .catch((err: Error) => {
        if (err instanceof ApiError && err.status === 404) {
          setNeedsRegistration(true);
          setData(null);
          setError(null);
        } else {
          setError(err.message || "Unable to load partner dashboard.");
        }
      })
      .finally(() => setLoading(false));
  };

  useEffect(() => {
    loadDashboard();
  }, []);

  const shareUrl =
    typeof window !== "undefined" && data
      ? `${window.location.origin}/enterprise?ref=${encodeURIComponent(data.partner.code)}`
      : "";

  const copyText = async (value: string, kind: "link" | "code") => {
    try {
      await navigator.clipboard.writeText(value);
      setCopied(kind);
      window.setTimeout(() => setCopied(null), 1800);
    } catch {
      setCopied(null);
    }
  };

  return (
    <AppShell partner>
      <main className="p-4 sm:p-8 max-w-[1100px] fade-up">
        {loading && (
          <div className="rounded-2xl border p-8 text-sm" style={{ borderColor: "var(--border)", color: "var(--ink-dim)" }}>
            Loading partner data…
          </div>
        )}

        {!loading && needsRegistration && (
          <PartnerRegisterForm
            onRegistered={() => {
              void refreshUser().catch(() => undefined);
              loadDashboard();
            }}
          />
        )}

        {!loading && error && (
          <div className="rounded-2xl border p-8 text-sm" style={{ borderColor: "var(--border)", color: "var(--ink-dim)" }}>
            {error}
          </div>
        )}

        {!loading && data && (
          <>
            <div className="mb-8">
              <div className="font-label mb-2">B2B partner program</div>
              <h1 className="font-display text-3xl font-semibold" style={{ color: "var(--ink)" }}>
                Partner dashboard
              </h1>
              <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
                Earn {(Number(data.partner.commission_rate) * 100).toFixed(0)}% commission on
                enterprise revenue from organizations you refer. Commissions auto-pay within{" "}
                {data.partner.payout_days} days.
              </p>
            </div>

            <div className="grid grid-cols-2 lg:grid-cols-5 gap-3 mb-6">
              <MetricCard title="Referred orgs" value={String(data.summary.referred_organizations)} />
              <MetricCard title="Open leads" value={String(data.summary.open_leads ?? 0)} />
              <MetricCard title="Total earned" value={moneyFromPaise(data.summary.earned_paise, currency)} />
              <MetricCard title="Pending payout" value={moneyFromPaise(data.summary.pending_paise, currency)} />
              <MetricCard title="Paid out" value={moneyFromPaise(data.summary.paid_paise, currency)} />
            </div>

            <div
              className="rounded-2xl border p-5 mb-6"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="font-label mb-2">Your referral link & code</div>
              <p className="text-sm mb-3" style={{ color: "var(--ink-dim)" }}>
                Share this with colleges, agencies, or hiring teams. When they register for enterprise,
                they show up here automatically and your commission starts.
              </p>
              <div
                className="rounded-xl px-4 py-3 font-mono text-sm break-all mb-3"
                style={{ background: "var(--page)", color: "var(--ink)" }}
              >
                {shareUrl}
              </div>
              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => copyText(shareUrl, "link")}
                  className="rounded-full px-4 py-2 text-sm font-medium"
                  style={{ background: "var(--ink)", color: "var(--page)" }}
                >
                  {copied === "link" ? "Link copied" : "Copy link"}
                </button>
                <button
                  type="button"
                  onClick={() => copyText(data.partner.code, "code")}
                  className="rounded-full px-4 py-2 text-sm font-medium border"
                  style={{ borderColor: "var(--border-mid)", color: "var(--ink)" }}
                >
                  {copied === "code" ? "Code copied" : `Copy code · ${data.partner.code}`}
                </button>
                <span className="text-xs font-mono" style={{ color: "var(--ink-dim)" }}>
                  {data.partner.code}
                </span>
              </div>
            </div>

            <div className="grid lg:grid-cols-3 gap-6">
              <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <h2 className="font-display text-lg font-semibold mb-4" style={{ color: "var(--ink)" }}>
                  Open leads
                </h2>
                {(data.recent_leads ?? []).length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--ink-dim)" }}>No open leads — referred signups convert automatically.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.recent_leads.map((lead) => (
                      <li
                        key={lead.id}
                        className="rounded-xl px-4 py-3"
                        style={{ background: "var(--page)" }}
                      >
                        <div className="font-medium" style={{ color: "var(--ink)" }}>{lead.company_name}</div>
                        <div className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>
                          {lead.contact_email} · {lead.seats_needed} interviews · {lead.status}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <h2 className="font-display text-lg font-semibold mb-4" style={{ color: "var(--ink)" }}>
                  Referred organizations
                </h2>
                {data.referred_organizations.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--ink-dim)" }}>No attributed organizations yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.referred_organizations.map((org) => (
                      <li
                        key={org.organization_id}
                        className="rounded-xl px-4 py-3"
                        style={{ background: "var(--page)" }}
                      >
                        <div className="font-medium" style={{ color: "var(--ink)" }}>{org.organization_name}</div>
                        <div className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>
                          Attributed {new Date(org.attributed_at).toLocaleDateString()} ·
                          commission until {new Date(org.expires_at).toLocaleDateString()}
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>

              <section className="rounded-2xl border p-5" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
                <h2 className="font-display text-lg font-semibold mb-4" style={{ color: "var(--ink)" }}>
                  Recent commissions
                </h2>
                {data.recent_commissions.length === 0 ? (
                  <p className="text-sm" style={{ color: "var(--ink-dim)" }}>No commission entries yet.</p>
                ) : (
                  <ul className="space-y-3">
                    {data.recent_commissions.map((row) => (
                      <li
                        key={row.id}
                        className="rounded-xl px-4 py-3 flex items-center justify-between gap-3"
                        style={{ background: "var(--page)" }}
                      >
                        <div>
                          <div className="font-medium" style={{ color: "var(--ink)" }}>
                            {row.organization_name || "Enterprise payment"}
                          </div>
                          <div className="text-xs mt-1" style={{ color: "var(--ink-dim)" }}>
                            {new Date(row.created_at).toLocaleDateString()} · {statusLabel(row.status)}
                          </div>
                        </div>
                        <div className="text-right shrink-0">
                          <div className="font-mono text-sm" style={{ color: "var(--ink)" }}>
                            {moneyFromPaise(row.commission_amount_paise, currency)}
                          </div>
                          <div className="text-xs" style={{ color: "var(--ink-dim)" }}>
                            on {moneyFromPaise(row.gross_amount_paise, currency)}
                          </div>
                        </div>
                      </li>
                    ))}
                  </ul>
                )}
              </section>
            </div>
          </>
        )}
      </main>
    </AppShell>
  );
}

export default function PartnerPage() {
  return (
    <ProtectedRoute>
      <PartnerDashboardContent />
    </ProtectedRoute>
  );
}
