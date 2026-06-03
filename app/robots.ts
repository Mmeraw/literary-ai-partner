import type { MetadataRoute } from "next";

const baseUrl = "https://www.revisiongrade.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: {
      userAgent: "*",
      allow: "/",
      disallow: ["/api/", "/admin/", "/workbench/"],
    },
    sitemap: `${baseUrl}/sitemap.xml`,
  };
}
