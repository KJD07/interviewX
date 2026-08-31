import Link from "next/link";
import LegalPageShell from "@/components/LegalPageShell";
import {
  OPERATOR_LEGAL_NAME,
  PLAN_ACCESS_DAYS,
  REGISTERED_ADDRESS,
  SUPPORT_EMAIL,
  TRADE_NAME,
} from "@/lib/legal";

export default function TermsPage() {
  return (
    <LegalPageShell
      title="Terms & Conditions"
      description="The rules for using EvaluLabs, our AI mock interview platform."
    >
      <p>
        <strong>Last updated:</strong> {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      <p>
        This website is operated by <strong>{OPERATOR_LEGAL_NAME}</strong>, trading as{" "}
        <strong>{TRADE_NAME}</strong>.
      </p>

      <p>
        By accessing or using {TRADE_NAME} at evalulabs.com, you agree to these Terms &amp;
        Conditions. If you do not agree, do not use the service.
      </p>

      <h2>1. Service</h2>
      <p>
        {TRADE_NAME} provides AI-powered mock interview practice, scoring, and related features.
        Plans are prepaid for a {PLAN_ACCESS_DAYS}-day access period. Payment is a one-time charge
        for that period unless you purchase again.
      </p>

      <h2>2. Accounts</h2>
      <p>
        You must provide accurate registration information and keep your account credentials secure.
        You are responsible for activity under your account.
      </p>

      <h2>3. Payments</h2>
      <p>
        Paid plans and top-up packs are billed through our payment gateway. Prices are shown on the{" "}
        <Link href="/pricing" className="underline underline-offset-4 hover:opacity-70">
          pricing page
        </Link>
        . We do not automatically renew or charge your payment method — you must purchase again to
        extend access.
      </p>

      <h2>4. Acceptable use</h2>
      <p>
        You may not misuse the platform, attempt to bypass usage limits, scrape content, or use the
        service for unlawful purposes. We may suspend accounts that violate these terms.
      </p>

      <h2>5. Refunds &amp; cancellation</h2>
      <p>
        Refunds are governed by our{" "}
        <Link href="/refund" className="underline underline-offset-4 hover:opacity-70">
          Refund Policy
        </Link>
        . Cancellation is governed by our{" "}
        <Link href="/cancellation" className="underline underline-offset-4 hover:opacity-70">
          Cancellation Policy
        </Link>
        .
      </p>

      <h2>6. Disclaimer</h2>
      <p>
        {TRADE_NAME} is a practice tool. We do not guarantee interview outcomes, job offers, or
        specific scores. AI-generated feedback is provided for learning purposes only.
      </p>

      <h2>7. Limitation of liability</h2>
      <p>
        To the fullest extent permitted by law, {OPERATOR_LEGAL_NAME} is not liable for indirect,
        incidental, or consequential damages arising from use of the service.
      </p>

      <h2>8. Governing law</h2>
      <p>
        These terms are governed by the laws of India. Disputes are subject to the jurisdiction of
        courts in India.
      </p>

      <h2>9. Contact</h2>
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
