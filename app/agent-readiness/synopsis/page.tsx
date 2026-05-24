"use client";

/**
 * Synopsis Builder
 *
 * Three lengths:
 *   Query synopsis:   100–150 words
 *   Standard synopsis: 250–500 words  (default MVP)
 *   Extended synopsis: 700–1,000 words
 *
 * Rule: must reveal the ending. No teaser language.
 */

import Link from "next/link";
import { useState } from "react";

const T = {
  bg: "#0F0D0A", panel: "#1A1612", border: "#2A2420",
  gold: "#A98E4A", cream: "#F2EFEA", cream2: "#C8BFB0",
  dim: "#7B7060", ink: "#0E0E0E",
  serif: "'Playfair Display', 'Georgia', serif",
  mono: "'Inter', 'Courier New', monospace",
};

type SynopsisLength = "query" | "standard" | "extended";

const LENGTHS: { id: SynopsisLength; label: string; range: string; description: string }[] = [
  { id: "query",    label: "Query Synopsis",    range: "100–150 words",   description: "Suitable for query forms and agent intake." },
  { id: "standard", label: "Standard Synopsis", range: "250–500 words",   description: "Default. Suitable for most agency submissions." },
  { id: "extended", label: "Extended Synopsis", range: "700–1,000 words", description: "Full submission synopsis for agencies that require it." },
];

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function SynopsisPage() {
  const [selected, setSelected] = useState<SynopsisLength>("standard");
  const [content,  setContent]  = useState("");
  const [approved, setApproved] = useState(false);

  const wordCount = countWords(content);
  const limits: Record<SynopsisLength, [number, number]> = {
    query:    [100, 150],
    standard: [250, 500],
    extended: [700, 1000],
  };
  const [min, max] = limits[selected];
  const overLimit  = wordCount > max;
  const underMin   = content.trim().length > 0 && wordCount < min;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.cream, fontFamily: T.mono }}>
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "3rem 2rem 6rem" }}>

        <p style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", marginBottom: "1.5rem" }}>
          <Link href="/agent-readiness" style={{ color: T.gold, textDecoration: "none" }}>Agent Readiness Package™</Link>
          {" "}/{" "} Synopsis Builder
        </p>

        <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          03 — Synopsis
        </p>
        <h1 style={{ fontFamily: T.serif, fontSize: "1.75rem", color: T.cream, marginBottom: "0.75rem" }}>
          Synopsis Builder
        </h1>
        <p style={{ fontSize: "0.8125rem", color: T.cream2, lineHeight: 1.65, marginBottom: "2rem" }}>
          The synopsis must reveal the ending. No teaser language. Agents need to see the complete story arc.
        </p>

        {/* Length selector */}
        <div style={{ display: "flex", gap: "0.5rem", marginBottom: "1.75rem", flexWrap: "wrap" }}>
          {LENGTHS.map(l => (
            <button
              key={l.id}
              onClick={() => { setSelected(l.id); setApproved(false); }}
              style={{
                fontFamily: T.mono, fontSize: "0.5625rem", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                padding: "0.5rem 1rem",
                backgroundColor: selected === l.id ? T.gold : "transparent",
                color: selected === l.id ? T.ink : T.cream2,
                border: `1px solid ${selected === l.id ? T.gold : T.border}`,
                cursor: "pointer",
              }}
            >
              {l.label} <span style={{ fontWeight: 400, opacity: 0.7 }}>· {l.range}</span>
            </button>
          ))}
        </div>

        <div style={{ marginBottom: "1.75rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
            <label style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              {LENGTHS.find(l => l.id === selected)?.label}
            </label>
            <span style={{
              fontFamily: T.mono, fontSize: "0.6875rem",
              color: overLimit ? "#7A1E1E" : underMin ? T.gold : T.dim,
            }}>
              {wordCount} / {max} words
            </span>
          </div>
          <textarea
            value={content}
            onChange={(e) => { setContent(e.target.value); setApproved(false); }}
            rows={16}
            placeholder="Begin with the protagonist and inciting incident. Follow the central conflict through to resolution — include the ending. Do not use teaser language."
            style={{
              width: "100%", fontFamily: T.mono, fontSize: "0.8125rem", color: T.cream,
              backgroundColor: T.panel,
              border: `1px solid ${overLimit ? "#7A1E1E" : T.border}`,
              padding: "1rem", resize: "vertical", outline: "none", lineHeight: 1.75,
              boxSizing: "border-box",
            }}
          />
        </div>

        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
          {["Generate", "Regenerate", "Improve", "Copy", "Restore Version"].map(label => (
            <button key={label} style={{
              fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              backgroundColor: label === "Generate" ? T.gold : "transparent",
              color: label === "Generate" ? T.ink : T.cream2,
              border: label === "Generate" ? "none" : `1px solid ${T.border}`,
              padding: "0.625rem 1.25rem", cursor: "pointer",
            }}>
              {label}
            </button>
          ))}
          <button
            onClick={() => !overLimit && content.trim().length > 50 && setApproved(true)}
            disabled={overLimit || content.trim().length < 50}
            style={{
              fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              backgroundColor: approved ? "#5A8A5A" : "transparent",
              color: approved ? "#F2EFEA" : "#5A8A5A",
              border: `1px solid ${overLimit ? T.border : "#5A8A5A"}`,
              padding: "0.625rem 1.25rem",
              cursor: overLimit || content.trim().length < 50 ? "not-allowed" : "pointer",
              opacity: overLimit || content.trim().length < 50 ? 0.4 : 1,
            }}
          >
            {approved ? "✓ Approved" : "Lock / Approve"}
          </button>
        </div>

        <div style={{ marginTop: "2rem" }}>
          <Link href="/agent-readiness" style={{ fontFamily: T.mono, fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textDecoration: "none" }}>
            ← Back to Package Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
