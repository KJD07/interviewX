"use client";
import { useEffect, useState } from "react";
import { interviews } from "@/lib/api";
import type { RealInterviewReport } from "@/lib/api";
import { Card, CardHeader } from "@/components/ui";

function StatusPill({ status }: { status: RealInterviewReport["status"] }) {
  const map = {
    pending: { label: "Pending review", cls: "tag" },
    approved: { label: "Approved · +5 credited", cls: "tag tag-success" },
    rejected: { label: "Not approved", cls: "tag tag-outline" },
  };
  const s = map[status];
  return <span className={`${s.cls} shrink-0`}>{s.label}</span>;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("en-IN", { day: "numeric", month: "short", year: "numeric" });
}

/**
 * The user's submitted real-interview reports and their review status.
 * Renders nothing until there is at least one report — the "Report a real
 * interview" entry point itself is a dashboard quick action, which owns the
 * submission modal and bumps `reloadKey` after a submit.
 */
export default function RealInterviewReportsCard({
  reloadKey = 0,
  onNew,
}: {
  reloadKey?: number;
  onNew: () => void;
}) {
  const [reports, setReports] = useState<RealInterviewReport[]>([]);

  useEffect(() => {
    interviews.realReports().then(setReports).catch(() => {});
  }, [reloadKey]);

  if (reports.length === 0) return null;

  return (
    <Card>
      <CardHeader
        title="Your interview reports"
        meta={`${reports.length} submitted`}
        action={
          <button onClick={onNew} className="btn btn-secondary btn-sm">
            + New report
          </button>
        }
      />
      <ul className="divide-y" style={{ borderColor: "var(--border)" }}>
        {reports.map((r) => (
          <li key={r.id} className="flex items-center justify-between gap-3 py-3 first:pt-0 last:pb-0" style={{ borderColor: "var(--border)" }}>
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
          </li>
        ))}
      </ul>
    </Card>
  );
}
