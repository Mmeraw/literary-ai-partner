// app/layout.jsx
import "./globals.css";
import ConditionalNav from "../components/ConditionalNav";

export const metadata = {
  title: "RevisionGrade™",
  description:
    "A governed revision operating system for serious manuscripts.",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body
        className="antialiased bg-rg-ink text-rg-cream font-rg-serif"
        suppressHydrationWarning
      >
        <ConditionalNav />
        {children}
      </body>
    </html>
  );
}
