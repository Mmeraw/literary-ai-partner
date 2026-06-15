// app/layout.jsx
import { Suspense } from "react";
import "./globals.css";
import "./mobile-responsive-guard.css";
import "./button-contrast-guard.css";
import HeaderNav from "../components/HeaderNav";
import SiteFooter from "../components/SiteFooter";
import ReportColorSystemHydrator from "../components/reports/ReportColorSystemHydrator";
import SiteAnalyticsTracker from "../components/analytics/SiteAnalyticsTracker";

const siteUrl = "https://www.revisiongrade.com";
const siteDescription =
  "The Literary AI Partner for manuscript diagnosis, author-controlled revision, and professional submission preparation.";

export const metadata = {
  metadataBase: new URL(siteUrl),
  title: {
    default: "RevisionGrade | The Literary AI Partner",
    template: "%s | RevisionGrade",
  },
  description: siteDescription,
  applicationName: "RevisionGrade",
  keywords: [
    "RevisionGrade",
    "Literary AI Partner",
    "AI manuscript evaluation",
    "AI novel critique",
    "manuscript revision software",
    "novel revision tool",
    "developmental editing AI",
    "manuscript readiness report",
    "query letter synopsis generator",
    "agent readiness",
  ],
  authors: [{ name: "RevisionGrade" }],
  creator: "RevisionGrade",
  publisher: "RevisionGrade",
  alternates: {
    canonical: siteUrl,
  },
  openGraph: {
    type: "website",
    locale: "en_US",
    url: siteUrl,
    siteName: "RevisionGrade",
    title: "RevisionGrade | The Literary AI Partner",
    description: siteDescription,
  },
  twitter: {
    card: "summary_large_image",
    title: "RevisionGrade | The Literary AI Partner",
    description: siteDescription,
  },
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
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="overflow-x-hidden antialiased bg-rg-ink text-rg-cream font-rg-serif"
        suppressHydrationWarning
      >
        <ReportColorSystemHydrator />
        <Suspense fallback={null}>
          <SiteAnalyticsTracker />
        </Suspense>
        <HeaderNav />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
