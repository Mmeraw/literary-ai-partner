"use client";

/**
 * Query / Cover Letter builder
 *
 * Rules:
 * - 450-word hard cap on the query letter body
 * - Warning at 425 words
 * - Comparables sentence and "What Makes This Novel Unique" must appear inside the letter
 * - Author Bio paragraph drawn only from author-supplied inputs
 */

import Link from "next/link";
import { useCallback, useState } from "react";

const T = {
  bg: "#0F0D0A", panel: "#1A1612", border: "#2A2420",
  gold: "#A98E4A", cream: "#F2EFEA", cream2: "#C8BFB0",
  dim: "#7B7060", oxblood: "#7A1E1E", ink: "#0E0E0E",
  serif: "'Playfair Display', 'Georgia', serif",
  mono: "'Inter', 'Courier New', monospace",
};

const WORD_LIMIT = 450;
const WORD_WARN  = 425;

function countWords(text: string): number {
  return text.trim().split(/\s+/).filter(Boolean).length;
}

export default function QueryLetterPage() {
  const [body, setBody] = useState("");
  const [unique, setUnique] = useState("");
  const [approved, setApproved] = useState(false);

  const wordCount = countWords(body);
  const overLimit = wordCount > WORD_LIMIT;
  const nearLimit = wordCount >= WORD_WARN && !overLimit;

  const handleBodyChange = useCallback((e: React.ChangeEvent<HTMLTextAreaElement>) => {
    const val = e.target.value;
    const wc  = countWords(val);
    if (wc <= WORD_LIMIT + 20) setBody(val); // soft buffer for typing — gate on submit
    setApproved(false);
  }, []);

  const wordCountColor = overLimit ? T.oxblood : nearLimit ? T.gold : T.dim;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.cream, fontFamily: T.mono }}>
      <div style={{ maxWidth: "860px", margin: "0 auto", padding: "3rem 2rem 6rem" }}>

        {/* Breadcrumb */}
        <p style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", marginBottom: "1.5rem" }}>
          <Link href="/agent-readiness" style={{ color: T.gold, textDecoration: "none" }}>Agent Readiness Package™</Link>
          {" "}/{"  "}Query / Cover Letter
        </p>

        <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          01 — Query / Cover Letter
        </p>
        <h1 style={{ fontFamily: T.serif, fontSize: "1.75rem", color: T.cream, marginBottom: "0.75rem" }}>
          Query / Cover Letter
        </h1>
        <p style={{ fontSize: "0.8125rem", color: T.cream2, lineHeight: 1.65, marginBottom: "2rem", maxWidth: "560px" }}>
          The agent-facing submission letter. Must include: hook, manuscript metadata (title · genre · word count), comparables sentence, what makes it unique, short bio, and professional closing. Hard cap: 450 words.
        </p>

        {/* What Makes This Novel Unique — standalone field */}
        <div style={{ marginBottom: "1.75rem" }}>
          <label style={{ display: "block", fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
            What Makes This Novel Unique <span style={{ color: T.cream2 }}>(standalone section — also appears inside the letter)</span>
          </label>
          <textarea
            value={unique}
            onChange={(e) => setUnique(e.target.value)}
            rows={4}
            placeholder="Describe the specific hook, premise, voice, or structural element that sets this manuscript apart..."
            style={{
              width: "100%", fontFamily: T.mono, fontSize: "0.8125rem", color: T.cream,
              backgroundColor: T.panel, border: `1px solid ${T.border}`,
              padding: "0.875rem", resize: "vertical", outline: "none", lineHeight: 1.65,
              boxSizing: "border-box",
            }}
          />
        </div>

        {/* Query letter body */}
        <div style={{ marginBottom: "1rem" }}>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "baseline", marginBottom: "0.5rem" }}>
            <label style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase" }}>
              Query Letter Body
            </label>
            <span style={{ fontFamily: T.mono, fontSize: "0.6875rem", color: wordCountColor, fontWeight: overLimit ? 700 : 400 }}>
              {overLimit && "OVER LIMIT — "}
              {nearLimit && "NEAR LIMIT — "}
              Query Letter: {wordCount} / {WORD_LIMIT} words
            </span>
          </div>
          <textarea
            value={body}
            onChange={handleBodyChange}
            rows={20}
            placeholder={`Dear [Agent Name],\n\n[Hook paragraph — the story pitch.]\n\n[Title], [Genre], [Word Count], [Audience]. [TITLE] will appeal to readers of [Comp 1] and [Comp 2], combining [shared appeal] with [unique differentiator].\n\n[What makes it unique — one or two compact sentences.]\n\n[Author bio paragraph — pulled only from author-supplied resume/bio facts.]\n\nThank you for your time and consideration.\n\n[Your Name]`}
            style={{
              width: "100%", fontFamily: T.mono, fontSize: "0.8125rem", color: T.cream,
              backgroundColor: T.panel,
              border: `1px solid ${overLimit ? T.oxblood : nearLimit ? T.gold : T.border}`,
              padding: "1rem", resize: "vertical", outline: "none", lineHeight: 1.75,
              boxSizing: "border-box",
            }}
          />
          {overLimit && (
            <p style={{ fontSize: "0.6875rem", color: T.oxblood, marginTop: "0.375rem", lineHeight: 1.5 }}>
              Query letter exceeds the 450-word limit. Trim before approving. Export is blocked until the limit is met.
            </p>
          )}
          {nearLimit && (
            <p style={{ fontSize: "0.6875rem", color: T.gold, marginTop: "0.375rem" }}>
              Approaching limit — {WORD_LIMIT - wordCount} words remaining.
            </p>
          )}
        </div>

        {/* Action row */}
        <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap", marginBottom: "2rem" }}>
          <button style={{
            fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: T.gold, color: T.ink, border: "none",
            padding: "0.625rem 1.25rem", cursor: "pointer",
          }}>
            Generate
          </button>
          <button style={{
            fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: "transparent", color: T.cream2,
            border: `1px solid ${T.border}`, padding: "0.625rem 1.25rem", cursor: "pointer",
          }}>
            Regenerate
          </button>
          <button style={{
            fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: "transparent", color: T.cream2,
            border: `1px solid ${T.border}`, padding: "0.625rem 1.25rem", cursor: "pointer",
          }}>
            Improve
          </button>
          <button style={{
            fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: "transparent", color: T.cream2,
            border: `1px solid ${T.border}`, padding: "0.625rem 1.25rem", cursor: "pointer",
          }}>
            Copy
          </button>
          <button style={{
            fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: "transparent", color: T.dim,
            border: `1px solid ${T.border}`, padding: "0.625rem 1.25rem", cursor: "pointer",
          }}>
            Restore Version
          </button>
          <button
            onClick={() => !overLimit && setApproved(true)}
            disabled={overLimit || body.trim().length < 50}
            style={{
              fontFamily: T.mono, fontSize: "0.6875rem", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              backgroundColor: approved ? "#5A8A5A" : "transparent",
              color: approved ? "#F2EFEA" : "#5A8A5A",
              border: `1px solid ${overLimit ? T.border : "#5A8A5A"}`,
              padding: "0.625rem 1.25rem",
              cursor: overLimit || body.trim().length < 50 ? "not-allowed" : "pointer",
              opacity: overLimit || body.trim().length < 50 ? 0.4 : 1,
            }}
          >
            {approved ? "✓ Approved" : "Lock / Approve"}
          </button>
        </div>

        {approved && (
          <div style={{
            border: `1px solid #5A8A5A40`, padding: "0.75rem 1.25rem",
            backgroundColor: "rgba(90,138,90,0.06)", fontSize: "0.75rem", color: "#5A8A5A",
          }}>
            Query Letter approved and locked. Return to the package to approve remaining sections.
          </div>
        )}

        <div style={{ marginTop: "1.5rem" }}>
          <Link href="/agent-readiness" style={{
            fontFamily: T.mono, fontSize: "0.5625rem", color: T.dim,
            letterSpacing: "0.1em", textDecoration: "none",
          }}>
            ← Back to Package Overview
          </Link>
        </div>
      </div>
    </div>
  );
}
