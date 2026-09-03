import Image from "next/image";
import Link from "next/link";
import { FaLinkedin } from "react-icons/fa6";
import icon from "@/app/icon.png";
import { OPERATOR_LEGAL_NAME } from "@/lib/legal";

export default function MarketingFooter() {
  return (
    <footer className="mx-auto max-w-[1180px] px-4 pb-12 pt-8 sm:px-8">
      <div className="grid grid-cols-2 gap-10 border-t border-[var(--border-mid)] pt-[26px] sm:grid-cols-2 lg:grid-cols-4">
        <div className="col-span-2 lg:col-span-1">
          <div className="font-display mb-4 flex items-center gap-2.5 text-lg font-bold tracking-[-0.025em] text-[var(--ink)]">
            <Image src={icon} alt="EvaluLabs" width={26} height={26} className="rounded-md" />
            EvaluLabs
          </div>
          <p className="max-w-xs text-sm leading-relaxed text-[var(--ink-dim)]">
            Practice with the questions people were actually asked.
          </p>
        </div>
        <div>
          <p className="font-label mb-4">Product</p>
          <div className="flex flex-col gap-2.5 text-sm">
            <Link href="/#product" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">
              Features
            </Link>
            <Link href="/pricing" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">
              Pricing
            </Link>
            <Link href="/companies" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">
              Companies
            </Link>
            <Link href="/enterprise" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">
              Enterprise
            </Link>
          </div>
        </div>
        <div>
          <p className="font-label mb-4">Company</p>
          <div className="flex flex-col gap-2.5 text-sm">
            <Link href="/about" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">
              About
            </Link>
            <Link href="/contact" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">
              Contact
            </Link>
            <a
              href="https://www.linkedin.com/company/evalulabs/"
              target="_blank"
              rel="noopener noreferrer"
              className="flex items-center gap-2 text-[var(--ink-dim)] hover:text-[var(--olive)]"
            >
              <FaLinkedin size={15} aria-hidden="true" /> LinkedIn
            </a>
          </div>
        </div>
        <div>
          <p className="font-label mb-4">Legal</p>
          <div className="flex flex-col gap-2.5 text-sm">
            <Link href="/terms" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">
              Terms
            </Link>
            <Link href="/privacy" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">
              Privacy
            </Link>
            <Link href="/refund" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">
              Refund
            </Link>
            <Link href="/cancellation" className="text-[var(--ink-dim)] hover:text-[var(--olive)]">
              Cancellation
            </Link>
          </div>
        </div>
      </div>
      <div className="flex flex-col items-center justify-between gap-2 pt-6 text-[13px] text-[var(--ink-faint)] sm:flex-row">
        <span>© {new Date().getFullYear()} EvaluLabs</span>
        <span>Operated by {OPERATOR_LEGAL_NAME}</span>
      </div>
    </footer>
  );
}
