import "./globals.css";

export const metadata = {
  title: "RevisionGrade™",
  description: "Professional Revision Framework - Operationalized with Governance",
};

export default function RootLayout({ children }) {
  return (
    <html lang="en" suppressHydrationWarning>
      <body className="antialiased">{children}</body>
    </html>
  );
}
