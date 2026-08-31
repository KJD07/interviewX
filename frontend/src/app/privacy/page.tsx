import Link from "next/link";
import LegalPageShell from "@/components/LegalPageShell";
import {
  OPERATOR_LEGAL_NAME,
  REGISTERED_ADDRESS,
  SUPPORT_EMAIL,
  TRADE_NAME,
} from "@/lib/legal";

export default function PrivacyPage() {
  return (
    <LegalPageShell
      title="Privacy Policy"
      description="What we collect, how we use it, and your rights over your data."
    >
      <p>
        <strong>Last updated:</strong> {new Date().toLocaleDateString("en-IN", { day: "numeric", month: "long", year: "numeric" })}
      </p>

      <p>
        This website is operated by <strong>{OPERATOR_LEGAL_NAME}</strong>, trading as{" "}
        <strong>{TRADE_NAME}</strong>. This policy explains what data we collect and how we use it.
      </p>

      <h2>1. Data we collect</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>Account information: name, email address, and authentication details.</li>
        <li>Interview data: transcripts, scores, and session metadata from mock interviews.</li>
        <li>Payment information: transaction IDs and order details (card/UPI details are handled by our payment gateway, not stored by us).</li>
        <li>Usage data: pages visited, features used, and technical logs for security and debugging.</li>
      </ul>

      <h2>2. How we use your data</h2>
      <ul className="list-disc space-y-1 pl-5">
        <li>To provide and improve the mock interview service.</li>
        <li>To process payments and manage your plan or top-up credits.</li>
        <li>To send account-related emails (verification, password reset, support replies).</li>
        <li>To generate AI feedback and scoring on your interview performance.</li>
      </ul>

      <h2>3. Third-party services</h2>
      <p>
        We use third-party providers for payment processing, email delivery, and AI inference.
        These providers process data only as needed to deliver their service. We do not sell your
        personal data.
      </p>

      <h2>4. Data retention</h2>
      <p>
        We retain account and interview data while your account is active. You may request account
        deletion by emailing us. Some records may be kept as required by law or for dispute
        resolution.
      </p>

      <h2>5. Your rights</h2>
      <p>
        You may request access to, correction of, or deletion of your personal data by contacting{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4 hover:opacity-70">
          {SUPPORT_EMAIL}
        </a>
        .
      </p>

      <h2>6. Security</h2>
      <p>
        We use industry-standard measures to protect your data. No method of transmission over the
        internet is 100% secure.
      </p>

      <h2>7. Contact</h2>
      <p>
        <strong>{OPERATOR_LEGAL_NAME}</strong> (trading as {TRADE_NAME})
        <br />
        Registered address: {REGISTERED_ADDRESS}
        <br />
        Email:{" "}
        <a href={`mailto:${SUPPORT_EMAIL}`} className="underline underline-offset-4 hover:opacity-70">
          {SUPPORT_EMAIL}
        </a>
        <br />
        See also our{" "}
        <Link href="/terms" className="underline underline-offset-4 hover:opacity-70">
          Terms &amp; Conditions
        </Link>
        .
      </p>
    </LegalPageShell>
  );
}
