"use client";
import { useState } from "react";
import { createPortal } from "react-dom";
import { interviews, ApiError } from "@/lib/api";
import type { RealInterviewReport } from "@/lib/api";

interface Props {
  sessionId?: number;
  onClose: () => void;
  onSubmitted: (report: RealInterviewReport) => void;
}

const inputStyle =
  "w-full rounded-xl px-3.5 py-2.5 text-sm bg-[var(--page)] border border-[var(--border-mid)] text-[var(--ink)] " +
  "transition-colors focus:outline-none focus:border-[var(--accent)] disabled:opacity-40";

function Field({
  label,
  children,
  error,
  hint,
}: {
  label: string;
  children: React.ReactNode;
  error?: string;
  hint?: string;
}) {
  return (
    <div>
      <label className="block text-xs font-medium uppercase tracking-wider mb-1.5" style={{ color: "var(--ink-dim)" }}>
        {label}
      </label>
      {children}
      {hint && !error && (
        <p className="text-xs mt-1" style={{ color: "var(--ink-faint)" }}>
          {hint}
        </p>
      )}
      {error && (
        <p className="text-xs mt-1" style={{ color: "var(--danger)" }}>
          {error}
        </p>
      )}
    </div>
  );
}

function ChoiceCard({
  selected,
  onClick,
  title,
  subtitle,
}: {
  selected: boolean;
  onClick: () => void;
  title: string;
  subtitle: string;
}) {
  return (
    <button
      type="button"
      onClick={onClick}
      className="w-full text-left rounded-2xl px-4 py-3.5 transition-all duration-200"
      style={{
        background: selected ? "var(--accent-glow)" : "var(--page)",
        border: `1.5px solid ${selected ? "var(--accent)" : "var(--border-mid)"}`,
      }}
    >
      <div className="flex items-center justify-between">
        <div>
          <p className="text-sm font-semibold" style={{ color: "var(--ink)" }}>
            {title}
          </p>
          <p className="text-xs mt-0.5" style={{ color: "var(--ink-dim)" }}>
            {subtitle}
          </p>
        </div>
        <div
          className="w-5 h-5 rounded-full flex items-center justify-center shrink-0 ml-3 transition-colors"
          style={{
            border: `1.5px solid ${selected ? "var(--accent)" : "var(--border-mid)"}`,
            background: selected ? "var(--accent)" : "transparent",
          }}
        >
          {selected && <span className="w-1.5 h-1.5 rounded-full bg-white" />}
        </div>
      </div>
    </button>
  );
}

// Steps for the "yes, I interviewed recently" path. The "no" path only
// ever uses step 0 followed by a one-tap confirm-and-submit screen.
const YES_STEPS = ["Recently interviewed?", "Your details", "Rounds asked", "Proof & submit"];

interface RoundDraft {
  round_name: string;
  topics: string;
  // Raw textarea value, one question per line — split into an array on submit.
  questionsText: string;
}

export default function RealInterviewReportModal({ sessionId, onClose, onSubmitted }: Props) {
  const [hadRecentInterview, setHadRecentInterview] = useState<"" | "yes" | "no">("");
  const [step, setStep] = useState(0);

  const [name, setName] = useState("");
  const [email, setEmail] = useState("");
  const [companyName, setCompanyName] = useState("");
  const [roleTitle, setRoleTitle] = useState("");
  const [rounds, setRounds] = useState<RoundDraft[]>([
    { round_name: "", topics: "", questionsText: "" },
  ]);
  const [canProvideProof, setCanProvideProof] = useState<"" | "yes" | "no">("");

  const [errors, setErrors] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState(false);
  const [submitError, setSubmitError] = useState("");

  const updateRound = (index: number, field: keyof RoundDraft, value: string) => {
    setRounds((prev) => prev.map((r, i) => (i === index ? { ...r, [field]: value } : r)));
  };
  const addRound = () =>
    setRounds((prev) => [...prev, { round_name: "", topics: "", questionsText: "" }]);
  const removeRound = (index: number) =>
    setRounds((prev) => (prev.length > 1 ? prev.filter((_, i) => i !== index) : prev));

  const validateStep1 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!name.trim()) errs.name = "Your name is required.";
    if (!email.trim()) errs.email = "Email is required.";
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email.trim())) errs.email = "Enter a valid email address.";
    if (!companyName.trim()) errs.companyName = "Company is required.";
    if (!roleTitle.trim()) errs.roleTitle = "Role is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep2 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!rounds[0]?.round_name.trim()) errs.rounds = "The first round's name is required.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const validateStep3 = (): boolean => {
    const errs: Record<string, string> = {};
    if (!canProvideProof) errs.canProvideProof = "Please answer this question.";
    setErrors(errs);
    return Object.keys(errs).length === 0;
  };

  const goNext = () => {
    setErrors({});
    if (hadRecentInterview === "no") return; // handled by the confirm screen itself
    if (step === 1 && !validateStep1()) return;
    if (step === 2 && !validateStep2()) return;
    setStep((s) => s + 1);
  };

  const goBack = () => {
    setErrors({});
    setStep((s) => Math.max(0, s - 1));
  };

  const submit = async (payloadHadRecent: "yes" | "no") => {
    if (payloadHadRecent === "yes" && !validateStep3()) return;
    setSubmitting(true);
    setSubmitError("");
    try {
      const report = await interviews.submitRealReport(
        payloadHadRecent === "no"
          ? { had_recent_interview: "no", session: sessionId }
          : {
              had_recent_interview: "yes",
              name: name.trim(),
              email: email.trim(),
              company_name: companyName.trim(),
              role_title: roleTitle.trim(),
              rounds: rounds
                .filter((r) => r.round_name.trim())
                .map((r) => ({
                  round_name: r.round_name.trim(),
                  topics: r.topics.trim(),
                  questions: r.questionsText
                    .split("\n")
                    .map((q) => q.trim())
                    .filter(Boolean),
                })),
              can_provide_proof: canProvideProof === "yes",
              session: sessionId,
            }
      );
      onSubmitted(report);
    } catch (err) {
      if (err instanceof ApiError) setSubmitError(err.detail);
      else setSubmitError("Could not submit. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  const totalSteps = hadRecentInterview === "yes" ? YES_STEPS.length : 2;

  return createPortal(
    <div
      className="fixed inset-0 z-50 flex items-center justify-center px-4 py-8"
      style={{ background: "rgba(6, 10, 20, 0.7)" }}
    >
      <div
        className="relative w-full max-w-lg max-h-[90vh] overflow-y-auto rounded-3xl fade-up shadow-[0_20px_60px_rgba(15,23,42,0.35)]"
        style={{ background: "var(--surface)", border: "1px solid var(--border)" }}
      >
        {/* Decorative glow, matching the homepage hero */}
        <div
          className="pointer-events-none absolute -top-24 -right-16 h-56 w-56 rounded-full blur-[90px]"
          style={{ background: "var(--accent-glow)" }}
        />

        <div className="relative px-6 pt-6 pb-2">
          <div className="flex items-start justify-between mb-1">
            <h2 className="font-display text-xl font-semibold" style={{ color: "var(--ink)" }}>
              Help us with real interview data
            </h2>
            <button
              onClick={onClose}
              className="text-xs font-medium shrink-0 ml-3 px-2.5 py-1 rounded-full transition-colors hover:opacity-80"
              style={{ background: "var(--surface-2)", color: "var(--ink-dim)" }}
              aria-label="Skip"
            >
              Skip ✕
            </button>
          </div>
          <p className="text-sm mb-5" style={{ color: "var(--ink-dim)" }}>
            If you&apos;ve recently interviewed elsewhere, sharing what was asked helps us make
            EvaluLabs questions more realistic. Approved reports earn you{" "}
            <span className="font-semibold" style={{ color: "var(--accent)" }}>
              5 free interviews
            </span>
            , and if you also list the exact questions you were asked, verifying those earns{" "}
            <span className="font-semibold" style={{ color: "var(--accent)" }}>
              5 more
            </span>{" "}
            (paid-plan members only). Totally optional.
          </p>

          {/* Progress dots — only shown once a path is chosen */}
          {hadRecentInterview && (
            <div className="flex items-center gap-1.5 mb-5">
              {Array.from({ length: totalSteps }).map((_, i) => (
                <div
                  key={i}
                  className="h-1.5 flex-1 rounded-full transition-colors duration-300"
                  style={{ background: i <= step ? "var(--accent)" : "var(--border-mid)" }}
                />
              ))}
            </div>
          )}
        </div>

        <div key={step} className="relative px-6 pb-6 fade-up space-y-5">
          {/* Step 0 — yes/no */}
          {step === 0 && (
            <div className="space-y-3">
              <p className="text-sm font-medium" style={{ color: "var(--ink)" }}>
                Have you given any interview recently, or been selected for a role at any company?
              </p>
              <ChoiceCard
                selected={hadRecentInterview === "yes"}
                onClick={() => setHadRecentInterview("yes")}
                title="Yes"
                subtitle="I'll share the company, role, and what was asked."
              />
              <ChoiceCard
                selected={hadRecentInterview === "no"}
                onClick={() => setHadRecentInterview("no")}
                title="No"
                subtitle="Not recently — nothing to report right now."
              />
              {errors.hadRecentInterview && (
                <p className="text-xs" style={{ color: "var(--danger)" }}>
                  {errors.hadRecentInterview}
                </p>
              )}
            </div>
          )}

          {/* "No" path — single confirm-and-submit screen */}
          {step === 1 && hadRecentInterview === "no" && (
            <div className="text-center py-4">
              <p className="text-sm mb-6" style={{ color: "var(--ink-dim)" }}>
                No problem — we&apos;ll just note that you haven&apos;t interviewed recently.
                Come back and share it anytime from your dashboard once you have.
              </p>
            </div>
          )}

          {/* "Yes" path — step 1: details */}
          {step === 1 && hadRecentInterview === "yes" && (
            <>
              <Field label="Your name" error={errors.name}>
                <input
                  type="text"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  placeholder="Full name"
                  className={inputStyle}
                />
              </Field>
              <Field label="Email ID" error={errors.email}>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  placeholder="you@example.com"
                  className={inputStyle}
                />
              </Field>
              <Field label="Which company?" error={errors.companyName}>
                <input
                  type="text"
                  value={companyName}
                  onChange={(e) => setCompanyName(e.target.value)}
                  placeholder="e.g. Google"
                  className={inputStyle}
                />
              </Field>
              <Field label="Which role?" error={errors.roleTitle}>
                <input
                  type="text"
                  value={roleTitle}
                  onChange={(e) => setRoleTitle(e.target.value)}
                  placeholder="e.g. SDE-1"
                  className={inputStyle}
                />
              </Field>
            </>
          )}

          {/* "Yes" path — step 2: rounds */}
          {step === 2 && hadRecentInterview === "yes" && (
            <Field label="Rounds (round name & topics asked)" error={errors.rounds}>
              <div className="space-y-3">
                {rounds.map((r, i) => (
                  <div
                    key={i}
                    className="rounded-2xl p-3.5 space-y-2"
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
                          className="text-xs font-medium"
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
                      placeholder="Round name, e.g. Technical Round 1"
                      className={inputStyle}
                    />
                    <textarea
                      value={r.topics}
                      onChange={(e) => updateRound(i, "topics", e.target.value)}
                      placeholder="Topics asked, e.g. Arrays, System Design, SQL joins…"
                      rows={2}
                      className={`${inputStyle} resize-none`}
                    />
                    <textarea
                      value={r.questionsText}
                      onChange={(e) => updateRound(i, "questionsText", e.target.value)}
                      placeholder="Exact questions you were asked, one per line (optional — verified questions earn extra bonus interviews)"
                      rows={2}
                      className={`${inputStyle} resize-none`}
                    />
                  </div>
                ))}
                <button
                  type="button"
                  onClick={addRound}
                  className="text-sm font-semibold transition-opacity hover:opacity-80"
                  style={{ color: "var(--accent)" }}
                >
                  + Add another round
                </button>
              </div>
            </Field>
          )}

          {/* "Yes" path — step 3: proof + submit */}
          {step === 3 && hadRecentInterview === "yes" && (
            <Field label="Can you provide proof of the interview you were recently interviewed for?" error={errors.canProvideProof}>
              <div className="space-y-2.5">
                <ChoiceCard selected={canProvideProof === "yes"} onClick={() => setCanProvideProof("yes")} title="Yes" subtitle="I can share an offer letter, email, or similar." />
                <ChoiceCard selected={canProvideProof === "no"} onClick={() => setCanProvideProof("no")} title="No" subtitle="I don't have anything to share." />
              </div>
            </Field>
          )}

          {submitError && (
            <p className="text-sm" style={{ color: "var(--danger)" }}>
              {submitError}
            </p>
          )}

          {/* Navigation */}
          <div className="flex gap-3 pt-1">
            {step > 0 && (
              <button
                onClick={goBack}
                disabled={submitting}
                className="px-5 py-3 rounded-full text-sm font-semibold transition-colors"
                style={{ background: "var(--page)", color: "var(--ink-dim)", border: "1px solid var(--border-mid)" }}
              >
                Back
              </button>
            )}

            {step === 0 && (
              <button
                onClick={() => {
                  if (!hadRecentInterview) {
                    setErrors({ hadRecentInterview: "Please select an option." });
                    return;
                  }
                  setErrors({});
                  setStep(1);
                }}
                className="flex-1 py-3 rounded-full text-sm font-semibold transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                Continue
              </button>
            )}

            {step === 1 && hadRecentInterview === "no" && (
              <button
                onClick={() => submit("no")}
                disabled={submitting}
                className="flex-1 py-3 rounded-full text-sm font-semibold transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            )}

            {(step === 1 || step === 2) && hadRecentInterview === "yes" && (
              <button
                onClick={goNext}
                className="flex-1 py-3 rounded-full text-sm font-semibold transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98]"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                Continue
              </button>
            )}

            {step === 3 && hadRecentInterview === "yes" && (
              <button
                onClick={() => submit("yes")}
                disabled={submitting}
                className="flex-1 py-3 rounded-full text-sm font-semibold transition-transform duration-200 hover:scale-[1.02] active:scale-[0.98] disabled:opacity-60"
                style={{ background: "var(--accent)", color: "var(--accent-ink)" }}
              >
                {submitting ? "Submitting…" : "Submit"}
              </button>
            )}
          </div>
        </div>
      </div>
    </div>,
    document.body
  );
}
