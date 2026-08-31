import Link from "next/link";
import LegalPageShell from "@/components/LegalPageShell";
import {
  OPERATOR_LEGAL_NAME,
  PLAN_ACCESS_DAYS,
  REFUND_PROCESSING_WINDOW,
  REFUND_REQUEST_DAYS,
  REGISTERED_ADDRESS,
  SUPPORT_EMAIL,
  TRADE_NAME,
} from "@/lib/legal";

export default function RefundPage() {
  return (
    <LegalPageShell
      title="Refund Policy"
      description="When you can get a full refund and how to request one."
    >
      <p>
        <strong>Last updated:</strong> {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      <p>
        This website is operated by <strong>{OPERATOR_LEGAL_NAME}</strong>, trading as{" "}
        <strong>{TRADE_NAME}</strong>.
      </p>

      <h2>1. Prepaid plans</h2>
      <p>
        {TRADE_NAME} plans (Pro, Premium, Max) are prepaid for a {PLAN_ACCESS_DAYS}-day access
        period. Each purchase is a one-time payment for that period.
      </p>

      <h2>2. Refund eligibility</h2>
      <p>
        You may request a <strong>full refund</strong> within <strong>{REFUND_REQUEST_DAYS} days</strong> of
        payment if:
      </p>
      <ul className="list-disc space-y-1 pl-5">
        <li>You have not completed any mock interview while on the paid plan purchased, and</li>
        <li>No top-up credits from a related purchase have been used.</li>
      </ul>

      <h2>3. Non-refundable cases</h2>
      <p>Refunds are not provided when:</p>
      <ul className="list-disc space-y-1 pl-5">
        <li>One or more paid-plan interviews have been completed.</li>
        <li>Top-up credits have been partially or fully used.</li>
        <li>The {PLAN_ACCESS_DAYS}-day access period has ended.</li>
        <li>You are dissatisfied with AI feedback or scores (subjective evaluation).</li>
      </ul>

      <h2>4. Exceptional cases</h2>
      <p>
        Full refunds are issued for duplicate payments, failed account activation after successful
        payment, or documented technical failures that prevented use of the service.
      </p>

      <h2>5. Refund mode and duration</h2>
      <p>
        Approved refunds are credited to the <strong>original payment method</strong> (UPI, debit/credit
        card, or net banking) within <strong>{REFUND_PROCESSING_WINDOW}</strong>.
      </p>

      <h2>6. How to request a refund</h2>
      <p>
        Email{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4 hover:opacity-70">
          {SUPPORT_EMAIL}
        </a>{" "}
        with your registered email, payment date, payment/transaction ID, and reason for the request.
        Requests must be submitted within {REFUND_REQUEST_DAYS} days of the payment date.
      </p>

      <h2>7. Contact</h2>
      <p>
        <strong>{OPERATOR_LEGAL_NAME}</strong> (trading as {TRADE_NAME})
        <br />
        Registered address: {REGISTERED_ADDRESS}
        <br />
        See also our{" "}
        <Link href="/cancellation" className="underline underline-offset-4 hover:opacity-70">
          Cancellation Policy
        </Link>
        .
      </p>
    </LegalPageShell>
  );
}
