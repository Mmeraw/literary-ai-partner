import "./globals.css";
import HeaderNav from "../src/components/HeaderNav";

export const metadata = {
  title: "RevisionGrade™",
  description: "Professional Revision Framework - Operationalized with Governance",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased bg-gray-50">
        <HeaderNav />
        <main className="max-w-5xl mx-auto px-4 py-8">
          {children}
        </main>
      </body>
    </html>
  );
}
