"use client";

/**
 * Pitch Builder
 * - Elevator Pitch: one sentence
 * - Paragraph Pitch: one compact paragraph
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

export default function PitchPage() {
  const [elevator,         setElevator]        = useState("");
  const [paragraph,        setParagraph]        = useState("");
  const [elevatorApproved, setElevatorApproved] = useState(false);

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.cream, fontFamily: T.mono }}>
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "3rem 2rem 6rem" }}>

        <p style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", marginBottom: "1.5rem" }}>
          <Link href="/agent-readiness" style={{ color: T.gold, textDecoration: "none" }}>Agent Readiness Package™</Link>
          {" "}/{" "}Pitch Builder
        </p>

        <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          04 — Elevator Pitch
        </p>
        <h1 style={{ fontFamily: T.serif, fontSize: "1.75rem", color: T.cream, marginBottom: "2rem" }}>
          Pitch Builder
        </h1>

        {/* Elevator Pitch */}
        <div style={{ marginBottom: "2.5rem" }}>
          <label style={{ display: "block", fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
            Elevator Pitch — one sentence
          </label>
          <p style={{ fontSize: "0.75rem", color: T.cream2, lineHeight: 1.6, marginBottom: "0.875rem" }}>
            A compact, high-impact sentence suitable for query forms, verbal pitching, and manuscript metadata.
          </p>
          <textarea
            value={elevator}
            onChange={(e) => { setElevator(e.target.value); setElevatorApproved(false); }}
            rows={3}
            placeholder="[TITLE] is a [genre] novel in which [protagonist] must [central conflict] or [stakes]."
            style={{
              width: "100%", fontFamily: T.mono, fontSize: "0.8125rem", color: T.cream,
              backgroundColor: T.panel, border: `1px solid ${T.border}`,
              padding: "0.875rem", resize: "none", outline: "none", lineHeight: 1.65,
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            {["Generate", "Regenerate", "Improve", "Copy"].map(label => (
              <button key={label} style={{
                fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                backgroundColor: label === "Generate" ? T.gold : "transparent",
                color: label === "Generate" ? T.ink : T.cream2,
                border: label === "Generate" ? "none" : `1px solid ${T.border}`,
                padding: "0.5rem 1rem", cursor: "pointer",
              }}>{label}</button>
            ))}
            <button
              onClick={() => elevator.trim().length > 10 && setElevatorApproved(true)}
              disabled={elevator.trim().length < 10}
              style={{
                fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                backgroundColor: elevatorApproved ? "#5A8A5A" : "transparent",
                color: elevatorApproved ? "#F2EFEA" : "#5A8A5A",
                border: `1px solid ${elevator.trim().length < 10 ? T.border : "#5A8A5A"}`,
                padding: "0.5rem 1rem",
                cursor: elevator.trim().length < 10 ? "not-allowed" : "pointer",
                opacity: elevator.trim().length < 10 ? 0.4 : 1,
              }}
            >
              {elevatorApproved ? "✓ Approved" : "Lock / Approve"}
            </button>
          </div>
        </div>

        {/* Paragraph Pitch */}
        <div>
          <label style={{ display: "block", fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
            Paragraph Pitch <span style={{ color: "#7B7060", fontWeight: 400 }}>(optional — for email, networking, query forms)</span>
          </label>
          <p style={{ fontSize: "0.75rem", color: T.cream2, lineHeight: 1.6, marginBottom: "0.875rem" }}>
            One compact paragraph suitable for email queries, agent networking, and package summaries.
          </p>
          <textarea
            value={paragraph}
            onChange={(e) => setParagraph(e.target.value)}
            rows={6}
            placeholder="Expand the elevator pitch into a short paragraph with the hook, the core conflict, the stakes, and the market positioning."
            style={{
              width: "100%", fontFamily: T.mono, fontSize: "0.8125rem", color: T.cream,
              backgroundColor: T.panel, border: `1px solid ${T.border}`,
              padding: "0.875rem", resize: "vertical", outline: "none", lineHeight: 1.65,
              boxSizing: "border-box",
            }}
          />
          <div style={{ display: "flex", gap: "0.75rem", marginTop: "0.75rem", flexWrap: "wrap" }}>
            {["Generate", "Regenerate", "Improve", "Copy"].map(label => (
              <button key={label} style={{
                fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
                letterSpacing: "0.1em", textTransform: "uppercase",
                backgroundColor: label === "Generate" ? T.gold : "transparent",
                color: label === "Generate" ? T.ink : T.cream2,
                border: label === "Generate" ? "none" : `1px solid ${T.border}`,
                padding: "0.5rem 1rem", cursor: "pointer",
              }}>{label}</button>
            ))}
          </div>
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
