import Link from "next/link";
import LegalPageShell from "@/components/LegalPageShell";
import {
  OPERATOR_LEGAL_NAME,
  PLAN_ACCESS_DAYS,
  REFUND_REQUEST_DAYS,
  REGISTERED_ADDRESS,
  SUPPORT_EMAIL,
  TRADE_NAME,
} from "@/lib/legal";

export default function CancellationPage() {
  return (
    <LegalPageShell
      title="Cancellation Policy"
      description="How to stop a paid plan — no auto-renewal and no cancellation fees."
    >
      <p>
        <strong>Last updated:</strong> {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      <p>
        This website is operated by <strong>{OPERATOR_LEGAL_NAME}</strong>, trading as{" "}
        <strong>{TRADE_NAME}</strong>.
      </p>

      <h2>1. No auto-renewal</h2>
      <p>
        {TRADE_NAME} does <strong>not</strong> automatically charge your payment method. Each plan
        purchase is a one-time payment for a {PLAN_ACCESS_DAYS}-day access period.
      </p>

      <h2>2. How to cancel</h2>
      <p>
        To stop using a paid plan, simply <strong>do not purchase again</strong> when your current{" "}
        {PLAN_ACCESS_DAYS}-day period ends. No further action is required and no cancellation fee
        applies.
      </p>

      <h2>3. Access after cancellation</h2>
      <p>
        You retain paid-plan access until the end of your current {PLAN_ACCESS_DAYS}-day period.
        After that, your account reverts to the Free plan with its monthly interview limit.
      </p>

      <h2>4. Mid-cycle cancellation</h2>
      <p>
        If you purchased a plan and no longer wish to continue, you may request a refund only under
        the terms of our{" "}
        <Link href="/refund" className="underline underline-offset-4 hover:opacity-70">
          Refund Policy
        </Link>{" "}
        (within {REFUND_REQUEST_DAYS} days, with no paid interviews used).
      </p>

      <h2>5. Account deletion</h2>
      <p>
        To delete your account and associated data, email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4 hover:opacity-70">
          {SUPPORT_EMAIL}
        </a>
        . Deletion is permanent and cannot be undone.
      </p>

      <h2>6. Contact</h2>
      <p>
        <strong>{OPERATOR_LEGAL_NAME}</strong> (trading as {TRADE_NAME})
        <br />
        Registered address: {REGISTERED_ADDRESS}
        <br />
        Email:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4 hover:opacity-70">
          {SUPPORT_EMAIL}
        </a>
      </p>
    </LegalPageShell>
  );
}
