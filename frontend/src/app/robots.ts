import type { MetadataRoute } from "next";
import { SITE_URL } from "@/lib/seo";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        // Authenticated, transactional and admin surfaces — no search value,
        // and crawling them just burns budget on redirects to /login.
        disallow: [
          "/dashboard",
          "/progress",
          "/interview/",
          "/malik/",
          "/verify-email",
          "/reset-password",
          "/forgot-password",
          "/enterprise/invite/",
          "/api/",
        ],
      },
    ],
    sitemap: `${SITE_URL}/sitemap.xml`,
    host: SITE_URL,
  };
}
