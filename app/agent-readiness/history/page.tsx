"use client";

import Link from "next/link";

const T = {
  bg: "#0F0D0A", panel: "#1A1612", border: "#2A2420",
  gold: "#A98E4A", cream: "#F2EFEA", cream2: "#C8BFB0",
  dim: "#7B7060", ink: "#0E0E0E",
  serif: "'Playfair Display', 'Georgia', serif",
  mono: "'Inter', 'Courier New', monospace",
};

export default function PackageHistoryPage() {
  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.cream, fontFamily: T.mono }}>
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "3rem 2rem 6rem" }}>

        <p style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", marginBottom: "1.5rem" }}>
          <Link href="/agent-readiness" style={{ color: T.gold, textDecoration: "none" }}>Agent Readiness Package™</Link>
          {" "}/{" "}Package History / Export
        </p>

        <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          Package History / Export
        </p>
        <h1 style={{ fontFamily: T.serif, fontSize: "1.75rem", color: T.cream, marginBottom: "0.75rem" }}>
          Package History / Export
        </h1>
        <p style={{ fontSize: "0.8125rem", color: T.cream2, lineHeight: 1.65, marginBottom: "2.5rem" }}>
          Saved package versions appear here. Export is available once all six required sections are approved.
          DOCX export is active; PDF export will be enabled once formatting is validated.
        </p>

        {/* Empty state */}
        <div style={{ border: `1px solid ${T.border}`, padding: "3rem 2rem", textAlign: "center" }}>
          <p style={{ fontFamily: T.serif, fontSize: "1rem", color: T.cream2, marginBottom: "0.5rem" }}>
            No saved packages yet.
          </p>
          <p style={{ fontSize: "0.75rem", color: T.dim, lineHeight: 1.6 }}>
            Complete and approve all six required sections, then save a version to see it here.
          </p>
          <Link
            href="/agent-readiness"
            style={{
              display: "inline-block", marginTop: "1.5rem",
              fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              backgroundColor: T.gold, color: T.ink, textDecoration: "none",
              padding: "0.625rem 1.25rem",
            }}
          >
            Back to Package Overview
          </Link>
        </div>

        {/* Export note */}
        <div style={{ marginTop: "2rem", border: `1px solid ${T.border}`, padding: "1rem 1.25rem" }}>
          <p style={{ fontSize: "0.6875rem", color: T.dim, lineHeight: 1.65 }}>
            <strong style={{ color: T.cream2 }}>Export policy:</strong> PDF and DOCX export are locked until all six required package sections are approved.
            A "Submit to Storygate Studio™" option appears for manuscripts with a readiness score of 8.0 or above.
          </p>
        </div>

      </div>
    </div>
  );
}
