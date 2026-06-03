import type { MetadataRoute } from "next";

const baseUrl = "https://www.revisiongrade.com";

const routes = [
  "/",
  "/evaluate",
  "/revise",
  "/agent-readiness",
  "/storygate-studio",
  "/pricing",
  "/resources",
  "/black-box-problem",
  "/methodology",
  "/reliability",
  "/faq",
  "/privacy-research-controls",
  "/security",
  "/genre-classification-faq",
  "/storygate-studio/faq",
  "/agent-readiness/faq",
  "/literary-ai-partner",
  "/ai-manuscript-evaluation",
  "/ai-novel-critique",
  "/manuscript-revision-software",
  "/novel-revision-tool",
  "/developmental-editing-ai",
  "/manuscript-readiness-report",
  "/query-letter-synopsis-generator",
  "/ai-editor-for-novels",
  "/sample-ai-novel-critique-the-awakening",
  "/sample-ai-novel-critique-dracula",
  "/sample-ai-novel-critique-wizard-of-oz",
  "/founder-case-study-cartel-babies",
  "/founder-case-study-let-the-river-decide",
  "/founder-case-study-lost-world-of-mythoamphibia",
];

export default function sitemap(): MetadataRoute.Sitemap {
  const now = new Date();

  return routes.map((route) => ({
    url: `${baseUrl}${route}`,
    lastModified: now,
    changeFrequency: route === "/" || route === "/resources" ? "weekly" : "monthly",
    priority: route === "/" ? 1 : route === "/resources" ? 0.9 : 0.7,
  }));
}
