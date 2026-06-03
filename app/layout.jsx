// app/layout.jsx
import { Suspense } from "react";
import "./globals.css";
import "./mobile-responsive-guard.css";
import HeaderNav from "../components/HeaderNav";
import SiteFooter from "../components/SiteFooter";
import ReportColorSystemHydrator from "../components/reports/ReportColorSystemHydrator";
import SiteAnalyticsTracker from "../components/analytics/SiteAnalyticsTracker";

export const metadata = {
  title: "RevisionGrade | The Literary AI Partner",
  description:
    "The Literary AI Partner for manuscript diagnosis, author-controlled revision, and professional submission preparation.",
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
