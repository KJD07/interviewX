"use client";
import { useState } from "react";
import { interviews, ApiError } from "@/lib/api";
import type { RealInterviewRound } from "@/lib/api";

interface Props {
  sessionId: number;
  onClose: () => void;
  onSubmitted: () => void;
}

const inputStyle = {
  background: "var(--page)",
  border: "1px solid var(--border-mid)",
  color: "var(--ink)",
};

function Field({
  label,
  children,
  error,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--ink-dim)" }}>
        {label}
      </label>
      {children}
      {error && (
        <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

export default function RealInterviewReportModal({ sessionId, onClose, onSubmitted }: Props) {
  const [hadRecentInterview, setHadRecentInterview] = useState<"" | "yes" | "no">("");
  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [rounds, setRounds] = useState<RealInterviewRound[]>([{ round_name: "", topics: "" }]);
  const [canProvideProof, setCanProvideProof] = useState<"" | "yes" | "no">("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const locked = hadRecentInterview !== "yes";

  const updateRound = (index: number, field: keyof RealInterviewRound, value: string) => {
    setRounds((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };

  const addRound = () => setRounds((prev) => [...prev, { round_name: "", topics: "" }]);

  const removeRound = (index: number) =>
    setRounds((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const validate = (): boolean => {
    const errs: Record<string, string> = {};

    if (!hadRecentInterview) {
      errs.hadRecentInterview = "Please select an option.";
    }

    if (hadRecentInterview === "yes") {
      if (!name.trim()) errs.name = "Your name is required.";
      if (!email.trim()) {
        errs.email = "Email is required.";
      } else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) {
        errs.email = "Enter a valid email address.";
      }
      if (!companyName.trim()) errs.companyName = "Company is required.";
      if (!roleTitle.trim()) errs.roleTitle = "Role is required.";
      if (!rounds[0]?.round_name.trim()) errs.rounds = "The first round's name is required.";
      if (!canProvideProof) errs.canProvideProof = "Please answer this question.";
    }

    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const handleSubmit = async () => {
    if (!validate()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      if (hadRecentInterview === "no") {
        await interviews.submitRealReport(sessionId, { had_recent_interview: "no" });
      } else {
        await interviews.submitRealReport(sessionId, {
          had_recent_interview: "yes",
          name: name.trim(),
          email: email.trim(),
          company_name: companyName.trim(),
          role_title: roleTitle.trim(),
          rounds: rounds
            .filter((r) => r.round_name.trim())
            .map((r) => ({ round_name: r.round_name.trim(), topics: r.topics.trim() })),
          can_provide_proof: canProvideProof === "yes",
        });
      }
      onSubmitted();
    } catch (err) {
      if (err instanceof ApiError) setSubmitError(err.detail);
      else setSubmitError("Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      style={{ background: "rgba(15,23,42,0.75)" }}
    >
      <div
        className="w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-xl px-6 py-6 fade-up"
        style={{ background: "var(--surface)", border: "1px solid var(--border-mid)" }}
      >
        <div className="flex items-start justify-between mb-1">
          <h2 className="text-lg font-bold" style={{ color: "var(--ink)" }}>
            Help us with real interview data
          </h2>
          <button
            onClick={onClose}
            className="text-sm shrink-0 ml-3"
            style={{ color: "var(--ink-dim)" }}
            aria-label="Skip"
          >
            Skip ✕
          </button>
        </div>
        <p className="text-sm mb-6" style={{ color: "var(--ink-dim)" }}>
          If you&apos;ve recently interviewed elsewhere, sharing what was asked helps us make
          InterviewX questions more realistic. Totally optional.
        </p>

        <div className="space-y-5">
          {/* Q1 */}
          <Field label="Have you given any interview recently or been selected for a role at any company?" error={errors.hadRecentInterview}>
            <select
              value={hadRecentInterview}
              onChange={(e) => setHadRecentInterview(e.target.value as "yes" | "no")}
              className="w-full rounded-lg px-3 py-2.5 text-sm"
              style={inputStyle}
            >
              <option value="">Select…</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>

          {/* Q2 */}
          <Field label="Your name" error={errors.name}>
            <input
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={locked}
              placeholder="Full name"
              className="w-full rounded-lg px-3 py-2.5 text-sm disabled:opacity-40"
              style={inputStyle}
            />
          </Field>

          {/* Q3 */}
          <Field label="Email ID" error={errors.email}>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={locked}
              placeholder="you@example.com"
              className="w-full rounded-lg px-3 py-2.5 text-sm disabled:opacity-40"
              style={inputStyle}
            />
          </Field>

          {/* Q4 */}
          <Field label="Which company?" error={errors.companyName}>
            <input
              type="text"
              value={companyName}
              onChange={(e) => setCompanyName(e.target.value)}
              disabled={locked}
              placeholder="e.g. Google"
              className="w-full rounded-lg px-3 py-2.5 text-sm disabled:opacity-40"
              style={inputStyle}
            />
          </Field>

          {/* Q5 */}
          <Field label="Which role?" error={errors.roleTitle}>
            <input
              type="text"
              value={roleTitle}
              onChange={(e) => setRoleTitle(e.target.value)}
              disabled={locked}
              placeholder="e.g. SDE-1"
              className="w-full rounded-lg px-3 py-2.5 text-sm disabled:opacity-40"
              style={inputStyle}
            />
          </Field>

          {/* Q6 — Rounds */}
          <Field label="Rounds (round name & topics asked)" error={errors.rounds}>
            <div className="space-y-3">
              {rounds.map((r, i) => (
                <div
                  key={i}
                  className="rounded-lg p-3 space-y-2"
                  style={{ background: "var(--page)", border: "1px solid var(--border-mid)" }}
                >
                  <div className="flex items-center justify-between">
                    <span className="text-xs font-medium" style={{ color: "var(--ink-dim)" }}>
                      Round {i + 1} {i === 0 && <span style={{ color: "var(--danger)" }}>*</span>}
                      {i > 0 && <span className="ml-1" style={{ color: "var(--ink-faint)" }}>(optional)</span>}
                    </span>
                    {rounds.length > 1 && (
                      <button
                        type="button"
                        onClick={() => removeRound(i)}
                        disabled={locked}
                        className="text-xs disabled:opacity-40"
                        style={{ color: "var(--danger)" }}
                      >
                        Remove
                      </button>
                    )}
                  </div>
                  <input
                    type="text"
                    value={r.round_name}
                    onChange={(e) => updateRound(i, "round_name", e.target.value)}
                    disabled={locked}
                    placeholder="Round name, e.g. Technical Round 1"
                    className="w-full rounded-md px-3 py-2 text-sm disabled:opacity-40"
                    style={inputStyle}
                  />
                  <textarea
                    value={r.topics}
                    onChange={(e) => updateRound(i, "topics", e.target.value)}
                    disabled={locked}
                    placeholder="Topics asked, e.g. Arrays, System Design, SQL joins…"
                    rows={2}
                    className="w-full rounded-md px-3 py-2 text-sm disabled:opacity-40 resize-none"
                    style={inputStyle}
                  />
                </div>
              ))}
              <button
                type="button"
                onClick={addRound}
                disabled={locked}
                className="text-sm font-medium disabled:opacity-40"
                style={{ color: "var(--accent)" }}
              >
                + Add another round
              </button>
            </div>
          </Field>

          {/* Q7 */}
          <Field label="Can you provide proof of the interview you were recently interviewed for?" error={errors.canProvideProof}>
            <select
              value={canProvideProof}
              onChange={(e) => setCanProvideProof(e.target.value as "yes" | "no")}
              disabled={locked}
              className="w-full rounded-lg px-3 py-2.5 text-sm disabled:opacity-40"
              style={inputStyle}
            >
              <option value="">Select…</option>
              <option value="yes">Yes</option>
              <option value="no">No</option>
            </select>
          </Field>
        </div>

        {submitError && (
          <p className="text-sm mt-4" style={{ color: "var(--danger)" }}>
            {submitError}
          </p>
        )}

        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSubmit}
            disabled={submitting}
            className="flex-1 py-3 rounded-lg text-sm font-semibold disabled:opacity-60"
            style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
          >
            {submitting ? "Submitting…" : "Submit"}
          </button>
          <button
            onClick={onClose}
            disabled={submitting}
            className="px-5 py-3 rounded-lg text-sm font-semibold"
            style={{ background: "var(--page)", color: "var(--ink-dim)", border: "1px solid var(--border-mid)" }}
          >
            Skip
          </button>
        </div>
      </div>
    </div>
  );
}