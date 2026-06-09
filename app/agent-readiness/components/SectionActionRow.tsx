"use client";

import React from "react";
import type { SectionType, GenerateMode } from "../hooks/useAgentReadinessGenerate";

const T = {
  gold: "#A98E4A", cream2: "#C8BFB0", dim: "#7B7060",
  ink: "#0E0E0E", border: "#2A2420", oxblood: "#7A1E1E",
  mono: "'Inter', 'Courier New', monospace",
};

interface SectionActionRowProps {
  section: SectionType;
  generating: boolean;
  error: string | null;
  content: string;
  approved: boolean;
  overLimit?: boolean;
  onGenerate: (section: SectionType, mode: GenerateMode) => void;
  onApprove: () => void;
  onCopy: () => void;
  approveDisabled?: boolean;
}

export function SectionActionRow({
  section,
  generating,
  error,
  content,
  approved,
  overLimit = false,
  onGenerate,
  onApprove,
  onCopy,
  approveDisabled = false,
}: SectionActionRowProps) {
  const hasContent = content.trim().length >= 20;

  return (
    <>
      {error && (
        <div style={{
          border: `1px solid ${T.oxblood}40`, padding: "0.75rem 1.25rem",
          backgroundColor: "rgba(122,30,30,0.08)", fontSize: "0.75rem", color: T.oxblood,
          marginBottom: "1rem", lineHeight: 1.5,
        }}>
          {error}
        </div>
      )}

      <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "2rem" }}>
        <button
          onClick={() => onGenerate(section, 'generate')}
          disabled={generating}
          style={{
            fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: generating ? T.dim : T.gold, color: T.ink, border: "none",
            padding: "0.625rem 1.25rem", cursor: generating ? "wait" : "pointer",
            opacity: generating ? 0.6 : 1,
          }}
        >
          {generating ? "Generating..." : "Generate"}
        </button>

        <button
          onClick={() => onGenerate(section, 'regenerate')}
          disabled={generating}
          style={{
            fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: "transparent", color: T.cream2,
            border: `1px solid ${T.border}`, padding: "0.625rem 1.25rem",
            cursor: generating ? "wait" : "pointer", opacity: generating ? 0.5 : 1,
          }}
        >
          Regenerate
        </button>

        <button
          onClick={() => onGenerate(section, 'improve')}
          disabled={generating || !hasContent}
          style={{
            fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: "transparent", color: T.cream2,
            border: `1px solid ${T.border}`, padding: "0.625rem 1.25rem",
            cursor: generating || !hasContent ? "not-allowed" : "pointer",
            opacity: generating || !hasContent ? 0.4 : 1,
          }}
        >
          Improve
        </button>

        <button
          onClick={onCopy}
          disabled={!hasContent}
          style={{
            fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: "transparent", color: T.cream2,
            border: `1px solid ${T.border}`, padding: "0.625rem 1.25rem",
            cursor: hasContent ? "pointer" : "not-allowed",
            opacity: hasContent ? 1 : 0.4,
          }}
        >
          Copy
        </button>

        <button
          onClick={onApprove}
          disabled={approveDisabled || overLimit || !hasContent}
          style={{
            fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: approved ? "#5A8A5A" : "transparent",
            color: approved ? "#F2EFEA" : "#5A8A5A",
            border: `1px solid ${overLimit ? T.border : "#5A8A5A"}`,
            padding: "0.625rem 1.25rem",
            cursor: approveDisabled || overLimit || !hasContent ? "not-allowed" : "pointer",
            opacity: approveDisabled || overLimit || !hasContent ? 0.4 : 1,
          }}
        >
          {approved ? "✓ Approved" : "Lock / Approve"}
        </button>
      </div>
    </>
  );
}
