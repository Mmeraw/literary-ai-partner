// app/layout.jsx
import "./globals.css";
import HeaderNav from "../components/HeaderNav";
import SiteFooter from "../components/SiteFooter";

export const metadata = {
  title: "RevisionGrade™",
  description:
    "A governed revision operating system for serious manuscripts.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      {/*
        Body: rg-ink background throughout.
        Pages that need full-bleed dark layouts (private-beta, login) override
        with their own min-h-screen wrapper.
        Pages that are app routes get the standard max-width content shell.
      */}
      <body
        className="antialiased bg-rg-ink text-rg-cream font-rg-serif"
        suppressHydrationWarning
      >
        <HeaderNav />
        <main>{children}</main>
        <SiteFooter />
      </body>
    </html>
  );
}
