"use client";

import Link from "next/link";
import { useMemo, useState } from "react";

export type AgentReadinessManuscriptOption = {
  manuscriptId: string;
  evaluationJobId: string;
  title: string;
  latestEvaluationStatus: "Complete";
  readinessScore: number | null;
  overallScore: number | null;
  packageStatus: "Not Started" | "Draft" | "Approved" | "Exported";
  reportHref: string;
  evaluatedAt: string;
};

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

function formatScore(value: number | null): string {
  return typeof value === "number" && Number.isFinite(value) ? value.toFixed(1) : "—";
}

function formatDate(value: string): string {
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "Latest completed evaluation";
  return date.toLocaleDateString("en-US", {
    month: "short",
    day: "numeric",
    year: "numeric",
  });
}

function manuscriptKey(m: AgentReadinessManuscriptOption): string {
  return `${m.manuscriptId}:${m.evaluationJobId}`;
}

function withSelectedManuscriptParams(
  href: string,
  manuscript: AgentReadinessManuscriptOption,
): string {
  const params = new URLSearchParams({
    manuscriptId: manuscript.manuscriptId,
    evaluationJobId: manuscript.evaluationJobId,
  });
  return `${href}?${params.toString()}`;
}

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

function SelectedManuscriptPanel({
  manuscripts,
  selectedKey,
  onSelect,
  loadError,
}: {
  manuscripts: AgentReadinessManuscriptOption[];
  selectedKey: string;
  onSelect: (value: string) => void;
  loadError: string | null;
}) {
  const selected = manuscripts.find((m) => manuscriptKey(m) === selectedKey) ?? null;

  if (loadError) {
    return (
      <div id="selected-manuscript" style={{ border: `1px solid ${T.oxblood}80`, padding: "1.25rem 1.5rem", marginBottom: "2.5rem", backgroundColor: "rgba(122,30,30,0.08)" }}>
        <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          Manuscript Selection
        </p>
        <h2 style={{ fontFamily: T.serif, fontSize: "1.25rem", color: T.cream, marginBottom: "0.625rem" }}>
          We couldn't load your completed manuscripts.
        </h2>
        <p style={{ fontSize: "0.75rem", color: T.cream2, lineHeight: 1.6 }}>
          Refresh this page or return to the dashboard. Package generation is locked until a completed manuscript can be selected.
        </p>
      </div>
    );
  }

  if (!selected) {
    return (
      <div id="selected-manuscript" style={{ border: `1px solid ${T.border}`, padding: "1.25rem 1.5rem", marginBottom: "2.5rem", backgroundColor: T.panel }}>
        <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
          Choose a Manuscript
        </p>
        <h2 style={{ fontFamily: T.serif, fontSize: "1.25rem", color: T.cream, marginBottom: "0.625rem" }}>
          Select a completed evaluation before building an Agent Readiness package.
        </h2>
        <p style={{ fontSize: "0.75rem", color: T.dim, lineHeight: 1.6, marginBottom: "1rem" }}>
          Failed, queued, running, canceled, or incomplete evaluations are not eligible for package generation.
        </p>
        <Link href="/dashboard" style={{
          fontFamily: T.mono, fontSize: "0.5625rem", fontWeight: 700,
          letterSpacing: "0.1em", textTransform: "uppercase",
          backgroundColor: T.gold, color: T.ink,
          border: "none", padding: "0.5rem 1rem", cursor: "pointer",
          textDecoration: "none", display: "inline-block",
        }}>
          Return to Dashboard
        </Link>
      </div>
    );
  }

  return (
    <div id="selected-manuscript" style={{
      border: `1px solid ${T.gold}40`, padding: "1.25rem 1.5rem",
      marginBottom: "2.5rem", backgroundColor: "rgba(169,142,74,0.05)",
    }}>
      <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.75rem" }}>
        Selected Manuscript
      </p>

      <label htmlFor="agent-readiness-manuscript" style={{
        display: "block", fontSize: "0.5625rem", color: T.dim,
        letterSpacing: "0.12em", textTransform: "uppercase", marginBottom: "0.5rem",
      }}>
        Manuscript
      </label>
      <select
        id="agent-readiness-manuscript"
        value={selectedKey}
        onChange={(event) => onSelect(event.target.value)}
        style={{
          width: "100%",
          maxWidth: "640px",
          backgroundColor: T.bg,
          color: T.cream,
          border: `1px solid ${T.border}`,
          padding: "0.75rem 0.875rem",
          fontFamily: T.serif,
          fontSize: "1.125rem",
          marginBottom: "1rem",
        }}
      >
        {manuscripts.map((m) => (
          <option key={manuscriptKey(m)} value={manuscriptKey(m)}>
            {m.title}
          </option>
        ))}
      </select>

      <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(150px, 1fr))", gap: "0.75rem", marginBottom: "1rem" }}>
        <div style={{ border: `1px solid ${T.border}`, padding: "0.75rem", backgroundColor: T.bg }}>
          <p style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.25rem" }}>Latest Evaluation</p>
          <strong style={{ fontFamily: T.serif, fontSize: "1rem", color: T.cream }}>Complete</strong>
          <p style={{ fontSize: "0.5625rem", color: T.dim, marginTop: "0.25rem" }}>{formatDate(selected.evaluatedAt)}</p>
        </div>
        <div style={{ border: `1px solid ${T.border}`, padding: "0.75rem", backgroundColor: T.bg }}>
          <p style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.25rem" }}>Readiness Score</p>
          <strong style={{ fontFamily: T.serif, fontSize: "1rem", color: T.cream }}>{formatScore(selected.readinessScore)} / 10</strong>
        </div>
        <div style={{ border: `1px solid ${T.border}`, padding: "0.75rem", backgroundColor: T.bg }}>
          <p style={{ fontSize: "0.5625rem", color: T.dim, letterSpacing: "0.1em", textTransform: "uppercase", marginBottom: "0.25rem" }}>Package Status</p>
          <strong style={{ fontFamily: T.serif, fontSize: "1rem", color: T.cream }}>{selected.packageStatus}</strong>
        </div>
      </div>

      <Link href={selected.reportHref} style={{
        fontFamily: T.mono, fontSize: "0.5625rem", fontWeight: 700,
        letterSpacing: "0.1em", textTransform: "uppercase",
        backgroundColor: "transparent", color: T.gold,
        border: `1px solid ${T.gold}`, padding: "0.5rem 1rem", cursor: "pointer",
        textDecoration: "none", display: "inline-block",
      }}>
        View Evaluation Report
      </Link>
    </div>
  );
}

function SectionCard({
  section,
  index,
  state,
  selectedManuscript,
}: {
  section: typeof REQUIRED_SECTIONS[number];
  index: number;
  state: SectionState;
  selectedManuscript: AgentReadinessManuscriptOption | null;
}) {
  const disabled = !selectedManuscript;
  const label = disabled ? "Choose Manuscript First" : state.status === "empty" ? "Generate" : "Edit";

  return (
    <div style={{
      border: `1px solid ${state.status === "approved" ? "#5A8A5A40" : T.border}`,
      padding: "1.25rem 1.5rem",
      display: "flex",
      flexDirection: "column",
      gap: "0.625rem",
      backgroundColor: state.status === "approved" ? "rgba(90,138,90,0.04)" : T.panel,
      opacity: disabled ? 0.64 : 1,
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
        {disabled ? (
          <button disabled style={{
            fontFamily: T.mono, fontSize: "0.5625rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: "transparent", color: T.dim,
            border: `1px solid ${T.border}`, padding: "0.375rem 0.75rem",
            cursor: "not-allowed", opacity: 0.7,
          }}>
            {label}
          </button>
        ) : (
          <Link
            href={withSelectedManuscriptParams(section.href, selectedManuscript)}
            style={{
              fontFamily: T.mono, fontSize: "0.5625rem", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              backgroundColor: T.gold, color: T.ink,
              border: "none", padding: "0.375rem 0.75rem", cursor: "pointer",
              textDecoration: "none", display: "inline-block",
            }}
          >
            {label}
          </Link>
        )}
        {state.status === "draft" && (
          <button disabled={disabled} style={{
            fontFamily: T.mono, fontSize: "0.5625rem", fontWeight: 700,
            letterSpacing: "0.1em", textTransform: "uppercase",
            backgroundColor: "transparent", color: disabled ? T.dim : "#5A8A5A",
            border: `1px solid ${disabled ? T.border : "#5A8A5A"}`, padding: "0.375rem 0.75rem",
            cursor: disabled ? "not-allowed" : "pointer",
          }}>
            Approve
          </button>
        )}
      </div>
    </div>
  );
}

export default function AgentReadinessClient({
  manuscripts,
  requestedManuscriptId,
  requestedEvaluationJobId,
  loadError,
}: {
  manuscripts: AgentReadinessManuscriptOption[];
  requestedManuscriptId: string | null;
  requestedEvaluationJobId: string | null;
  loadError: string | null;
}) {
  const initialSelectedKey = useMemo(() => {
    const explicit = manuscripts.find((m) => {
      if (requestedEvaluationJobId) return m.evaluationJobId === requestedEvaluationJobId;
      if (requestedManuscriptId) return m.manuscriptId === requestedManuscriptId;
      return false;
    });
    return explicit ? manuscriptKey(explicit) : manuscripts[0] ? manuscriptKey(manuscripts[0]) : "";
  }, [manuscripts, requestedEvaluationJobId, requestedManuscriptId]);

  const [selectedKey, setSelectedKey] = useState(initialSelectedKey);
  const [sectionStates] = useState<Record<SectionId, SectionState>>({
    "query-letter": { status: "empty", content: "" },
    "unique":       { status: "empty", content: "" },
    "synopsis":     { status: "empty", content: "" },
    "query-pitch":  { status: "empty", content: "" },
    "comparables":  { status: "empty", content: "" },
    "author-bio":   { status: "empty", content: "" },
  });

  const selectedManuscript = manuscripts.find((m) => manuscriptKey(m) === selectedKey) ?? null;
  const approvedCount = Object.values(sectionStates).filter(s => s.status === "approved").length;
  const allApproved   = approvedCount === REQUIRED_SECTIONS.length;
  const allSectionsStarted = Object.values(sectionStates).every((s) => s.status !== "empty");
  const canGenerateFinalPackage = Boolean(selectedManuscript) && allSectionsStarted;

  return (
    <div style={{ minHeight: "100vh", backgroundColor: T.bg, color: T.cream, fontFamily: T.mono }}>
      <div style={{ maxWidth: "1100px", margin: "0 auto", padding: "3rem 2rem 6rem", display: "flex", gap: "2.5rem" }}>
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
                  href={selectedManuscript ? withSelectedManuscriptParams(s.href, selectedManuscript) : "#selected-manuscript"}
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "space-between",
                    padding: "0.5rem 0.75rem",
                    fontFamily: T.mono, fontSize: "0.6875rem", color: state.status === "approved" ? "#5A8A5A" : T.cream2,
                    textDecoration: "none",
                    border: "1px solid transparent",
                    opacity: selectedManuscript ? 1 : 0.55,
                  }}
                >
                  <span>{s.label}</span>
                  {state.status === "approved" && <span style={{ color: "#5A8A5A", fontSize: "0.625rem" }}>✓</span>}
                  {state.status === "draft"    && <span style={{ color: T.gold,    fontSize: "0.625rem" }}>●</span>}
                </Link>
              );
            })}

            <div style={{ height: "1px", backgroundColor: T.border, margin: "0.75rem 0" }} />

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

        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ marginBottom: "2.5rem" }}>
            <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
              Agent Readiness Package™
            </p>
            <h1 style={{ fontFamily: T.serif, fontSize: "2rem", color: T.cream, lineHeight: 1.1, marginBottom: "0.875rem" }}>
              Build a Professional Manuscript Submission Package
            </h1>
            <p style={{ fontSize: "0.875rem", color: T.cream2, lineHeight: 1.65, maxWidth: "640px" }}>
              One manuscript. One professional submission package. Confirm the manuscript, generate each required section, approve the materials, and then compile the final package for export.
            </p>
          </div>

          <div style={{
            border: `1px solid ${T.gold}40`, padding: "0.875rem 1.25rem",
            marginBottom: "2rem", display: "flex", gap: "1rem", alignItems: "flex-start",
          }}>
            <span style={{ color: T.gold, fontSize: "0.75rem", flexShrink: 0 }}>ⓘ</span>
            <div>
              <p style={{ fontSize: "0.75rem", color: T.cream2, lineHeight: 1.6 }}>
                <strong style={{ color: T.cream }}>Eligibility:</strong> Agent Readiness is for completed manuscript evaluations. Storygate Studio™ submission requires a readiness score of 8.0 or above and an approved manuscript package.
              </p>
            </div>
          </div>

          <SelectedManuscriptPanel
            manuscripts={manuscripts}
            selectedKey={selectedKey}
            onSelect={setSelectedKey}
            loadError={loadError}
          />

          <div id="sections" style={{ display: "flex", flexDirection: "column", gap: "0.75rem", marginBottom: "2.5rem" }}>
            {REQUIRED_SECTIONS.map((section, i) => (
              <SectionCard key={section.id} section={section} index={i} state={sectionStates[section.id]} selectedManuscript={selectedManuscript} />
            ))}
          </div>

          <div style={{
            border: `1px solid ${canGenerateFinalPackage ? T.gold : T.border}`,
            padding: "1.25rem 1.5rem",
            marginBottom: "2.5rem",
            backgroundColor: canGenerateFinalPackage ? "rgba(169,142,74,0.06)" : T.panel,
          }}>
            <p style={{ fontSize: "0.5625rem", color: T.gold, letterSpacing: "0.14em", textTransform: "uppercase", marginBottom: "0.5rem" }}>
              Complete Package
            </p>
            <h2 style={{ fontFamily: T.serif, fontSize: "1.25rem", color: T.cream, marginBottom: "0.625rem" }}>
              Generate the final package after the sections above are complete.
            </h2>
            <p style={{ fontSize: "0.75rem", color: T.dim, lineHeight: 1.6, marginBottom: "1rem" }}>
              {canGenerateFinalPackage
                ? "All required sections have been started. You can now compile the manuscript-specific package."
                : selectedManuscript
                ? "Complete the required sections above before generating the final package."
                : "Choose a manuscript and complete the required sections above before generating the final package."}
            </p>
            <button disabled={!canGenerateFinalPackage} style={{
              fontFamily: T.mono, fontSize: "0.75rem", fontWeight: 700,
              letterSpacing: "0.1em", textTransform: "uppercase",
              backgroundColor: canGenerateFinalPackage ? T.gold : "transparent",
              color: canGenerateFinalPackage ? T.ink : T.dim,
              border: canGenerateFinalPackage ? "none" : `1px solid ${T.border}`,
              padding: "0.875rem 1.75rem",
              cursor: canGenerateFinalPackage ? "pointer" : "not-allowed",
              opacity: canGenerateFinalPackage ? 1 : 0.55,
            }}>
              Generate Final Package
            </button>
          </div>

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
                { label: "Download Professional PDF", available: false },
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
