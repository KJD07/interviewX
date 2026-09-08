"use client";

import { useEffect, useState } from "react";
import AppShell from "@/components/AppShell";
import ProtectedRoute from "@/components/ProtectedRoute";
import { partnerReferrals, type PartnerDashboard } from "@/lib/api";
import { useCurrency, formatPrice, type DisplayCurrency } from "@/lib/currency";

function moneyFromPaise(paise: number, currency: DisplayCurrency) {
  return formatPrice(paise / 100, currency);
}

function statusLabel(status: string) {
  switch (status) {
    case "paid":
      return "Paid";
    case "pending":
      return "Pending";
    case "approved":
      return "Approved";
    case "void":
      return "Void";
    default:
      return status;
  }
}

function PartnerDashboardContent() {
  const currency = useCurrency();
  const [data, setData] = useState<PartnerDashboard | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    partnerReferrals
      .dashboard()
      .then(setData)
      .catch((err: Error) => setError(err.message || "Unable to load partner dashboard."))
      .finally(() => setLoading(false));
  }, []);

  const shareUrl =
    typeof window !== "undefined" && data
      ? `${window.location.origin}/enterprise?ref=${encodeURIComponent(data.partner.code)}`
      : "";

  return (
    <AppShell>
      <main className="p-4 sm:p-8 max-w-[1100px] fade-up">
        <div className="mb-8">
          <div className="font-label mb-2">B2B partner program</div>
          <h1 className="font-display text-3xl font-semibold" style={{ color: "var(--ink)" }}>
            Partner dashboard
          </h1>
          <p className="mt-2 text-sm" style={{ color: "var(--ink-dim)" }}>
            Earn {(data ? Number(data.partner.commission_rate) * 100 : 20).toFixed(0)}% commission on
            enterprise revenue from organizations you refer for 12 months.
          </p>
        </div>

        {loading && (
          <div className="rounded-2xl border p-8 text-sm" style={{ borderColor: "var(--border)", color: "var(--ink-dim)" }}>
            Loading partner data…
          </div>
        )}

        {!loading && error && (
          <div className="rounded-2xl border p-8 text-sm" style={{ borderColor: "var(--border)", color: "var(--ink-dim)" }}>
            {error.includes("404")
              ? "This account is not linked to a referral partner. Contact EvaluLabs to get partner access."
              : error}
          </div>
        )}

        {!loading && data && (
          <>
            <div className="grid grid-cols-2 lg:grid-cols-4 gap-3 mb-6">
              <MetricCard title="Referred orgs" value={String(data.summary.referred_organizations)} />
              <MetricCard title="Total earned" value={moneyFromPaise(data.summary.earned_paise, currency)} />
              <MetricCard title="Pending payout" value={moneyFromPaise(data.summary.pending_paise, currency)} />
              <MetricCard title="Paid out" value={moneyFromPaise(data.summary.paid_paise, currency)} />
            </div>

            <div
              className="rounded-2xl border p-5 mb-6"
              style={{ borderColor: "var(--border)", background: "var(--surface)" }}
            >
              <div className="font-label mb-2">Your referral link</div>
              <p className="text-sm mb-3" style={{ color: "var(--ink-dim)" }}>
                Share this with colleges, agencies, or hiring teams. When they become an enterprise customer,
                you earn commission on their payments for 12 months.
              </p>
              <div
                className="rounded-xl px-4 py-3 font-mono text-sm break-all"
                style={{ background: "var(--page)", color: "var(--ink)" }}
              >
                {shareUrl}
              </div>
              <p className="mt-3 text-xs" style={{ color: "var(--ink-dim)" }}>
                Code: <span className="font-mono">{data.partner.code}</span>
              </p>
            </div>

            <div className="grid lg:grid-cols-2 gap-6">
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

function MetricCard({ title, value }: { title: string; value: string }) {
  return (
    <div className="rounded-2xl border p-4" style={{ borderColor: "var(--border)", background: "var(--surface)" }}>
      <div className="font-label mb-2">{title}</div>
      <div className="font-display text-2xl font-semibold" style={{ color: "var(--ink)" }}>{value}</div>
    </div>
  );
}

export default function PartnerPage() {
  return (
    <ProtectedRoute>
      <PartnerDashboardContent />
    </ProtectedRoute>
  );
}
