"use client";

import { useEffect, useState } from "react";
import { PARTNER_REF_KEY } from "@/components/ReferralTracker";
import { partnerReferrals } from "@/lib/api";

const inputClass =
  "w-full rounded-xl border border-[var(--border-mid)] bg-[var(--page)] px-4 py-3 text-sm text-[var(--ink)] outline-none focus:border-[var(--ink)]";

export default function EnterpriseInterestForm() {
  const [companyName, setCompanyName] = useState("");
  const [contactName, setContactName] = useState("");
  const [contactEmail, setContactEmail] = useState("");
  const [seatsNeeded, setSeatsNeeded] = useState("50");
  const [referralCode, setReferralCode] = useState("");
  const [message, setMessage] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [success, setSuccess] = useState<string | null>(null);

  useEffect(() => {
    const stored = localStorage.getItem(PARTNER_REF_KEY);
    if (stored) setReferralCode(stored);
  }, []);

  const handleSubmit = async (event: React.FormEvent) => {
    event.preventDefault();
    setSubmitting(true);
    setError(null);
    try {
      const result = await partnerReferrals.submitLead({
        company_name: companyName.trim(),
        contact_name: contactName.trim(),
        contact_email: contactEmail.trim(),
        seats_needed: Number(seatsNeeded) || 50,
        referral_code: referralCode.trim(),
        message: message.trim(),
      });
      const partnerNote = result.referral_partner
        ? ` We have recorded your referral from ${result.referral_partner}.`
        : "";
      setSuccess(`${result.detail}${partnerNote}`);
      setCompanyName("");
      setContactName("");
      setContactEmail("");
      setMessage("");
    } catch (err) {
      setError(err instanceof Error ? err.message : "Something went wrong. Please try again.");
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <section id="enterprise-interest" className="mx-auto max-w-[1180px] px-6 pb-4 sm:px-8">
      <div
        className="relative overflow-hidden rounded-[28px] px-8 py-14 sm:px-[54px] sm:py-[62px]"
        style={{ background: "var(--hero-bg)", color: "var(--hero-text)" }}
      >
        <div
          className="el-float pointer-events-none absolute -bottom-[100px] -right-[70px] h-[300px] w-[300px] rounded-full"
          style={{ background: "var(--lime)" }}
        />
        <div className="relative grid gap-10 lg:grid-cols-[0.95fr_1.05fr] lg:items-start">
          <div>
            <div className="mb-[18px] font-mono text-[10px] uppercase tracking-[0.16em] text-[var(--lime)]">
              Get started
            </div>
            <h2 className="font-display text-[36px] font-bold leading-none tracking-[-0.035em] sm:text-[52px]">
              Tell us about your hiring needs.
            </h2>
            <p className="mt-[18px] max-w-[440px] text-base leading-relaxed text-[#A3A29A]">
              Share your company details and we&apos;ll set up your enterprise workspace.
              If a partner like Wellfound referred you, include their code — they earn
              commission when you sign up.
            </p>
          </div>

          {success ? (
            <div
              className="rounded-[20px] border px-6 py-8 text-sm leading-relaxed"
              style={{ borderColor: "rgba(255,255,255,0.12)", background: "#17171A", color: "#D6D4CC" }}
            >
              {success}
            </div>
          ) : (
            <form onSubmit={handleSubmit} className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <label className="block sm:col-span-2">
                  <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A3A29A]">
                    Company name
                  </span>
                  <input
                    className={inputClass}
                    value={companyName}
                    onChange={(e) => setCompanyName(e.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A3A29A]">
                    Your name
                  </span>
                  <input
                    className={inputClass}
                    value={contactName}
                    onChange={(e) => setContactName(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A3A29A]">
                    Work email
                  </span>
                  <input
                    type="email"
                    className={inputClass}
                    value={contactEmail}
                    onChange={(e) => setContactEmail(e.target.value)}
                    required
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A3A29A]">
                    Candidate interviews needed
                  </span>
                  <input
                    type="number"
                    min={1}
                    className={inputClass}
                    value={seatsNeeded}
                    onChange={(e) => setSeatsNeeded(e.target.value)}
                  />
                </label>
                <label className="block">
                  <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A3A29A]">
                    Partner referral code
                  </span>
                  <input
                    className={inputClass}
                    value={referralCode}
                    onChange={(e) => setReferralCode(e.target.value)}
                    placeholder="e.g. WELLFOUND"
                  />
                </label>
              </div>
              <label className="block">
                <span className="mb-2 block font-mono text-[10px] uppercase tracking-[0.14em] text-[#A3A29A]">
                  Anything else?
                </span>
                <textarea
                  className={`${inputClass} min-h-[110px] resize-y`}
                  value={message}
                  onChange={(e) => setMessage(e.target.value)}
                  placeholder="Roles you're hiring for, timeline, current team size…"
                />
              </label>
              {error && <p className="text-sm text-red-300">{error}</p>}
              <button
                type="submit"
                disabled={submitting}
                className="rounded-full px-[30px] py-4 text-[15px] font-bold text-[var(--ink)] hover:brightness-95 disabled:opacity-60"
                style={{ background: "var(--lime)" }}
              >
                {submitting ? "Sending…" : "Request enterprise access →"}
              </button>
            </form>
          )}
        </div>
      </div>
    </section>
  );
}
