"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import MarketingFooter from "@/components/MarketingFooter";
import MarketingNav from "@/components/MarketingNav";
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
    <div className="h-full px-[22px] py-5" style={{ background: "var(--surface)" }}>
      <p className="font-display text-[26px] font-bold leading-none tracking-[-0.035em] tabular-nums text-[var(--ink)]">
        {value}
      </p>
      <p className="mt-2 text-xs text-[var(--ink-dim)]">{title}</p>
    </div>
  );
}

function PartnerRegisterForm({ onRegistered }: { onRegistered: () => void }) {
  const { user, refreshUser } = useAuth();
  const [name, setName] = useState("");
  const [preferredCode, setPreferredCode] = useState("");
  const [payoutNotes, setPayoutNotes] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [alreadySubmitted, setAlreadySubmitted] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      await partnerReferrals.register({
        name: name.trim(),
        preferred_code: preferredCode.trim(),
        payout_notes: payoutNotes.trim(),
      });
      await refreshUser().catch(() => undefined);
      onRegistered();
    } catch (err) {
      if (err instanceof ApiError && err.status === 409) {
        setAlreadySubmitted(true);
        await refreshUser().catch(() => undefined);
        onRegistered();
        return;
      }
      setError(err instanceof Error ? err.message : "Unable to register as a partner.");
    } finally {
      setSubmitting(false);
    }
  };

  const inputClass =
    "w-full rounded-xl border border-[var(--border-mid)] bg-[var(--page)] px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]";

  return (
    <div
      className="relative overflow-hidden rounded-[28px] px-6 py-12 sm:px-[54px] sm:py-[62px]"
      style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
    >
      <div
        className="el-float pointer-events-none absolute -bottom-[100px] -right-[70px] h-[300px] w-[300px] rounded-full"
        style={{ background: "var(--lime)" }}
      />
      <div className="relative grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
        <div>
          <div className="mb-[18px] font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--lime)]">
            Partnership program
          </div>
          <h1 className="font-display text-[36px] font-bold leading-none tracking-[-0.035em] sm:text-[52px]">
            Become a partner.
          </h1>
          <p className="mt-[18px] max-w-[440px] text-base leading-relaxed text-[#A3A29A]">
            Agencies, colleges, and consultants get a referral code and earn 20%
            commission on attributed enterprise revenue. Payouts within 7 days.
          </p>
        </div>

        {alreadySubmitted ? (
          <div
            className="flex items-start gap-3 rounded-[20px] border px-6 py-8"
            style={{ borderColor: "rgba(255,255,255,0.12)", background: "#17171A" }}
          >
            <span className="mt-1.5 h-2 w-2 shrink-0 rounded-full bg-[var(--lime)]" />
            <p className="text-sm leading-relaxed text-[#D6D4CC]">
              You&apos;ve already applied to the partner program with this account.
              Your referral code appears here once the workspace is ready — no need
              to submit again.
            </p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <div
              className="rounded-xl border px-4 py-3 text-[13px] text-[#A3A29A]"
              style={{ borderColor: "rgba(255,255,255,0.12)", background: "#17171A" }}
            >
              Submitting as <strong className="text-[var(--hero-text)]">{user?.email}</strong>
            </div>
            <label className="block">
              <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A3A29A]">
                Organization / individual name
              </span>
              <input
                required
                value={name}
                onChange={(e) => setName(e.target.value)}
                className={inputClass}
                placeholder="e.g. Campus Connect"
              />
            </label>
            <label className="block">
              <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A3A29A]">
                Preferred referral code (optional)
              </span>
              <input
                value={preferredCode}
                onChange={(e) => setPreferredCode(e.target.value)}
                className={`${inputClass} font-mono uppercase`}
                placeholder="e.g. CAMPUS20"
              />
            </label>
            <label className="block">
              <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A3A29A]">
                Payout details (optional)
              </span>
              <textarea
                value={payoutNotes}
                onChange={(e) => setPayoutNotes(e.target.value)}
                className={`${inputClass} min-h-[90px] resize-y`}
                placeholder="UPI / bank account notes for commission payouts"
              />
            </label>
            {error && <p className="text-sm text-[#E58A72]">{error}</p>}
            <button
              type="submit"
              disabled={submitting}
              className="rounded-full px-[30px] py-4 text-[15px] font-bold text-[var(--ink)] hover:brightness-95 disabled:opacity-60"
              style={{ background: "var(--lime)" }}
            >
              {submitting ? "Submitting…" : "Apply for a referral code →"}
            </button>
            <p className="text-xs text-[#A3A29A]">
              One application per logged-in email. Your referral code and link appear
              here once the account is created.
            </p>
          </form>
        )}
      </div>
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

  if (loading || needsRegistration || error) {
    return (
      <div className="relative min-h-screen bg-[var(--page)]">
        <MarketingNav />
        <section className="mx-auto max-w-[1180px] px-6 pt-32 pb-16 sm:px-8 sm:pt-36">
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
        </section>
        <MarketingFooter />
      </div>
    );
  }

  return (
    <AppShell partner>
      <main className="p-4 sm:p-8 max-w-[1100px] fade-up">
        {data && (
          <>
            <div className="mb-8">
              <div className="font-label mb-2.5">B2B partner program</div>
              <h1 className="font-display text-[32px] font-bold leading-none tracking-[-0.035em] text-[var(--ink)] sm:text-[44px]">
                Partner dashboard
              </h1>
              <p className="mt-3 max-w-[560px] text-sm leading-relaxed text-[var(--ink-dim)]">
                Earn {(Number(data.partner.commission_rate) * 100).toFixed(0)}% commission on
                enterprise revenue from organizations you refer. Commissions auto-pay within{" "}
                {data.partner.payout_days} days.
              </p>
            </div>

            <div
              className="mb-6 grid grid-cols-2 gap-px overflow-hidden rounded-[16px] lg:grid-cols-5"
              style={{ background: "var(--border-mid)", border: "1px solid var(--border-mid)" }}
            >
              <MetricCard title="Referred orgs" value={String(data.summary.referred_organizations)} />
              <MetricCard title="Open leads" value={String(data.summary.open_leads ?? 0)} />
              <MetricCard title="Total earned" value={moneyFromPaise(data.summary.earned_paise, currency)} />
              <MetricCard title="Pending payout" value={moneyFromPaise(data.summary.pending_paise, currency)} />
              <MetricCard title="Paid out" value={moneyFromPaise(data.summary.paid_paise, currency)} />
            </div>

            <div
              className="mb-6 rounded-[16px] p-[22px]"
              style={{ borderColor: "var(--border-mid)", borderWidth: 1, borderStyle: "solid", background: "var(--surface)" }}
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
