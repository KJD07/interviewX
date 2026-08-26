import type { Metadata } from "next";

/**
 * Single source of truth for SEO/AEO metadata. Every public route builds its
 * `metadata` export from `pageMetadata()` here rather than hand-rolling tags,
 * so titles, canonicals and OG cards stay consistent as routes are added.
 */

export const SITE_URL = "https://www.evalulabs.com";
export const SITE_NAME = "EvaluLabs";
export const TWITTER_HANDLE = "@evaluLabs";
export const TWITTER_URL = "https://x.com/evaluLabs";
export const LINKEDIN_URL = "https://www.linkedin.com/company/evalulabs/";

/** Brand-defining sentence. Reused by metadata, JSON-LD and llms.txt. */
export const BRAND_DESCRIPTION =
  "EvaluLabs is an AI mock interview platform where you practice with real interview questions verified by employees at the companies you're targeting, then get scored on communication, technical depth and problem solving.";

const OG_IMAGE = `${SITE_URL}/og.png`;

type PageMetaInput = {
  title: string;
  description: string;
  /** Route path, e.g. "/pricing". Used for the canonical URL. */
  path: string;
  keywords?: string[];
  /** Set for authenticated / transactional routes that must stay out of search. */
  noIndex?: boolean;
};

/** Absolute canonical URL for a route path. */
export function canonicalUrl(path: string) {
  return `${SITE_URL}${path === "/" ? "/" : path}`;
}

export function pageMetadata({
  title,
  description,
  path,
  keywords,
  noIndex = false,
}: PageMetaInput): Metadata {
  const url = canonicalUrl(path);

  return {
    title,
    description,
    keywords,
    alternates: { canonical: url },
    robots: noIndex
      ? { index: false, follow: false }
      : {
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
      url,
      title,
      description,
      images: [{ url: OG_IMAGE, width: 1200, height: 630, alt: SITE_NAME }],
    },
    twitter: {
      card: "summary_large_image",
      site: TWITTER_HANDLE,
      creator: TWITTER_HANDLE,
      title,
      description,
      images: [OG_IMAGE],
    },
  };
}

/**
 * Entity signals for the "evalulabs" brand query. `evalulab.com` (an unrelated
 * cosmetics lab) currently owns that SERP, so Organization + WebSite markup
 * with an explicit `alternateName` is what tells Google these are two
 * different entities.
 */
export function organizationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "Organization",
    "@id": `${SITE_URL}/#organization`,
    name: SITE_NAME,
    alternateName: ["Evalulabs", "Evalu Labs", "EvaluLabs AI"],
    url: SITE_URL,
    logo: {
      "@type": "ImageObject",
      url: `${SITE_URL}/icon.png`,
      width: 512,
      height: 512,
    },
    description: BRAND_DESCRIPTION,
    sameAs: [LINKEDIN_URL, TWITTER_URL],
    contactPoint: [
      {
        "@type": "ContactPoint",
        contactType: "customer support",
        url: `${SITE_URL}/contact`,
        availableLanguage: ["English"],
      },
    ],
  };
}

export function websiteSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "WebSite",
    "@id": `${SITE_URL}/#website`,
    name: SITE_NAME,
    alternateName: "Evalulabs",
    url: SITE_URL,
    description: BRAND_DESCRIPTION,
    publisher: { "@id": `${SITE_URL}/#organization` },
    inLanguage: "en",
  };
}

export function softwareApplicationSchema() {
  return {
    "@context": "https://schema.org",
    "@type": "SoftwareApplication",
    "@id": `${SITE_URL}/#software`,
    name: SITE_NAME,
    applicationCategory: "BusinessApplication",
    applicationSubCategory: "Interview Preparation",
    operatingSystem: "Web",
    url: SITE_URL,
    description: BRAND_DESCRIPTION,
    publisher: { "@id": `${SITE_URL}/#organization` },
    featureList: [
      "AI mock interviews with a company-specific interviewer persona",
      "Interview questions verified by current employees and recent candidates",
      "Voice mode with real-time transcription",
      "Scoring across communication, technical depth and problem solving",
      "Progress tracking across companies and roles",
    ],
    offers: {
      "@type": "Offer",
      price: "0",
      priceCurrency: "INR",
      description: "Free plan with a monthly allowance of AI mock interviews.",
    },
  };
}

export function faqSchema(faqs: { question: string; answer: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "FAQPage",
    "@id": `${SITE_URL}/#faq`,
    mainEntity: faqs.map((f) => ({
      "@type": "Question",
      name: f.question,
      acceptedAnswer: { "@type": "Answer", text: f.answer },
    })),
  };
}

export function breadcrumbSchema(items: { name: string; path: string }[]) {
  return {
    "@context": "https://schema.org",
    "@type": "BreadcrumbList",
    itemListElement: items.map((item, i) => ({
      "@type": "ListItem",
      position: i + 1,
      name: item.name,
      item: canonicalUrl(item.path),
    })),
  };
}
