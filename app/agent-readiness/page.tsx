"use client";

/**
 * Agent Readiness Package™ — Flagship page
 *
 * Generates the full professional manuscript submission package:
 *   1. Query Letter          (450-word hard cap)
 *   2. What Makes This Novel Unique
 *   3. Synopsis
 *   4. Query Pitch
 *   5. Comparables
 *   6. Author Bio            (author-supplied credentials only)
 *
 *   Deferred (Coming Next):
 *   7. Agent Targeting™
 */

import Link from "next/link";
import { useState } from "react";

// ── Types ────────────────────────────────────────────────────────────────────

type SectionId =
  | "query-letter"
  | "unique"
  | "synopsis"
  | "query-pitch"
  | "comparables"
  | "author-bio";

type SectionState = {
  status: "empty" | "draft" | "approved";
  content: string;
  wordCount?: number;
};

const REQUIRED_SECTIONS: { id: SectionId; label: string; href: string; description: string }[] = [
  {
    id: "query-letter",
    label: "Query Letter",
    href: "/agent-readiness/query-letter",
    description: "Hook · metadata · comparables sentence · unique differentiator · short bio · closing. 450-word hard cap.",
  },
  {
    id: "unique",
    label: "What Makes This Novel Unique",
    href: "/agent-readiness/query-letter",
    description: "A concise differentiator that can stand alone and also support the query letter.",
  },
  {
    id: "synopsis",
    label: "Synopsis",
    href: "/agent-readiness/synopsis",
    description: "Query synopsis (100–150 words), standard (250–500), or extended (700–1,000). Ending revealed.",
  },
  {
    id: "query-pitch",
    label: "Query Pitch",
    href: "/agent-readiness/pitch",
    description: "One-sentence manuscript hook or positioning line for query forms and package summaries.",
  },
  {
    id: "comparables",
    label: "Comparables",
    href: "/agent-readiness/comparables",
    description: "2–4 comps with rationale. Also integrated into the query letter where useful.",
  },
  {
    id: "author-bio",
    label: "Author Bio",
    href: "/agent-readiness/bio",
    description: "Third-person, professional. Requires author-supplied resume or bio text — no invented credentials.",
  },
];

// ── Shared style tokens ───────────────────────────────────────────────────────

const T = {
  bg:       "#0F0D0A",
  panel:    "#1A1612",
  border:   "#2A2420",
  gold:     "#A98E4A",
  cream:    "#F2EFEA",
  cream2:   "#C8BFB0",
  dim:      "#7B7060",
  oxblood:  "#7A1E1E",
  ink:      "#0E0E0E",
  serif:    "'Playfair Display', 'Georgia', serif",
  mono:     "'Inter', 'Courier New', monospace",
};

// ── Status badge ──────────────────────────────────────────────────────────────

function StatusBadge({ status }: { status: SectionState["status"] }) {
  const map = {
    empty:    { label: "Not Started", color: T.dim },
    draft:    { label: "Draft",       color: T.gold },
    approved: { label: "Approved",    color: "#5A8A5A" },
  } as const;
  const { label, color } = map[status];
  return (
    <span style={{
      fontFamily: T.mono, fontSize: "0.5625rem", letterSpacing: "0.12em",
      textTransform: "uppercase", color, border: `1px solid ${color}40`,
      padding: "0.2rem 0.5rem",
    }}>
      {label}
    </span>
  );
}

// ── Section card ──────────────────────────────────────────────────────────────

function SectionCard({
  section,
  index,
  state,
}: {
  section: typeof REQUIRED_SECTIONS[number];
  index: number;
  state: SectionState;
}) {
  return (
    <div style={{
      border: `1px solid ${state.status === "approved" ? "#5A8A5A40" : T.border}`,
      padding: "1.25rem 1.5rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.625rem",
      backgroundColor: state.status === "approved" ? "rgba(90,138,90,0.04)" : T.panel,
    }}>
      <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem" }}>
        <div style={{ display: "flex", alignItems: "center", gap: "0.75rem" }}>
          <span style={{
            fontFamily: T.mono, fontSize: "0.5625rem", color: T.dim,
            letterSpacing: "0.1em", width: "1.25rem", textAlign: "right", flexShrink: 0,
          }}>
            0{index + 1}
          </span>
          <h3 style={{ fontFamily: T.serif, fontSize: "0.9375rem", color: T.cream, lineHeight: 1.2 }}>
            {section.label}
          </h3>
        </div>
        <StatusBadge status={state.status} />
      </div>
      <p style={{ fontFamily: T.mono, fontSize: "0.6875rem", color: T.dim, lineHeight: 1.6, paddingLeft: "2rem" }}>
        {section.description}
      </p>
      <div style={{ paddingLeft: "2rem", display: "flex", gap: "0.625rem", flexWrap: "wrap" }}>
        <Link
          href={section.href}
          style={{
            fontFamily: T.mono, fontSize: "0.5625rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: T.gold, color: T.ink,
            border: "none", padding: "0.375rem 0.75rem", cursor: "pointer",
            textDecoration: "none", display: "inline-block",
          }}
        >
          {state.status === "empty" ? "Generate" : "Edit"}
        </Link>
        {state.status === "draft" && (
          <button style={{
            fontFamily: T.mono, fontSize: "0.5625rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: "transparent", color: "#5A8A5A",
            border: "1px solid #5A8A5A", padding: "0.375rem 0.75rem", cursor: "pointer",
          }}>
            Approve
          </button>
        )}
      </div>
    </div>
  );
}

// ── Main page ─────────────────────────────────────────────────────────────────

export default function AgentReadinessPage() {
  const [sectionStates] = useState<Record<SectionId, SectionState>>({
    "query-letter": { status: "empty", content: "" },
    "unique":       { status: "empty", content: "" },
    "synopsis":     { status: "empty", content: "" },
    "query-pitch":  { status: "empty", content: "" },
    "comparables":  { status: "empty", content: "" },
    "author-bio":   { status: "empty", content: "" },
  });

  const approvedCount = Object.values(sectionStates).filter(s => s.status === "approved").length;
  const allApproved   = approvedCount === REQUIRED_SECTIONS.length;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.cream, fontFamily: T.mono }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "3rem 2rem 6rem", display: "flex", gap: "2.5rem" }}>

        {/* ── Left sidebar ─────────────────────────────────────────────── */}
        <aside style={{ width: "220px", flexShrink: 0 }}>
          <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "1.25rem" }}>
            Package Sections
          </p>
          <nav style={{ display: "flex", flexDirection: "column", gap: "0.125rem" }}>
            {REQUIRED_SECTIONS.map((s) => {
              const state = sectionStates[s.id];
              return (
                <Link
                  key={s.id}
                  href={s.href}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.5rem 0.75rem",
                    fontFamily: T.mono, fontSize: "0.6875rem", color: state.status === "approved" ? "#5A8A5A" : T.cream2,
                    textDecoration: "none",
                    border: "1px solid transparent",
                  }}
                >
                  <span>{s.label}</span>
                  {state.status === "approved" && <span style={{ color: "#5A8A5A", fontSize: "0.625rem" }}>✓</span>}
                  {state.status === "draft"    && <span style={{ color: T.gold,    fontSize: "0.625rem" }}>●</span>}
                </Link>
              );
            })}

            {/* Divider */}
            <div style={{ height: "1px", backgroundColor: T.border, margin: "0.75rem 0" }} />

            {/* Deferred step */}
            <div style={{
              padding: "0.5rem 0.75rem",
              fontFamily: T.mono, fontSize: "0.6875rem", color: T.dim,
              borderLeft: `2px solid ${T.dim}40`,
            }}>
              <div>Agent Targeting&#8482;</div>
              <div style={{ fontSize: "0.5625rem", marginTop: "0.25rem", color: `${T.dim}90` }}>Coming Next</div>
            </div>

            <Link href="/agent-readiness/history" style={{
              padding: "0.5rem 0.75rem",
              fontFamily: T.mono, fontSize: "0.6875rem", color: T.dim,
              textDecoration: "none",
            }}>
              Package History / Export
            </Link>
            <Link href="/agent-readiness/faq" style={{
              padding: "0.5rem 0.75rem",
              fontFamily: T.mono, fontSize: "0.6875rem", color: T.dim,
              textDecoration: "none",
            }}>
              Agent Readiness FAQ
            </Link>
          </nav>

          {/* Approval progress */}
          <div style={{ marginTop: "2rem", border: `1px solid ${T.border}`, padding: "1rem" }}>
            <p style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.625rem" }}>
              Approval Progress
            </p>
            <div style={{ display: "flex", alignItems: "baseline", gap: "0.25rem", marginBottom: "0.625rem" }}>
              <span style={{ fontFamily: T.serif, fontSize: "1.5rem", color: allApproved ? "#5A8A5A" : T.cream }}>
                {approvedCount}
              </span>
              <span style={{ fontSize: "0.75rem", color: T.dim }}>/ {REQUIRED_SECTIONS.length}</span>
            </div>
            <div style={{ height: "3px", backgroundColor: T.border, borderRadius: "2px", overflow: "hidden" }}>
              <div style={{
                height: "100%",
                width: `${(approvedCount / REQUIRED_SECTIONS.length) * 100}%`,
                backgroundColor: allApproved ? "#5A8A5A" : T.gold,
                transition: "width 0.3s ease",
              }} />
            </div>
          </div>
        </aside>

        {/* ── Main content ─────────────────────────────────────────────── */}
        <div style={{ flex: 1, minWidth: 0 }}>

          {/* Header */}
          <div style={{ marginBottom: "2.5rem" }}>
            <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
              Agent Readiness Package™
            </p>
            <h1 style={{ fontFamily: T.serif, fontSize: "2rem", color: T.cream, lineHeight: 1.1, marginBottom: "0.875rem" }}>
              Build a Professional Manuscript Submission Package
            </h1>
            <p style={{ fontSize: "0.875rem", color: T.cream2, lineHeight: 1.65, maxWidth: "640px" }}>
              One manuscript. One professional submission package. Generate your query letter, query pitch, synopsis, comparables, manuscript positioning, and author bio — then approve each section before export.
            </p>
          </div>

          {/* Manuscript eligibility notice */}
          <div style={{
            border: `1px solid ${T.gold}40`, padding: "0.875rem 1.25rem",
            marginBottom: "2rem", display: "flex", gap: "1rem", alignItems: "flex-start",
          }}>
            <span style={{ color: T.gold, fontSize: "0.75rem", flexShrink: 0 }}>ⓘ</span>
            <div>
              <p style={{ fontSize: "0.75rem", color: T.cream2, lineHeight: 1.6 }}>
                <strong style={{ color: T.cream }}>Eligibility:</strong> Agent Readiness is for manuscript submission materials. Excerpts or chapters are better handled through evaluation first. Storygate Studio™ submission requires a readiness score of 8.0 or above and an approved manuscript package.
              </p>
            </div>
          </div>

          {/* Generate all CTA */}
          <div style={{ marginBottom: "2.5rem", display: "flex", gap: "0.875rem", flexWrap: "wrap", alignItems: "center" }}>
            <button style={{
              fontFamily: T.mono, fontSize: "0.75rem", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              backgroundColor: T.gold, color: T.ink,
              border: "none", padding: "0.875rem 1.75rem", cursor: "pointer",
            }}>
              Generate Complete Package
            </button>
            <p style={{ fontSize: "0.6875rem", color: T.dim, lineHeight: 1.5 }}>
              Generates all six required sections from your manuscript and author-supplied bio inputs.
            </p>
          </div>

          {/* Section cards */}
          <div style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2.5rem" }}>
            {REQUIRED_SECTIONS.map((section, i) => (
              <SectionCard key={section.id} section={section} index={i} state={sectionStates[section.id]} />
            ))}
          </div>

          {/* Agent Targeting teaser */}
          <div style={{
            border: `1px solid ${T.border}`, padding: "1.25rem 1.5rem",
            display: "flex", justifyContent: "space-between", alignItems: "center", gap: "1rem",
            opacity: 0.6,
          }}>
            <div>
              <p style={{ fontFamily: T.serif, fontSize: "0.9375rem", color: T.cream2, marginBottom: "0.25rem" }}>
                Agent Targeting™ — Coming Next
              </p>
              <p style={{ fontSize: "0.6875rem", color: T.dim, lineHeight: 1.5 }}>
                Identify target agents, generate agent-specific query variants, and build your outreach plan after the core package is approved.
              </p>
            </div>
            <span style={{
              fontFamily: T.mono, fontSize: "0.5625rem", letterSpacing: "0.12em",
              textTransform: "uppercase", color: T.dim, border: `1px solid ${T.border}`,
              padding: "0.25rem 0.625rem", flexShrink: 0,
            }}>
              Locked
            </span>
          </div>

          {/* Export section */}
          <div style={{ marginTop: "2.5rem", borderTop: `1px solid ${T.border}`, paddingTop: "2rem" }}>
            <p style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "1rem" }}>
              Export
            </p>
            <p style={{ fontSize: "0.75rem", color: T.dim, lineHeight: 1.6, marginBottom: "1.25rem" }}>
              Export is locked until all six required sections are approved by the author.
              {approvedCount > 0 && approvedCount < REQUIRED_SECTIONS.length && (
                <> {REQUIRED_SECTIONS.length - approvedCount} section{REQUIRED_SECTIONS.length - approvedCount > 1 ? "s" : ""} remaining.</>
              )}
            </p>
            <div style={{ display: "flex", gap: "0.75rem", flexWrap: "wrap" }}>
              {[
                { label: "Download Editable DOCX", available: allApproved },
                { label: "Download Professional PDF", available: false /* expose once PDF formatting stable */ },
                { label: "Copy Query Package",     available: allApproved },
                { label: "Save Package Version",   available: approvedCount > 0 },
              ].map(({ label, available }) => (
                <button
                  key={label}
                  disabled={!available}
                  style={{
                    fontFamily: T.mono, fontSize: "0.5625rem", fontWeight: 700,
                    letterSpacing: "0.1em", textTransform: "uppercase",
                    backgroundColor: available ? T.gold : "transparent",
                    color: available ? T.ink : T.dim,
                    border: available ? "none" : `1px solid ${T.border}`,
                    padding: "0.5rem 1rem", cursor: available ? "pointer" : "not-allowed",
                    opacity: available ? 1 : 0.5,
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
            <p style={{ fontSize: "0.5625rem", color: T.dim, marginTop: "1rem", lineHeight: 1.6 }}>
              Note: "Submit to Storygate Studio™" appears as an export option once the manuscript holds a readiness score of 8.0 or above and all package sections are approved.
            </p>
          </div>

        </div>
      </div>
    </div>
  );
}
