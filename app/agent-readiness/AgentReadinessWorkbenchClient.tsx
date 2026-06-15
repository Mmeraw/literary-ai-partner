"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { formatScoreForDisplay } from "@/lib/ui/score-formatting";

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

type ApiSection = "query_letter" | "what_makes_unique" | "synopsis" | "query_pitch" | "comparables" | "author_bio";
type UiSection = ApiSection | "synopsis_short" | "synopsis_medium" | "synopsis_long";
type SynopsisVariant = "short" | "medium" | "long";

type SectionState = {
  status: "empty" | "draft" | "approved";
  content: string;
  wordCount?: number;
  error?: string;
};

const COLORS = {
  bg: "#0F0D0A",
  panel: "#1A1612",
  border: "#2A2420",
  gold: "#A98E4A",
  cream: "#F2EFEA",
  cream2: "#C8BFB0",
  dim: "#7B7060",
  green: "#5A8A5A",
  red: "#9F3A38",
  ink: "#0E0E0E",
};

const REQUIRED_PACKAGE_SECTIONS: Array<{ id: ApiSection; label: string; source: string }> = [
  { id: "query_pitch", label: "Query Pitch", source: "manuscript premise, conflict, stakes, genre" },
  { id: "what_makes_unique", label: "What Makes This Novel Unique", source: "manuscript text, story ledger, evaluation summary" },
  { id: "synopsis", label: "Approved Synopsis", source: "manuscript plot, story ledger, ending/resolution facts" },
  { id: "comparables", label: "Comparable Titles", source: "genre, audience, market-positioning signals" },
  { id: "query_letter", label: "Query Letter", source: "story facts plus approved/supporting package sections" },
  { id: "author_bio", label: "Author Bio", source: "author-supplied bio/resume/CV only" },
];

const SYNOPSIS_VARIANTS: Array<{ id: UiSection; variant: SynopsisVariant; label: string; range: string }> = [
  { id: "synopsis_short", variant: "short", label: "Short Synopsis", range: "100–150 words" },
  { id: "synopsis_medium", variant: "medium", label: "Medium Synopsis", range: "250–500 words" },
  { id: "synopsis_long", variant: "long", label: "Long Synopsis", range: "700–1,000 words" },
];

function keyForManuscript(m: AgentReadinessManuscriptOption): string {
  return `${m.manuscriptId}:${m.evaluationJobId}`;
}

function apiSectionFor(ui: UiSection): ApiSection {
  if (ui === "synopsis_short" || ui === "synopsis_medium" || ui === "synopsis_long") return "synopsis";
  return ui;
}

function synopsisVariantFor(ui: UiSection): SynopsisVariant | undefined {
  if (ui === "synopsis_short") return "short";
  if (ui === "synopsis_medium") return "medium";
  if (ui === "synopsis_long") return "long";
  return undefined;
}

function initialStates(): Record<UiSection, SectionState> {
  return {
    query_letter: { status: "empty", content: "" },
    what_makes_unique: { status: "empty", content: "" },
    synopsis: { status: "empty", content: "" },
    synopsis_short: { status: "empty", content: "" },
    synopsis_medium: { status: "empty", content: "" },
    synopsis_long: { status: "empty", content: "" },
    query_pitch: { status: "empty", content: "" },
    comparables: { status: "empty", content: "" },
    author_bio: { status: "empty", content: "" },
  };
}

export default function AgentReadinessWorkbenchClient({
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
    return explicit ? keyForManuscript(explicit) : manuscripts[0] ? keyForManuscript(manuscripts[0]) : "";
  }, [manuscripts, requestedEvaluationJobId, requestedManuscriptId]);

  const [selectedKey, setSelectedKey] = useState(initialSelectedKey);
  const [states, setStates] = useState<Record<UiSection, SectionState>>(initialStates);
  const [authorBioInput, setAuthorBioInput] = useState("");
  const [busySection, setBusySection] = useState<UiSection | "all" | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const selected = manuscripts.find((m) => keyForManuscript(m) === selectedKey) ?? null;
  const approvedRequiredCount = REQUIRED_PACKAGE_SECTIONS.filter((s) => states[s.id].status === "approved").length;
  const allRequiredApproved = approvedRequiredCount === REQUIRED_PACKAGE_SECTIONS.length;

  async function generate(uiSection: UiSection) {
    if (!selected) return;
    const apiSection = apiSectionFor(uiSection);
    if (apiSection === "author_bio" && authorBioInput.trim().length < 50) {
      setStates((current) => ({
        ...current,
        author_bio: {
          ...current.author_bio,
          error: "Paste at least 50 characters of author-supplied bio/resume/CV material before generating the biography.",
        },
      }));
      return;
    }

    setBusySection(uiSection);
    setMessage(null);
    setStates((current) => ({ ...current, [uiSection]: { ...current[uiSection], error: undefined } }));

    try {
      const response = await fetch("/api/agent-readiness/generate", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manuscriptId: Number(selected.manuscriptId),
          evaluationJobId: selected.evaluationJobId,
          section: apiSection,
          synopsisVariant: synopsisVariantFor(uiSection),
          mode: states[uiSection].status === "empty" ? "generate" : "regenerate",
          authorBioInput: authorBioInput.trim() || undefined,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStates((current) => ({ ...current, [uiSection]: { ...current[uiSection], error: data.error || `Generation failed (${response.status})` } }));
        return;
      }

      setStates((current) => ({
        ...current,
        [uiSection]: { status: "draft", content: data.content, wordCount: data.wordCount },
        ...(apiSection === "synopsis" ? { synopsis: { status: "draft" as const, content: data.content, wordCount: data.wordCount } } : {}),
      }));
    } catch (err) {
      setStates((current) => ({ ...current, [uiSection]: { ...current[uiSection], error: err instanceof Error ? err.message : "Network error" } }));
    } finally {
      setBusySection(null);
    }
  }

  async function generateAll() {
    if (!selected) return;
    setBusySection("all");
    setMessage("Generating manuscript-grounded sections…");
    for (const uiSection of ["query_pitch", "what_makes_unique", "synopsis_medium", "comparables", "query_letter"] as UiSection[]) {
      await generate(uiSection);
    }
    if (authorBioInput.trim().length >= 50) await generate("author_bio");
    setBusySection(null);
    setMessage(authorBioInput.trim().length >= 50 ? "Generated package sections including author bio." : "Generated manuscript sections. Author Bio still requires pasted author materials.");
  }

  async function approve(uiSection: UiSection) {
    if (!selected) return;
    const apiSection = apiSectionFor(uiSection);
    setBusySection(uiSection);
    try {
      const response = await fetch("/api/agent-readiness/sections/approve", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          manuscriptId: Number(selected.manuscriptId),
          evaluationJobId: selected.evaluationJobId,
          sectionType: apiSection,
        }),
      });
      const data = await response.json();
      if (!response.ok) {
        setStates((current) => ({ ...current, [uiSection]: { ...current[uiSection], error: data.error || "Approval failed" } }));
        return;
      }
      setStates((current) => ({
        ...current,
        [uiSection]: { ...current[uiSection], status: "approved" },
        ...(apiSection === "synopsis" ? { synopsis: { ...current.synopsis, status: "approved" as const } } : {}),
      }));
    } finally {
      setBusySection(null);
    }
  }

  async function download(format: "txt" | "docx") {
    if (!selected) return;
    const response = await fetch("/api/agent-readiness/download", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        manuscriptId: Number(selected.manuscriptId),
        evaluationJobId: selected.evaluationJobId,
        manuscriptTitle: selected.title,
        format,
      }),
    });
    if (!response.ok) {
      const err = await response.json();
      setMessage(err.error || "Download failed");
      return;
    }
    const blob = await response.blob();
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = `${selected.title.replace(/[^a-zA-Z0-9\s]/g, "").replace(/\s+/g, "-")}-Submission-Package.${format === "docx" ? "doc" : "txt"}`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
  }

  return (
    <div style={{ minHeight: "100vh", background: COLORS.bg, color: COLORS.cream, padding: "3rem 1.5rem 5rem" }}>
      <div style={{ maxWidth: 1120, margin: "0 auto" }}>
        <p style={{ color: COLORS.gold, textTransform: "uppercase", letterSpacing: "0.14em", fontSize: 12 }}>Agent Readiness Package</p>
        <h1 style={{ fontSize: 36, lineHeight: 1.1, margin: "0.5rem 0 1rem" }}>Build a Professional Submission Package</h1>
        <p style={{ color: COLORS.cream2, maxWidth: 760, lineHeight: 1.6 }}>
          Query letter, pitch, unique differentiator, comparables, short/medium/long synopsis drafts, and an author biography that only uses author-supplied materials.
        </p>

        {loadError && <p style={{ color: COLORS.red }}>{loadError}</p>}

        <section style={{ border: `1px solid ${COLORS.border}`, background: COLORS.panel, padding: 20, marginTop: 28 }}>
          <label style={{ display: "block", color: COLORS.gold, fontSize: 12, textTransform: "uppercase", letterSpacing: "0.12em", marginBottom: 8 }}>Completed manuscript</label>
          <select value={selectedKey} onChange={(e) => setSelectedKey(e.target.value)} style={{ width: "100%", maxWidth: 640, padding: 12, background: COLORS.bg, color: COLORS.cream, border: `1px solid ${COLORS.border}` }}>
            {manuscripts.map((m) => <option key={keyForManuscript(m)} value={keyForManuscript(m)}>{m.title}</option>)}
          </select>
          {selected && (
            <p style={{ color: COLORS.dim, marginTop: 10 }}>
              Readiness: {formatScoreForDisplay(selected.readinessScore)} / 10 · Package: {selected.packageStatus} · <Link href={selected.reportHref} style={{ color: COLORS.gold }}>View report</Link>
            </p>
          )}
        </section>

        <section style={{ border: `1px solid ${COLORS.gold}66`, background: "rgba(169,142,74,0.06)", padding: 20, marginTop: 20 }}>
          <h2 style={{ margin: "0 0 0.5rem" }}>Author Bio Materials</h2>
          <p style={{ color: COLORS.cream2, lineHeight: 1.55 }}>
            Paste the author's resume, CV, website bio, or background notes here. The biography generator and query letter may use these facts, but no credentials are invented.
          </p>
          <textarea
            value={authorBioInput}
            onChange={(e) => setAuthorBioInput(e.target.value)}
            placeholder="Paste author-supplied biography, resume, CV, publication credits, credentials, or relevant lived experience…"
            rows={7}
            style={{ width: "100%", marginTop: 12, padding: 12, background: COLORS.bg, color: COLORS.cream, border: `1px solid ${COLORS.border}`, lineHeight: 1.5 }}
          />
          <p style={{ color: authorBioInput.trim().length >= 50 ? COLORS.green : COLORS.dim, fontSize: 13 }}>
            {authorBioInput.trim().length >= 50 ? "Bio material ready." : "At least 50 characters required before biography generation."}
          </p>
        </section>

        <section style={{ display: "flex", gap: 12, flexWrap: "wrap", marginTop: 20 }}>
          <button disabled={!selected || busySection !== null} onClick={generateAll} style={buttonStyle(Boolean(selected) && busySection === null, true)}>
            {busySection === "all" ? "Generating…" : "Generate All Core Sections"}
          </button>
          <button disabled={!allRequiredApproved} onClick={() => download("txt")} style={buttonStyle(allRequiredApproved, true)}>Download TXT</button>
          <button disabled={!allRequiredApproved} onClick={() => download("docx")} style={buttonStyle(allRequiredApproved, false)}>Download Word</button>
        </section>
        {message && <p style={{ color: COLORS.gold }}>{message}</p>}

        <section style={{ marginTop: 28 }}>
          <h2>Synopsis Lengths</h2>
          <div style={{ display: "grid", gap: 12 }}>
            {SYNOPSIS_VARIANTS.map((item) => (
              <SectionPanel
                key={item.id}
                title={`${item.label} (${item.range})`}
                source="Grounded in manuscript plot, accepted story facts, and ending/resolution data when available."
                state={states[item.id]}
                busy={busySection === item.id}
                onGenerate={() => generate(item.id)}
                onApprove={() => approve(item.id)}
              />
            ))}
          </div>
        </section>

        <section style={{ marginTop: 28 }}>
          <h2>Package Sections</h2>
          <p style={{ color: COLORS.dim }}>Approved package sections: {approvedRequiredCount} / {REQUIRED_PACKAGE_SECTIONS.length}</p>
          <div style={{ display: "grid", gap: 12 }}>
            {REQUIRED_PACKAGE_SECTIONS.map((section) => (
              <SectionPanel
                key={section.id}
                title={section.label}
                source={section.source}
                state={states[section.id]}
                busy={busySection === section.id}
                onGenerate={() => generate(section.id)}
                onApprove={() => approve(section.id)}
              />
            ))}
          </div>
        </section>
      </div>
    </div>
  );
}

function buttonStyle(enabled: boolean, filled: boolean): React.CSSProperties {
  return {
    padding: "0.75rem 1rem",
    border: filled && enabled ? "none" : `1px solid ${enabled ? COLORS.gold : COLORS.border}`,
    background: filled && enabled ? COLORS.gold : "transparent",
    color: filled && enabled ? COLORS.ink : enabled ? COLORS.gold : COLORS.dim,
    cursor: enabled ? "pointer" : "not-allowed",
    fontWeight: 800,
    textTransform: "uppercase",
    letterSpacing: "0.08em",
  };
}

function SectionPanel({
  title,
  source,
  state,
  busy,
  onGenerate,
  onApprove,
}: {
  title: string;
  source: string;
  state: SectionState;
  busy: boolean;
  onGenerate: () => void;
  onApprove: () => void;
}) {
  const canApprove = state.status === "draft" && state.content.trim().length > 0;
  return (
    <article style={{ border: `1px solid ${state.status === "approved" ? COLORS.green : COLORS.border}`, background: COLORS.panel, padding: 18 }}>
      <div style={{ display: "flex", justifyContent: "space-between", gap: 12, alignItems: "flex-start" }}>
        <div>
          <h3 style={{ margin: 0 }}>{title}</h3>
          <p style={{ color: COLORS.dim, margin: "0.35rem 0 0", lineHeight: 1.5 }}>Source basis: {source}</p>
        </div>
        <span style={{ color: state.status === "approved" ? COLORS.green : state.status === "draft" ? COLORS.gold : COLORS.dim, textTransform: "uppercase", fontSize: 12, letterSpacing: "0.1em" }}>{state.status}</span>
      </div>
      {state.error && <p style={{ color: COLORS.red }}>{state.error}</p>}
      {state.content && (
        <div style={{ whiteSpace: "pre-wrap", color: COLORS.cream2, borderTop: `1px solid ${COLORS.border}`, marginTop: 12, paddingTop: 12, lineHeight: 1.55 }}>
          {state.content}
          {state.wordCount && <p style={{ color: COLORS.dim, marginTop: 12 }}>{state.wordCount} words</p>}
        </div>
      )}
      <div style={{ display: "flex", gap: 10, marginTop: 14, flexWrap: "wrap" }}>
        <button disabled={busy} onClick={onGenerate} style={buttonStyle(!busy, true)}>{busy ? "Generating…" : state.status === "empty" ? "Generate" : "Regenerate"}</button>
        <button disabled={!canApprove || busy} onClick={onApprove} style={buttonStyle(canApprove && !busy, false)}>Approve</button>
      </div>
    </article>
  );
}
