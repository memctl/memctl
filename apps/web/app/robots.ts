import type { MetadataRoute } from "next";

const siteUrl = process.env.NEXT_PUBLIC_APP_URL || "https://memctl.com";

export default function robots(): MetadataRoute.Robots {
  return {
    rules: [
      {
        userAgent: "*",
        allow: "/",
        disallow: [
          "/api/",
          "/admin/",
          "/org/",
          "/onboarding",
          "/org-banned",
          "/org-suspended",
        ],
      },
    ],
    sitemap: `${siteUrl}/sitemap.xml`,
  };
}
