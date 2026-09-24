import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

/** Authenticated, transactional, and admin paths. Keep in sync with sitemap.ts. */
const PRIVATE_PATHS = [
  "/dashboard",
  "/progress",
  "/interview/",
  "/malik/",
  "/verify-email",
  "/reset-password",
  "/forgot-password",
  "/enterprise/invite/",
  "/enterprise/dashboard",
  "/enterprise/candidate",
  "/enterprise/live/",
  "/enterprise/questions",
  "/analytics",
  "/partner",
  "/api/",
];

function rule(userAgent: string) {
  return { userAgent, allow: "/", disallow: PRIVATE_PATHS };
}

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      rule("*"),
      // Same policy as `*`. Named so AI search crawlers are not blocked by a
      // later blanket rule and can read the public marketing pages.
      rule("OAI-SearchBot"),
      rule("ChatGPT-User"),
      rule("PerplexityBot"),
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
