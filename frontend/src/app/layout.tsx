import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AuthProvider } from "@/context/AuthContext";
import ReferralTracker from "@/components/ReferralTracker";
import PostHogProvider from "@/components/PostHogProvider";
import SupportChatGate from "@/components/SupportChatGate";
import StructuredData from "@/components/StructuredData";
import {
  BRAND_DESCRIPTION,
  SITE_NAME,
  SITE_URL,
  TWITTER_HANDLE,
  organizationSchema,
  softwareApplicationSchema,
  websiteSchema,
} from "@/lib/seo";

export const metadata: Metadata = {
  metadataBase: new URL(SITE_URL),
  title: {
    // Every page keeps the brand in the title — the strongest single signal
    // for the "evalulabs" query.
    default: "EvaluLabs | AI Interview and Candidate Assessment Platform",
    template: "%s | EvaluLabs",
  },
  description: BRAND_DESCRIPTION,
  applicationName: SITE_NAME,
  keywords: [
    "EvaluLabs",
    "AI interview platform",
    "AI interviewer",
    "AI mock interview",
    "candidate screening",
    "AI coding interview",
    "interview proctoring",
    "technical interview practice",
    "verified interview questions",
  ],
  authors: [{ name: SITE_NAME, url: SITE_URL }],
  creator: SITE_NAME,
  publisher: SITE_NAME,
  alternates: { canonical: `${SITE_URL}/` },
  robots: {
    index: true,
    follow: true,
    googleBot: {
      index: true,
      follow: true,
      "max-image-preview": "large",
      "max-snippet": -1,
      "max-video-preview": -1,
    },
  },
  openGraph: {
    type: "website",
    siteName: SITE_NAME,
    locale: "en_US",
    url: `${SITE_URL}/`,
    title: "EvaluLabs | AI Interview and Candidate Assessment Platform",
    description: BRAND_DESCRIPTION,
    images: [{ url: `${SITE_URL}/og.png`, width: 1200, height: 630, alt: SITE_NAME }],
  },
  twitter: {
    card: "summary_large_image",
    site: TWITTER_HANDLE,
    creator: TWITTER_HANDLE,
    title: "EvaluLabs | AI Interview and Candidate Assessment Platform",
    description: BRAND_DESCRIPTION,
    images: [`${SITE_URL}/og.png`],
  },
  category: "education",
};

export const viewport: Viewport = {
  width: "device-width",
  initialScale: 1,
  themeColor: "#f2f0ea",
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="en">
      <body>
        <StructuredData
          schema={[organizationSchema(), websiteSchema(), softwareApplicationSchema()]}
        />
        <AuthProvider>
          <PostHogProvider>
            <ReferralTracker />
            {children}
            <SupportChatGate />
          </PostHogProvider>
        </AuthProvider>
      </body>
    </html>
  );
}
