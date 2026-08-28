"use client";
import { useEffect, useState } from "react";
import { interviews, ApiError } from "@/lib/api";
import type { RealInterviewReport } from "@/lib/api";
import RealInterviewReportModal from "@/components/RealInterviewReportModal";

function StatusPill({ status }: { status: RealInterviewReport["status"] }) {
  const map = {
    pending: { label: "Pending review", bg: "var(--surface-2)", color: "var(--ink-dim)" },
    approved: { label: "Approved · +5 credited", bg: "var(--success-bg)", color: "var(--success)" },
    rejected: { label: "Not approved", bg: "var(--surface-2)", color: "var(--ink-faint)" },
  };
  const s = map[status];
  return (
    <span className="text-xs font-medium px-2.5 py-1 rounded-full shrink-0" style={{ background: s.bg, color: s.color }}>
      {s.label}
    </span>
  );
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

export default function RealInterviewReportsCard() {
  const [reports, setReports] = useState<RealInterviewReport[]>([]);
  const [loading, setLoading] = useState(true);
  const [showModal, setShowModal] = useState(false);

  const load = () => {
    setLoading(true);
    interviews
      .realReports()
      .then(setReports)
      .catch(() => {})
      .finally(() => setLoading(false));
  };

  useEffect(load, []);

  return (
    <div
      className="card-hover rounded-3xl p-5 mb-8 shadow-[0_8px_32px_rgba(28,26,22,0.06)]"
      style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
    >
      <div className="flex items-start justify-between gap-4 mb-1">
        <div>
          <h2 className="font-display text-base font-semibold" style={{ color: "var(--ink)" }}>
            Report a real interview
          </h2>
          <p className="text-sm mt-1" style={{ color: "var(--ink-dim)" }}>
            Interviewed elsewhere recently? Share what was asked — approved reports earn you{" "}
            <span className="font-semibold" style={{ color: "var(--accent)" }}>5 free interviews</span>.
          </p>
        </div>
        <button
          onClick={() => setShowModal(true)}
          className="shrink-0 px-4 py-2 rounded-full text-sm font-semibold transition-transform duration-200 hover:scale-[1.03] active:scale-[0.98]"
          style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
        >
          + New report
        </button>
      </div>

      {!loading && reports.length > 0 && (
        <div className="mt-4 space-y-2">
          {reports.map((r) => (
            <div
              key={r.id}
              className="flex items-center justify-between gap-3 rounded-2xl px-4 py-3"
              style={{ background: "var(--surface-2)" }}
            >
              <div className="min-w-0">
                <p className="text-sm font-medium truncate" style={{ color: "var(--ink)" }}>
                  {r.had_recent_interview === "yes"
                    ? `${r.company_name || "—"} · ${r.role_title || "—"}`
                    : "No recent interview reported"}
                </p>
                <p className="text-xs mt-0.5" style={{ color: "var(--ink-faint)" }}>
                  Submitted {formatDate(r.created_at)}
                </p>
              </div>
              <StatusPill status={r.status} />
            </div>
          ))}
        </div>
      )}

      {showModal && (
        <RealInterviewReportModal
          onClose={() => setShowModal(false)}
          onSubmitted={() => {
            setShowModal(false);
            load();
          }}
        />
      )}
    </div>
  );
}
