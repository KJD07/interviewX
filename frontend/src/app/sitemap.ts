import type { MetadataRoute } from "next";
import { canonicalUrl } from "@/lib/seo";

/** Public, indexable routes. Keep in sync with the disallow list in robots.ts. */
const ROUTES: { path: string; priority: number; changeFrequency: MetadataRoute.Sitemap[number]["changeFrequency"] }[] = [
  { path: "/", priority: 1.0, changeFrequency: "weekly" },
  { path: "/companies", priority: 0.9, changeFrequency: "weekly" },
  { path: "/skills", priority: 0.9, changeFrequency: "weekly" },
  { path: "/solutions/ai-technical-interviews", priority: 0.8, changeFrequency: "monthly" },
  { path: "/solutions/ai-coding-interviews", priority: 0.8, changeFrequency: "monthly" },
  { path: "/solutions/interview-proctoring", priority: 0.8, changeFrequency: "monthly" },
  { path: "/enterprise", priority: 0.8, changeFrequency: "monthly" },
  { path: "/pricing", priority: 0.7, changeFrequency: "monthly" },
  { path: "/about", priority: 0.7, changeFrequency: "monthly" },
  { path: "/register", priority: 0.5, changeFrequency: "monthly" },
  { path: "/contact", priority: 0.4, changeFrequency: "yearly" },
  { path: "/terms", priority: 0.3, changeFrequency: "yearly" },
  { path: "/privacy", priority: 0.3, changeFrequency: "yearly" },
  { path: "/refund", priority: 0.3, changeFrequency: "yearly" },
  { path: "/cancellation", priority: 0.3, changeFrequency: "yearly" },
];

export default function sitemap(): MetadataRoute.Sitemap {
  const lastModified = new Date();
  return ROUTES.map(({ path, priority, changeFrequency }) => ({
    url: canonicalUrl(path),
    lastModified,
    changeFrequency,
    priority,
  }));
}
