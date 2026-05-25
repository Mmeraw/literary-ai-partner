"use client";

/**
 * StoryLedgerShell.tsx
 *
 * 4-module Story Ledger UI — client shell + all four module views.
 *
 * Module 1 — Story Layer Map:     Generated 8-layer story facts (pass1a_story_layer_v1)
 * Module 2 — Review Gate:         Author approval / rejection / edit requests
 * Module 3 — Accepted Ledger:     Frozen canon view (accepted_story_ledger_v1)
 * Module 4 — WAVE Handoff:        13-criteria diagnosis + WAVE Revision System™ bridge
 *
 * Palette (locked):
 *   Obsidian   #0E0E0E
 *   Bone White #F2EFEA
 *   Oxblood    #7A1E1E
 *   Ash Gray   #7B7B7B
 *   Tarnished Gold #A98E4A
 *
 * Premium design: editorial warmth, min 15px body, 1.75 line-height.
 * Target reader: adult literary author — not a tech dashboard.
 */

import React, { useState, useRef, useTransition } from "react";
import { StoryLayerRenderer, LayerCompletionBar } from "@/components/ledger/StoryLedgerLayers";

// ─── Web Speech API mic input ───────────────────────────────────────────────

type SpeechState = "idle" | "listening" | "error";

function useSpeechInput(onTranscript: (text: string) => void) {
  const [state, setState] = React.useState<SpeechState>("idle");
  const recognitionRef = React.useRef<any>(null);

  const supported =
    typeof window !== "undefined" &&
    ("SpeechRecognition" in window || "webkitSpeechRecognition" in window);

  const start = React.useCallback(() => {
    if (!supported) return;
    const SR =
      (window as any).SpeechRecognition ?? (window as any).webkitSpeechRecognition;
    const rec = new SR();
    rec.continuous = true;
    rec.interimResults = false;
    rec.lang = "en-US";
    rec.onresult = (e: any) => {
      const transcript = Array.from(e.results as ArrayLike<any>)
        .map((r: any) => r[0].transcript)
        .join(" ")
        .trim();
      if (transcript) onTranscript(transcript);
    };
    rec.onerror = () => setState("error");
    rec.onend = () => setState("idle");
    recognitionRef.current = rec;
    rec.start();
    setState("listening");
  }, [supported, onTranscript]);

  const stop = React.useCallback(() => {
    recognitionRef.current?.stop();
    setState("idle");
  }, []);

  const toggle = React.useCallback(() => {
    if (state === "listening") stop();
    else start();
  }, [state, start, stop]);

  return { state, toggle, supported };
}

function MicButton({
  setValue,
}: {
  setValue: React.Dispatch<React.SetStateAction<string>>;
}) {
  const { state, toggle, supported } = useSpeechInput((transcript) => {
    setValue((prev) => (prev ? prev + " " + transcript : transcript));
  });

  if (!supported) return null;

  const isListening = state === "listening";
  const isError = state === "error";

  return (
    <button
      type="button"
      onClick={toggle}
      title={isListening ? "Stop recording" : "Speak to fill this field"}
      style={{
        padding: "6px 12px",
        borderRadius: 8,
        border: `1px solid ${
          isListening
            ? "rgba(122,30,30,0.6)"
            : isError
            ? "rgba(230,162,60,0.4)"
            : "rgba(242,239,234,0.15)"
        }`,
        background: isListening ? "rgba(122,30,30,0.22)" : "transparent",
        color: isListening ? "#D07070" : isError ? "#E6A23C" : "rgba(242,239,234,0.5)",
        fontSize: 13,
        cursor: "pointer",
        display: "inline-flex",
        alignItems: "center",
        gap: 6,
        flexShrink: 0,
      }}
    >
      {isListening ? "⏹ Stop" : isError ? "⚠ Retry" : "🎙 Speak"}
    </button>
  );
}

// ─── Palette ────────────────────────────────────────────────────────────────

const P = {
  bg: "#0E0E0E",
  surface: "#111110",
  surfaceAlt: "#181714",
  surfaceHover: "#1E1D1A",
  border: "#272523",
  borderStrong: "#393734",
  bone: "#F2EFEA",
  boneAlt: "rgba(242,239,234,0.72)",
  boneFaint: "rgba(242,239,234,0.38)",
  boneMuted: "rgba(242,239,234,0.12)",
  gold: "#A98E4A",
  goldLight: "rgba(169,142,74,0.14)",
  goldBorder: "rgba(169,142,74,0.35)",
  oxblood: "#7A1E1E",
  oxbloodLight: "rgba(122,30,30,0.18)",
  oxbloodBorder: "rgba(122,30,30,0.40)",
  ash: "#7B7B7B",
  ashLight: "#9A9690",
  green: "#34A853",
  greenLight: "rgba(52,168,83,0.14)",
  amber: "#E6A23C",
  amberLight: "rgba(230,162,60,0.14)",
};

// ─── Typography scale ─────────────────────────────────────────────────────────
// Body minimum 15px / 1.75 line-height. Headers scale from 16→36px.

const T = {
  // Display
  display: { fontSize: 34, fontWeight: 700, letterSpacing: "-0.025em", color: P.bone, lineHeight: 1.15 },
  // Page heading
  h1: { fontSize: 28, fontWeight: 700, letterSpacing: "-0.02em", color: P.bone, lineHeight: 1.2 },
  // Section heading
  h2: { fontSize: 22, fontWeight: 700, letterSpacing: "-0.015em", color: P.bone, lineHeight: 1.3 },
  // Card heading
  h3: { fontSize: 18, fontWeight: 700, letterSpacing: "-0.01em", color: P.bone, lineHeight: 1.35 },
  // Body copy — minimum 15px
  body: { fontSize: 15, color: P.boneAlt, lineHeight: 1.75 },
  // Slightly larger body for main reading areas
  bodyLg: { fontSize: 16, color: P.boneAlt, lineHeight: 1.8 },
  // Captions / metadata
  caption: { fontSize: 12, color: P.ash, lineHeight: 1.5 },
  // Overline / section label
  overline: {
    fontSize: 10,
    fontWeight: 700,
    letterSpacing: "0.12em",
    textTransform: "uppercase" as const,
    color: P.ash,
    lineHeight: 1.4,
  },
  // Small label
  label: {
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.08em",
    textTransform: "uppercase" as const,
    color: P.ashLight,
    lineHeight: 1.4,
  },
};

// ─── Layer ordering (canonical) ──────────────────────────────────────────────

const LAYER_ORDER = [
  "canonical_identity_layer",
  "cast_role_tier_layer",
  "pov_structure_layer",
  "relationship_network_layer",
  "object_symbol_layer",
  "location_timeline_worldstate_layer",
  "threat_antagonist_ending_layer",
  "source_integrity_layer",
] as const;

const LAYER_LABELS: Record<string, string> = {
  canonical_identity_layer: "Canonical Identity",
  cast_role_tier_layer: "Cast / Role Tier",
  pov_structure_layer: "POV Structure",
  relationship_network_layer: "Relationship Network",
  object_symbol_layer: "Object / Symbol",
  location_timeline_worldstate_layer: "Timeline / Location",
  threat_antagonist_ending_layer: "Threat / Pressure / Ending",
  source_integrity_layer: "Source Integrity",
};

// Short nav descriptions shown under the layer name in the sidebar
const LAYER_NAV_DESC: Record<string, string> = {
  canonical_identity_layer: "Names & aliases",
  cast_role_tier_layer: "Character roles",
  pov_structure_layer: "Narrative perspective",
  relationship_network_layer: "Named bonds",
  object_symbol_layer: "Significant objects",
  location_timeline_worldstate_layer: "Places & timeline",
  threat_antagonist_ending_layer: "Pressure & endings",
  source_integrity_layer: "Manuscript health",
};

const LAYER_ICONS: Record<string, string> = {
  canonical_identity_layer: "🪪",
  cast_role_tier_layer: "🎭",
  pov_structure_layer: "👁",
  relationship_network_layer: "🔗",
  object_symbol_layer: "🗡",
  location_timeline_worldstate_layer: "🗺",
  threat_antagonist_ending_layer: "⚔️",
  source_integrity_layer: "🔒",
};

const LAYER_DEFINITIONS = [
  {
    key: "canonical_identity_layer",
    definition: "Who each major story element is in canon: names, aliases, species, age, defining traits, identity facts, and non-negotiable truths.",
  },
  {
    key: "cast_role_tier_layer",
    definition: "Who matters structurally: protagonist, antagonist, major secondary cast, minor but recurring figures, functional roles, and story importance.",
  },
  {
    key: "pov_structure_layer",
    definition: "Who sees what, when, and from what narrative distance: POV ownership, narrator logic, perspective shifts, voice boundaries, and access to knowledge.",
  },
  {
    key: "relationship_network_layer",
    definition: "How characters connect and change: family, friendship, rivalry, romance, betrayal, obligation, dependency, healing, mentorship, power imbalance.",
  },
  {
    key: "object_symbol_layer",
    definition: "Important recurring objects, symbols, motifs, tools, medicines, artifacts, weapons, documents, animals, and places-as-symbols.",
  },
  {
    key: "location_timeline_worldstate_layer",
    definition: "When and where things happen: chronology, age progression, city/country movement, chapter sequence, travel logic, seasonal jumps, location continuity.",
  },
  {
    key: "threat_antagonist_ending_layer",
    definition: "What forces the story forward: antagonistic pressure, danger, stakes, deadlines, escalation, reversals, climax logic, ending state, unresolved consequences.",
  },
  {
    key: "source_integrity_layer",
    definition: "The audit trail: what the system actually knows from the manuscript, what is inferred, what is uncertain, what needs author confirmation, and what must not be hallucinated.",
  },
] as const;

// ─── 13 Criteria ─────────────────────────────────────────────────────────────

const CRITERIA_13 = [
  { id: 1, label: "Concept & Core Premise", wave: "Concept" },
  { id: 2, label: "Narrative Drive & Momentum", wave: "Narrative Drive" },
  { id: 3, label: "Character Depth & Psychology", wave: "Character" },
  { id: 4, label: "POV & Voice Control", wave: "Voice" },
  { id: 5, label: "Scene Construction & Function", wave: "Scene Construction" },
  { id: 6, label: "Dialogue Authenticity & Subtext", wave: "Dialogue" },
  { id: 7, label: "Thematic Integration", wave: "Theme" },
  { id: 8, label: "World-Building & Environmental Logic", wave: "Worldbuilding" },
  { id: 9, label: "Pacing & Structural Balance", wave: "Pacing" },
  { id: 10, label: "Prose Control & Sentence Craft", wave: "Prose Control" },
  { id: 11, label: "Tonal Consistency", wave: "Tone" },
  { id: 12, label: "Narrative Closure", wave: "Narrative Closure" },
  { id: 13, label: "Marketability & Commercial Positioning", wave: "Marketability" },
];

// ─── Shared primitives ───────────────────────────────────────────────────────

function Pill({
  children,
  tone = "neutral",
  size = "sm",
}: {
  children: React.ReactNode;
  tone?: "neutral" | "gold" | "oxblood" | "green" | "amber";
  size?: "sm" | "xs";
}) {
  const base: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    borderRadius: 99,
    fontWeight: 600,
    letterSpacing: "0.04em",
    border: "1px solid",
    whiteSpace: "nowrap" as const,
    padding: size === "xs" ? "2px 9px" : "4px 12px",
    fontSize: size === "xs" ? 10 : 12,
  };
  const tones: Record<string, React.CSSProperties> = {
    neutral: { background: P.boneMuted, borderColor: P.border, color: P.boneAlt },
    gold: { background: P.goldLight, borderColor: P.goldBorder, color: P.gold },
    oxblood: { background: P.oxbloodLight, borderColor: P.oxbloodBorder, color: "#D07070" },
    green: { background: P.greenLight, borderColor: "rgba(52,168,83,0.35)", color: "#6ECA88" },
    amber: { background: P.amberLight, borderColor: "rgba(230,162,60,0.35)", color: P.amber },
  };
  return <span style={{ ...base, ...tones[tone] }}>{children}</span>;
}

// Editorial card — warmer than the old tech dashboard style
function Card({
  children,
  pad = true,
  style,
  accent,
}: {
  children: React.ReactNode;
  pad?: boolean;
  style?: React.CSSProperties;
  accent?: "gold" | "green" | "oxblood" | "amber";
}) {
  const accentBorder = accent
    ? {
        gold: `2px solid ${P.gold}`,
        green: "2px solid #34A853",
        oxblood: `2px solid ${P.oxblood}`,
        amber: `2px solid ${P.amber}`,
      }[accent]
    : undefined;

  return (
    <div
      style={{
        background: P.surface,
        border: `1px solid ${P.border}`,
        borderRadius: 18,
        ...(accentBorder ? { borderLeft: accentBorder } : {}),
        ...(pad ? { padding: "28px 32px" } : {}),
        ...style,
      }}
    >
      {children}
    </div>
  );
}

function SectionLabel({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "0 0 12px",
        ...T.overline,
      }}
    >
      {children}
    </p>
  );
}

function AlertBanner({
  tone,
  children,
}: {
  tone: "gold" | "oxblood" | "green";
  children: React.ReactNode;
}) {
  const map = {
    gold: { bg: P.goldLight, border: P.goldBorder, color: P.gold },
    oxblood: { bg: P.oxbloodLight, border: P.oxbloodBorder, color: "#D07070" },
    green: { bg: P.greenLight, border: "rgba(52,168,83,0.35)", color: "#6ECA88" },
  };
  const s = map[tone];
  return (
    <div
      style={{
        background: s.bg,
        border: `1px solid ${s.border}`,
        borderLeft: `3px solid ${s.color}`,
        borderRadius: "0 12px 12px 0",
        padding: "12px 18px",
        fontSize: 15,
        color: s.color,
        marginBottom: 18,
        lineHeight: 1.7,
      }}
    >
      {children}
    </div>
  );
}

// ─── Module types ────────────────────────────────────────────────────────────

type ModuleId = "story_layer" | "review_gate" | "accepted_ledger" | "wave_handoff";

const MODULES: { id: ModuleId; label: string; number: number; sublabel: string; icon: string }[] = [
  { id: "story_layer", number: 1, label: "Story Layer Map", sublabel: "Generated story facts", icon: "◈" },
  { id: "review_gate", number: 2, label: "Review Gate", sublabel: "Author approval", icon: "◎" },
  { id: "accepted_ledger", number: 3, label: "Accepted Ledger", sublabel: "Frozen canon", icon: "◆" },
  { id: "wave_handoff", number: 4, label: "WAVE Handoff", sublabel: "13 criteria + repair", icon: "◇" },
];

// ─── Props ───────────────────────────────────────────────────────────────────

export type LedgerShellProps = {
  jobId: string;
  manuscriptTitle: string;
  atReviewGate: boolean;
  approved: boolean;
  justApproved: boolean;
  justRejected: boolean;

  // Module 1 — story layer data
  storyLayers: Record<string, Record<string, unknown>> | null;
  layerCompletionSummary: {
    total_layers: number;
    populated_layers: number;
    empty_layers?: string[];
    degraded_layers?: string[];
  } | null;

  // Module 2 — gate state
  hardFails: string[];
  hasHardFails: boolean;

  // Module 3 — accepted ledger
  acceptedLedger: {
    approved_at?: string | null;
    approved_by_role?: string | null;
    approval_status?: string | null;
    governance_warnings?: GovernanceWarning[];
    layer_count?: number;
  } | null;

  // Server actions (passed from server component)
  approveLedgerAction: (formData: FormData) => Promise<void>;
  rejectLedgerAction: (formData: FormData) => Promise<void>;
};

type GovernanceWarning = {
  warning_id?: string;
  severity?: "info" | "soft_fail" | "hard_fail";
  affected_layer?: string;
  affected_character_or_object?: string | null;
  evidence_location?: string[];
  reason?: string;
  suggested_resolution?: string;
  blocking_status?: boolean;
};

// ─── Per-layer decision types ────────────────────────────────────────────────

type LayerDecisionStatus =
  | "undecided"
  | "approved"
  | "approved_with_comment"
  | "rejected"
  | "rejected_with_comment";

type LayerDecision = {
  status: LayerDecisionStatus;
  comment: string;
};

const DECISION_COLORS: Record<LayerDecisionStatus, string> = {
  undecided: P.ash,
  approved: P.green,
  approved_with_comment: P.green,
  rejected: "#D07070",
  rejected_with_comment: "#D07070",
};

const DECISION_LABELS: Record<LayerDecisionStatus, string> = {
  undecided: "—",
  approved: "✓ Looks right",
  approved_with_comment: "✓ Looks right — with note",
  rejected: "✗ This is wrong",
  rejected_with_comment: "✗ This is wrong — explain",
};

// ─── Module 1 — Story Layer Map ──────────────────────────────────────────────

function Module1StoryLayer({
  storyLayers,
  layerCompletionSummary,
  atReviewGate,
  onAllLayersDecided,
}: {
  storyLayers: Record<string, Record<string, unknown>> | null;
  layerCompletionSummary: LedgerShellProps["layerCompletionSummary"];
  atReviewGate: boolean;
  onAllLayersDecided: (decisions: Record<string, LayerDecision>) => void;
}) {
  const [activeLayer, setActiveLayer] = useState<string>(LAYER_ORDER[0]);
  const [decisions, setDecisions] = useState<Record<string, LayerDecision>>(
    () =>
      Object.fromEntries(
        LAYER_ORDER.map((k) => [k, { status: "undecided", comment: "" }])
      )
  );
  const [showCommentFor, setShowCommentFor] = useState<string | null>(null);
  const [pendingComment, setPendingComment] = useState("");
  const [allDecidedTriggered, setAllDecidedTriggered] = useState(false);
  const [layerRefOpen, setLayerRefOpen] = useState(true);

  const decidedCount = LAYER_ORDER.filter(
    (k) => decisions[k].status !== "undecided"
  ).length;
  const allDecided = decidedCount === LAYER_ORDER.length;

  React.useEffect(() => {
    if (allDecided && !allDecidedTriggered && atReviewGate) {
      setAllDecidedTriggered(true);
      onAllLayersDecided(decisions);
    }
  }, [allDecided, allDecidedTriggered, atReviewGate, decisions, onAllLayersDecided]);

  function setDecision(layerKey: string, status: LayerDecisionStatus, comment = "") {
    setDecisions((prev) => ({ ...prev, [layerKey]: { status, comment } }));
  }

  function handleDecisionButton(layerKey: string, status: LayerDecisionStatus) {
    const needsComment =
      status === "approved_with_comment" || status === "rejected_with_comment";
    if (needsComment) {
      setShowCommentFor(layerKey);
      setPendingComment(decisions[layerKey].comment ?? "");
    } else {
      setShowCommentFor(null);
      setDecision(layerKey, status);
      const currentIdx = LAYER_ORDER.indexOf(
        layerKey as typeof LAYER_ORDER[number]
      );
      const nextUndecided =
        LAYER_ORDER.find(
          (k, i) => i > currentIdx && decisions[k].status === "undecided"
        ) ??
        LAYER_ORDER.find(
          (k) => decisions[k].status === "undecided" && k !== layerKey
        );
      if (nextUndecided) setActiveLayer(nextUndecided);
    }
  }

  function confirmComment(layerKey: string, status: LayerDecisionStatus) {
    setDecision(layerKey, status, pendingComment);
    setShowCommentFor(null);
    setPendingComment("");
    const currentIdx = LAYER_ORDER.indexOf(
      layerKey as typeof LAYER_ORDER[number]
    );
    const nextUndecided =
      LAYER_ORDER.find(
        (k, i) => i > currentIdx && decisions[k].status === "undecided"
      ) ??
      LAYER_ORDER.find(
        (k) => decisions[k].status === "undecided" && k !== layerKey
      );
    if (nextUndecided) setActiveLayer(nextUndecided);
  }

  if (!storyLayers) {
    return (
      <Card>
        <SectionLabel>Module 1 · Generated</SectionLabel>
        <h2 style={{ margin: "0 0 12px", ...T.h2 }}>Story Layer Map</h2>
        <p style={{ margin: 0, ...T.body }}>
          The Story Layer has not been generated yet. It will appear here once
          analysis is complete.
        </p>
      </Card>
    );
  }

  const currentData = storyLayers[activeLayer] ?? null;
  const currentDecision = decisions[activeLayer];
  const populated = LAYER_ORDER.filter((k) => {
    const d = storyLayers[k];
    return d && Object.keys(d).length > 0;
  });

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Header card */}
      <Card accent="gold">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 20,
          }}
        >
          <div style={{ flex: 1 }}>
            <Pill tone="gold">Module 1 · Generated</Pill>
            <h2 style={{ margin: "14px 0 10px", ...T.h2 }}>Story Layer Map</h2>
            <p style={{ margin: 0, maxWidth: "62ch", ...T.bodyLg }}>
              This is not the score report. It is the narrative map — what
              RevisionGrade believes your manuscript contains before craft diagnosis
              begins. Review each layer and record your decision.
            </p>
          </div>
          <div
            style={{
              background: P.surfaceAlt,
              border: `1px solid ${P.border}`,
              borderRadius: 12,
              padding: "14px 18px",
              textAlign: "right",
              flexShrink: 0,
            }}
          >
            <SectionLabel>Artifacts</SectionLabel>
            <div
              style={{ fontFamily: "monospace", fontSize: 12, color: P.gold }}
            >
              pass1a_story_layer_v1
            </div>
            <div
              style={{ fontFamily: "monospace", fontSize: 12, color: P.gold }}
            >
              ledger_quality_report_v1
            </div>
          </div>
        </div>
      </Card>

      {/* Layer Reference — always shown, collapsible */}
      <div style={{ border: `1px solid ${P.border}`, borderRadius: 14, overflow: "hidden" }}>
        <button
          onClick={() => setLayerRefOpen(!layerRefOpen)}
          style={{
            width: "100%",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            padding: "16px 20px",
            background: P.surfaceAlt,
            border: "none",
            cursor: "pointer",
            textAlign: "left",
          }}
        >
          <span style={{ fontSize: 14, fontWeight: 700, color: P.gold, letterSpacing: "0.04em" }}>
            WHAT EACH LAYER CONTAINS
          </span>
          <span style={{ fontSize: 12, color: P.ash }}>
            {layerRefOpen ? "Hide" : "Show"}
          </span>
        </button>

        {layerRefOpen && (
          <div style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 1,
            background: P.border,
          }}>
            {LAYER_DEFINITIONS.map((def) => (
              <div key={def.key} style={{
                background: P.bg,
                padding: "16px 20px",
              }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 6 }}>
                  <span style={{ fontSize: 16 }}>{LAYER_ICONS[def.key]}</span>
                  <span style={{ fontSize: 13, fontWeight: 700, color: P.bone }}>
                    {LAYER_LABELS[def.key]}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 13, color: P.ash, lineHeight: 1.65 }}>
                  {def.definition}
                </p>
              </div>
            ))}
          </div>
        )}
      </div>

      {/* Instruction banner — only shown when at review gate */}
      {atReviewGate && (
        <div
          style={{
            background: "rgba(169,142,74,0.08)",
            border: `1px solid ${P.goldBorder}`,
            borderRadius: 14,
            padding: "20px 24px",
            display: "flex",
            gap: 16,
            alignItems: "flex-start",
          }}
        >
          <span style={{ fontSize: 22, flexShrink: 0, lineHeight: 1 }}>📋</span>
          <div style={{ flex: 1 }}>
            <p
              style={{
                margin: "0 0 8px",
                fontWeight: 700,
                fontSize: 16,
                color: P.gold,
                lineHeight: 1.3,
              }}
            >
              Review each layer before approving
            </p>
            <p style={{ margin: 0, ...T.body }}>
              RevisionGrade extracted these story facts from your manuscript. Work
              through each of the 8 layers and mark it as correct, correct with a
              note, wrong, or wrong with an explanation. When all layers are
              reviewed, you will be taken to the approval step automatically.
            </p>
            <div
              style={{
                marginTop: 14,
                display: "flex",
                alignItems: "center",
                gap: 12,
              }}
            >
              <div
                style={{
                  flex: 1,
                  height: 5,
                  background: P.border,
                  borderRadius: 99,
                }}
              >
                <div
                  style={{
                    width: `${(decidedCount / LAYER_ORDER.length) * 100}%`,
                    height: "100%",
                    background: P.gold,
                    borderRadius: 99,
                    transition: "width 0.3s",
                  }}
                />
              </div>
              <span
                style={{
                  fontSize: 13,
                  color: P.gold,
                  fontWeight: 700,
                  flexShrink: 0,
                }}
              >
                {decidedCount} / {LAYER_ORDER.length} reviewed
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Completion bar */}
      <LayerCompletionBar summary={layerCompletionSummary} />

      {/* Layer navigator + panel */}
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "240px 1fr",
          gap: 18,
          alignItems: "start",
        }}
      >
        {/* Sidebar nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: 3 }}>
          {LAYER_ORDER.map((key) => {
            const isActive = activeLayer === key;
            const isPopulated = populated.includes(key);
            const dec = decisions[key];
            const isDecided = dec.status !== "undecided";
            const isApproved =
              dec.status === "approved" || dec.status === "approved_with_comment";
            const dotColor = isDecided
              ? isApproved
                ? P.green
                : "#D07070"
              : isPopulated
                ? P.green
                : P.ash;
            return (
              <button
                key={key}
                onClick={() => setActiveLayer(key)}
                style={{
                  display: "flex",
                  alignItems: "flex-start",
                  gap: 12,
                  padding: "12px 16px",
                  borderRadius: 12,
                  border: isActive
                    ? `1px solid ${P.goldBorder}`
                    : `1px solid transparent`,
                  background: isActive ? P.goldLight : "transparent",
                  color: isActive ? P.gold : isPopulated ? P.boneAlt : P.ash,
                  cursor: "pointer",
                  textAlign: "left" as const,
                  width: "100%",
                }}
              >
                <span style={{ fontSize: 16, flexShrink: 0, marginTop: 1 }}>
                  {LAYER_ICONS[key]}
                </span>
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      fontSize: 13,
                      fontWeight: isActive ? 700 : 500,
                      lineHeight: 1.3,
                      color: isActive ? P.gold : isPopulated ? P.boneAlt : P.ash,
                    }}
                  >
                    {LAYER_LABELS[key]}
                  </div>
                  <div
                    style={{
                      fontSize: 11,
                      color: isActive ? "rgba(169,142,74,0.7)" : P.ash,
                      marginTop: 2,
                      lineHeight: 1.3,
                    }}
                  >
                    {LAYER_NAV_DESC[key]}
                  </div>
                </div>
                {/* Decision indicator */}
                <span
                  style={{
                    width: 8,
                    height: 8,
                    borderRadius: "50%",
                    background: dotColor,
                    flexShrink: 0,
                    marginTop: 5,
                    outline: isDecided ? `2px solid ${dotColor}40` : "none",
                  }}
                />
              </button>
            );
          })}
        </div>

        {/* Active layer panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          <StoryLayerRenderer layerKey={activeLayer} data={currentData} />

          {/* Per-layer decision bar — only shown at review gate */}
          {atReviewGate && (
            <Card style={{ borderRadius: 14 }}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 12,
                  marginBottom: 16,
                }}
              >
                <div>
                  <SectionLabel>
                    Your decision — {LAYER_LABELS[activeLayer]}
                  </SectionLabel>
                  {currentDecision.status !== "undecided" && (
                    <p
                      style={{
                        margin: "4px 0 0",
                        fontSize: 13,
                        color: DECISION_COLORS[currentDecision.status],
                        fontWeight: 600,
                      }}
                    >
                      {DECISION_LABELS[currentDecision.status]}
                      {currentDecision.comment
                        ? ` — "${currentDecision.comment.slice(0, 80)}${
                            currentDecision.comment.length > 80 ? "…" : ""
                          }"`
                        : ""}
                    </p>
                  )}
                </div>
              </div>

              {showCommentFor === activeLayer ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
                  <SectionLabel>Note for {LAYER_LABELS[activeLayer]}</SectionLabel>
                  <textarea
                    value={pendingComment}
                    onChange={(e) => setPendingComment(e.target.value)}
                    placeholder="Add your note or correction for this layer..."
                    rows={4}
                    autoFocus
                    style={{
                      width: "100%",
                      background: P.surfaceAlt,
                      border: `1px solid ${P.borderStrong}`,
                      borderRadius: 10,
                      padding: "12px 14px",
                      fontSize: 15,
                      color: P.bone,
                      resize: "vertical" as const,
                      fontFamily: "inherit",
                      lineHeight: 1.7,
                      outline: "none",
                      boxSizing: "border-box" as const,
                    }}
                  />
                  <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
                    <button
                      onClick={() =>
                        confirmComment(
                          activeLayer,
                          decisions[activeLayer].status === "undecided"
                            ? pendingComment.trim()
                              ? "approved_with_comment"
                              : "approved"
                            : decisions[activeLayer].status.includes("reject")
                              ? "rejected_with_comment"
                              : "approved_with_comment"
                        )
                      }
                      style={{
                        padding: "9px 20px",
                        borderRadius: 9,
                        border: "none",
                        background: P.gold,
                        color: P.bg,
                        fontSize: 13,
                        fontWeight: 700,
                        cursor: "pointer",
                      }}
                    >
                      Save note
                    </button>
                    <MicButton setValue={setPendingComment} />
                    <button
                      onClick={() => {
                        setShowCommentFor(null);
                        setPendingComment("");
                      }}
                      style={{
                        padding: "9px 18px",
                        borderRadius: 9,
                        border: `1px solid ${P.border}`,
                        background: "transparent",
                        color: P.boneAlt,
                        fontSize: 13,
                        cursor: "pointer",
                      }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 10, flexWrap: "wrap" }}>
                  {/* Looks right */}
                  <button
                    onClick={() => handleDecisionButton(activeLayer, "approved")}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 9,
                      border:
                        currentDecision.status === "approved" ||
                        currentDecision.status === "approved_with_comment"
                          ? `2px solid ${P.green}`
                          : `1px solid ${P.border}`,
                      background:
                        currentDecision.status === "approved" ||
                        currentDecision.status === "approved_with_comment"
                          ? "rgba(52,168,83,0.14)"
                          : "transparent",
                      color: P.green,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ✓ Looks right
                  </button>
                  {/* Looks right — with note */}
                  <button
                    onClick={() =>
                      handleDecisionButton(activeLayer, "approved_with_comment")
                    }
                    style={{
                      padding: "10px 18px",
                      borderRadius: 9,
                      border: `1px solid ${P.border}`,
                      background: "transparent",
                      color: P.green,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ✓ Looks right — with note
                  </button>
                  {/* This is wrong */}
                  <button
                    onClick={() => handleDecisionButton(activeLayer, "rejected")}
                    style={{
                      padding: "10px 18px",
                      borderRadius: 9,
                      border:
                        currentDecision.status === "rejected" ||
                        currentDecision.status === "rejected_with_comment"
                          ? "2px solid #D07070"
                          : `1px solid ${P.border}`,
                      background:
                        currentDecision.status === "rejected" ||
                        currentDecision.status === "rejected_with_comment"
                          ? "rgba(208,112,112,0.14)"
                          : "transparent",
                      color: "#D07070",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ✗ This is wrong
                  </button>
                  {/* This is wrong — explain */}
                  <button
                    onClick={() =>
                      handleDecisionButton(activeLayer, "rejected_with_comment")
                    }
                    style={{
                      padding: "10px 18px",
                      borderRadius: 9,
                      border: `1px solid ${P.border}`,
                      background: "transparent",
                      color: "#D07070",
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    ✗ This is wrong — explain
                  </button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Manual CTA if all decided but auto-advance hasn't fired */}
      {atReviewGate && allDecided && (
        <div
          style={{
            background: "rgba(52,168,83,0.08)",
            border: "1px solid rgba(52,168,83,0.40)",
            borderRadius: 14,
            padding: "20px 24px",
            display: "flex",
            justifyContent: "space-between",
            alignItems: "center",
            gap: 18,
            flexWrap: "wrap",
          }}
        >
          <div>
            <p
              style={{
                margin: "0 0 6px",
                fontWeight: 700,
                fontSize: 16,
                color: P.green,
                lineHeight: 1.3,
              }}
            >
              All 8 layers reviewed
            </p>
            <p style={{ margin: 0, ...T.body }}>
              Your decisions have been recorded. Proceed to the approval step.
            </p>
          </div>
          <button
            onClick={() => onAllLayersDecided(decisions)}
            style={{
              padding: "13px 28px",
              borderRadius: 12,
              border: "none",
              background: P.gold,
              color: P.bg,
              fontSize: 15,
              fontWeight: 700,
              cursor: "pointer",
              flexShrink: 0,
              letterSpacing: "0.02em",
            }}
          >
            Continue to Review Gate →
          </button>
        </div>
      )}
    </div>
  );
}

// ─── Module 2 — Review Gate ───────────────────────────────────────────────────

function Module2ReviewGate({
  jobId,
  atReviewGate,
  approved,
  hasHardFails,
  hardFails,
  layerDecisions,
  approveLedgerAction,
  rejectLedgerAction,
}: {
  jobId: string;
  atReviewGate: boolean;
  approved: boolean;
  hasHardFails: boolean;
  hardFails: string[];
  layerDecisions: Record<string, { status: string; comment: string }>;
  approveLedgerAction: (formData: FormData) => Promise<void>;
  rejectLedgerAction: (formData: FormData) => Promise<void>;
}) {
  const [showNotes, setShowNotes] = useState(false);
  const [notes, setNotes] = useState("");
  const [isPending, startTransition] = useTransition();
  const [editText, setEditText] = useState("");

  const rejectedCount = Object.values(layerDecisions).filter(
    (d) => d.status === "rejected" || d.status === "rejected_with_comment"
  ).length;
  const notedCount = Object.values(layerDecisions).filter(
    (d) =>
      d.status === "accepted_with_comment" || d.status === "approved_with_comment"
  ).length;
  const allDecided = Object.keys(layerDecisions).length === 8;

  const gateState: "A" | "B" | "C" | "incomplete" = !allDecided
    ? "incomplete"
    : rejectedCount > 0
    ? "C"
    : notedCount > 0
    ? "B"
    : "A";

  if (approved) {
    return (
      <Card>
        <Pill tone="green">Module 2 · Completed</Pill>
        <h2 style={{ margin: "14px 0 10px", ...T.h2 }}>Review Gate — Passed</h2>
        <AlertBanner tone="green">
          Story Layer approved. The accepted ledger has been written and the craft
          evaluation is queued.
        </AlertBanner>
        <p style={{ margin: 0, ...T.body }}>
          This gate is closed. To view the frozen narrative matrix your evaluation is
          using, go to Module 3 — Accepted Ledger.
        </p>
      </Card>
    );
  }

  if (!atReviewGate) {
    return (
      <Card>
        <Pill tone="neutral">Module 2 · Pending</Pill>
        <h2 style={{ margin: "14px 0 10px", ...T.h2 }}>Review Gate</h2>
        <p style={{ margin: 0, ...T.body }}>
          The Review Gate opens once the Story Layer Map is complete. Return here when
          the Story Layer has been generated and this evaluation is awaiting your
          approval.
        </p>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Header */}
      <Card accent="amber">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 18,
          }}
        >
          <div style={{ flex: 1 }}>
            <Pill tone="amber">Module 2 · Awaiting Approval</Pill>
            <h2 style={{ margin: "14px 0 10px", ...T.h2 }}>Review Gate</h2>
            <p style={{ margin: 0, maxWidth: "58ch", ...T.bodyLg }}>
              Before RevisionGrade diagnoses craft, confirm the story facts. The Story
              Layer is what the system believes your manuscript contains. Approve it,
              add corrections, or reject this evaluation entirely.
            </p>
          </div>
          <div
            style={{
              background: P.amberLight,
              border: "1px solid rgba(230,162,60,0.35)",
              borderRadius: 12,
              padding: "14px 18px",
              textAlign: "center",
              flexShrink: 0,
            }}
          >
            <div style={{ ...T.overline, marginBottom: 6 }}>Gate state</div>
            <div
              style={{ fontFamily: "monospace", fontSize: 12, color: P.amber }}
            >
              awaiting_approval
            </div>
          </div>
        </div>
      </Card>

      {/* Hard fail alert */}
      {hasHardFails && (
        <Card>
          <div style={{ display: "flex", gap: 16, alignItems: "flex-start" }}>
            <span style={{ fontSize: 22, flexShrink: 0 }}>⛔</span>
            <div>
              <p
                style={{
                  margin: "0 0 8px",
                  fontWeight: 700,
                  color: "#D07070",
                  fontSize: 16,
                  lineHeight: 1.3,
                }}
              >
                Blocking issues detected
              </p>
              <p style={{ margin: "0 0 14px", ...T.body }}>
                The Story Layer has {hardFails.length} hard failure
                {hardFails.length !== 1 ? "s" : ""} that may affect the quality of
                the evaluation. You may still approve, but the issues below are logged
                and will be carried into the accepted ledger as unresolved.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {hardFails.map((f, i) => (
                  <div
                    key={i}
                    style={{
                      background: P.oxbloodLight,
                      border: `1px solid ${P.oxbloodBorder}`,
                      borderRadius: 10,
                      padding: "10px 14px",
                      fontSize: 14,
                      color: "#D07070",
                      lineHeight: 1.6,
                    }}
                  >
                    {f}
                  </div>
                ))}
              </div>
            </div>
          </div>
        </Card>
      )}

      {/* What you're approving */}
      <Card>
        <SectionLabel>What you are approving</SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr 1fr",
            gap: 14,
          }}
        >
          {[
            ["The system's understanding of your characters and identities", "Identity accuracy"],
            ["Cast roles, antagonists, and structural tier assignments", "Role tier"],
            ["POV structure and voice ownership", "Narrative lens"],
            ["Relationship arcs and emotional spines", "Relationship network"],
            ["Object and symbol lifecycle tracking", "Symbol map"],
            ["Locations, timeline, and world-state logic", "World map"],
            ["Threat vectors and ending accountability", "Pressure / ending"],
            ["Extraction coverage and integrity flags", "Source integrity"],
          ].map(([desc, label]) => (
            <div
              key={label}
              style={{
                background: P.surfaceAlt,
                border: `1px solid ${P.border}`,
                borderRadius: 12,
                padding: "14px 16px",
              }}
            >
              <p style={{ margin: "0 0 6px", ...T.label }}>{label}</p>
              <p style={{ margin: 0, ...T.body }}>{desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Three-state gate decision card */}
      {allDecided && (
        <Card>
          {gateState === "A" && (
            <div>
              <AlertBanner tone="green">Everything checks out.</AlertBanner>
              <p style={{ margin: 0, ...T.body }}>
                Your layer approvals will become governing context for the
                evaluation. The craft diagnosis will use the extracted Story Layer
                together with your recorded decisions.
              </p>
            </div>
          )}
          {gateState === "B" && (
            <div>
              <AlertBanner tone="gold">Proceed with notes on record?</AlertBanner>
              <p style={{ margin: 0, ...T.body }}>
                Your notes will be preserved as mandatory context for the craft
                evaluation. The evaluation will use your recorded decisions alongside
                the extracted Story Layer.
              </p>
            </div>
          )}
          {gateState === "C" && (
            <div>
              <AlertBanner tone="oxblood">
                You flagged {rejectedCount} layer
                {rejectedCount !== 1 ? "s" : ""} as wrong.
              </AlertBanner>
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 16,
                  color: P.bone,
                  fontWeight: 600,
                  lineHeight: 1.4,
                }}
              >
                You may still proceed.
              </p>
              <p style={{ margin: 0, ...T.body }}>
                Your corrections will be preserved as mandatory context. Contested
                layers will be treated as flagged — the evaluation will score with
                your corrections applied.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Author notes toggle */}
      <Card>
        <SectionLabel>Optional — notes for the record</SectionLabel>
        <p style={{ margin: "0 0 16px", ...T.body }}>
          You may attach corrections, clarifications, or comments that will be
          preserved in the accepted ledger. These are for the record — they do not
          block or modify the Story Layer automatically.
        </p>
        <button
          onClick={() => setShowNotes(!showNotes)}
          style={{
            padding: "10px 20px",
            borderRadius: 10,
            border: `1px solid ${P.border}`,
            background: "transparent",
            color: P.boneAlt,
            fontSize: 14,
            cursor: "pointer",
            marginBottom: showNotes ? 16 : 0,
          }}
        >
          {showNotes ? "Hide notes" : "Add notes / corrections"}
        </button>

        {showNotes && (
          <div
            style={{ display: "flex", flexDirection: "column", gap: 14, marginTop: 4 }}
          >
            <SectionLabel>Author notes</SectionLabel>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Example: The character known as 'Michael Wagner' is the same as Michael Salter — please merge. The heron species is a great blue heron, not Pacific."
              rows={5}
              style={{
                width: "100%",
                background: P.surfaceAlt,
                border: `1px solid ${P.borderStrong}`,
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 15,
                color: P.bone,
                resize: "vertical" as const,
                fontFamily: "inherit",
                lineHeight: 1.75,
                outline: "none",
                boxSizing: "border-box" as const,
              }}
            />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <MicButton setValue={setNotes} />
              <span style={{ ...T.caption }}>Speak to add to notes</span>
            </div>
            <SectionLabel>Specific edit requests</SectionLabel>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Specific edit requests (one per line) — e.g.: 'Merge Zimeon + Zimeon-the-heir as one character entry'"
              rows={4}
              style={{
                width: "100%",
                background: P.surfaceAlt,
                border: `1px solid ${P.borderStrong}`,
                borderRadius: 12,
                padding: "14px 16px",
                fontSize: 15,
                color: P.bone,
                resize: "vertical" as const,
                fontFamily: "inherit",
                lineHeight: 1.75,
                outline: "none",
                boxSizing: "border-box" as const,
              }}
            />
            <div style={{ display: "flex", gap: 10, alignItems: "center" }}>
              <MicButton setValue={setEditText} />
              <span style={{ ...T.caption }}>Speak to add edit requests</span>
            </div>
          </div>
        )}
      </Card>

      {/* Action buttons */}
      <Card>
        <SectionLabel>Decision</SectionLabel>
        <p style={{ margin: "0 0 20px", ...T.body }}>
          Approval is enforced in the backend. The craft evaluation will not start
          until this gate is passed. Rejection closes this evaluation — you may revise
          and resubmit.
        </p>
        <div
          style={{
            display: "flex",
            gap: 14,
            flexWrap: "wrap",
            alignItems: "center",
          }}
        >
          <form
            action={async (fd: FormData) => {
              fd.set("author_notes", notes);
              fd.set("edit_requests", editText);
              if (Object.keys(layerDecisions).length > 0) {
                fd.set("layer_decisions", JSON.stringify(layerDecisions));
              }
              await approveLedgerAction(fd);
            }}
          >
            <input type="hidden" name="jobId" value={jobId} />
            <input
              type="hidden"
              name="disposition"
              value={
                gateState === "A"
                  ? "accepted_without_changes"
                  : gateState === "B" || gateState === "C"
                  ? "accepted_with_edits"
                  : "accepted_without_changes"
              }
            />
            <button
              type="submit"
              disabled={isPending}
              data-testid="button-approve-ledger"
              style={{
                padding: "13px 28px",
                borderRadius: 12,
                border: "none",
                background: P.gold,
                color: P.bg,
                fontSize: 15,
                fontWeight: 700,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
                letterSpacing: "0.02em",
              }}
            >
              {isPending
                ? "Processing…"
                : gateState === "A"
                ? "Run Craft Evaluation →"
                : gateState === "B"
                ? "Proceed with notes on record"
                : gateState === "C"
                ? "Proceed with contested layers on record"
                : "Approve — Run Craft Evaluation"}
            </button>
          </form>

          <form
            action={async (fd: FormData) => {
              fd.set("author_notes", notes);
              await rejectLedgerAction(fd);
            }}
          >
            <input type="hidden" name="jobId" value={jobId} />
            <button
              type="submit"
              disabled={isPending}
              data-testid="button-reject-ledger"
              style={{
                padding: "13px 28px",
                borderRadius: 12,
                border: `1px solid ${P.oxbloodBorder}`,
                background: "transparent",
                color: "#D07070",
                fontSize: 15,
                fontWeight: 600,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Reject — Close Evaluation
            </button>
          </form>
        </div>

        <p style={{ margin: "14px 0 0", ...T.caption }}>
          No justification is required. No response obligation. This is your
          manuscript.
        </p>
      </Card>
    </div>
  );
}

// ─── Module 3 — Accepted Ledger ───────────────────────────────────────────────

function Module3AcceptedLedger({
  approved,
  acceptedLedger,
}: {
  approved: boolean;
  acceptedLedger: LedgerShellProps["acceptedLedger"];
}) {
  if (!approved || !acceptedLedger) {
    return (
      <Card>
        <Pill tone="neutral">Module 3 · Locked</Pill>
        <h2 style={{ margin: "14px 0 10px", ...T.h2 }}>Accepted Story Ledger</h2>
        <p style={{ margin: 0, ...T.body }}>
          The accepted ledger is written only after you pass the Review Gate. It
          becomes the frozen narrative matrix that the craft evaluation is authorized
          to use — no modifications after lock.
        </p>
        <div
          style={{
            marginTop: 22,
            padding: "22px 26px",
            background: P.surfaceAlt,
            border: `1px dashed ${P.border}`,
            borderRadius: 14,
            textAlign: "center" as const,
            color: P.ash,
            fontSize: 14,
          }}
        >
          accepted_story_ledger_v1 — not yet written
        </div>
      </Card>
    );
  }

  const warnings = acceptedLedger.governance_warnings ?? [];
  const hardFailCount = warnings.filter((w) => w.severity === "hard_fail").length;
  const softFailCount = warnings.filter((w) => w.severity === "soft_fail").length;

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Header */}
      <Card accent="green">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 18,
          }}
        >
          <div style={{ flex: 1 }}>
            <Pill tone="green">Module 3 · Accepted</Pill>
            <h2 style={{ margin: "14px 0 10px", ...T.h2 }}>Accepted Story Ledger</h2>
            <p style={{ margin: 0, maxWidth: "58ch", ...T.bodyLg }}>
              This is the frozen canonical narrative matrix the craft evaluation is
              authorized to use. It cannot be modified after acceptance. Any changes
              require a new evaluation.
            </p>
          </div>
          <div
            style={{
              background: P.greenLight,
              border: "1px solid rgba(52,168,83,0.35)",
              borderRadius: 12,
              padding: "14px 18px",
              flexShrink: 0,
            }}
          >
            <SectionLabel>Artifact</SectionLabel>
            <div
              style={{ fontFamily: "monospace", fontSize: 12, color: "#6ECA88" }}
            >
              accepted_story_ledger_v1
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                color: P.ash,
                marginTop: 4,
              }}
            >
              {acceptedLedger.approval_status ?? "accepted"}
            </div>
          </div>
        </div>
      </Card>

      {/* Approval metadata */}
      <Card>
        <SectionLabel>Approval record</SectionLabel>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fit, minmax(190px, 1fr))",
            gap: 16,
          }}
        >
          {[
            {
              label: "Approved by role",
              value: acceptedLedger.approved_by_role ?? "author",
            },
            {
              label: "Approved at",
              value: acceptedLedger.approved_at
                ? new Date(acceptedLedger.approved_at).toLocaleString()
                : "—",
            },
            {
              label: "Approval type",
              value: acceptedLedger.approval_status ?? "accepted",
            },
            {
              label: "Layers locked",
              value: String(acceptedLedger.layer_count ?? 8),
            },
          ].map(({ label, value }) => (
            <div
              key={label}
              style={{
                background: P.surfaceAlt,
                border: `1px solid ${P.border}`,
                borderRadius: 12,
                padding: "14px 16px",
              }}
            >
              <p style={{ margin: "0 0 6px", ...T.label }}>{label}</p>
              <p style={{ margin: 0, fontSize: 16, fontWeight: 600, color: P.bone }}>
                {value}
              </p>
            </div>
          ))}
        </div>
      </Card>

      {/* Governance warnings */}
      {warnings.length > 0 && (
        <Card>
          <div
            style={{
              display: "flex",
              justifyContent: "space-between",
              alignItems: "center",
              marginBottom: 16,
              flexWrap: "wrap",
              gap: 10,
            }}
          >
            <SectionLabel>Governance rail — preserved warnings</SectionLabel>
            <div style={{ display: "flex", gap: 8 }}>
              {hardFailCount > 0 && (
                <Pill tone="oxblood" size="xs">
                  {hardFailCount} hard fail{hardFailCount !== 1 ? "s" : ""}
                </Pill>
              )}
              {softFailCount > 0 && (
                <Pill tone="amber" size="xs">
                  {softFailCount} soft fail{softFailCount !== 1 ? "s" : ""}
                </Pill>
              )}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {warnings.map((w, i) => {
              const isHard = w.severity === "hard_fail";
              return (
                <div
                  key={w.warning_id ?? i}
                  style={{
                    background: isHard ? P.oxbloodLight : P.amberLight,
                    border: `1px solid ${
                      isHard ? P.oxbloodBorder : "rgba(230,162,60,0.35)"
                    }`,
                    borderLeft: `3px solid ${isHard ? P.oxblood : P.amber}`,
                    borderRadius: "0 12px 12px 0",
                    padding: "12px 16px",
                  }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 6,
                    }}
                  >
                    <span
                      style={{
                        fontSize: 14,
                        fontWeight: 700,
                        color: isHard ? "#D07070" : P.amber,
                      }}
                    >
                      {w.affected_layer?.replace(/_/g, " ") ?? "General"}
                      {w.affected_character_or_object
                        ? ` · ${w.affected_character_or_object}`
                        : ""}
                    </span>
                    <Pill tone={isHard ? "oxblood" : "amber"} size="xs">
                      {w.severity?.replace(/_/g, " ")}
                    </Pill>
                  </div>
                  <p style={{ margin: 0, ...T.body }}>{w.reason}</p>
                  {w.evidence_location && w.evidence_location.length > 0 && (
                    <p style={{ margin: "8px 0 0", ...T.caption }}>
                      Evidence: {w.evidence_location.join(", ")}
                    </p>
                  )}
                  {w.suggested_resolution && (
                    <p
                      style={{
                        margin: "6px 0 0",
                        ...T.caption,
                        fontStyle: "italic" as const,
                      }}
                    >
                      Suggested: {w.suggested_resolution}
                    </p>
                  )}
                </div>
              );
            })}
          </div>
        </Card>
      )}

      {warnings.length === 0 && (
        <Card>
          <AlertBanner tone="green">
            No governance warnings carried into the accepted ledger. Clean
            acceptance.
          </AlertBanner>
        </Card>
      )}
    </div>
  );
}

// ─── Module 4 — WAVE Handoff ──────────────────────────────────────────────────

function Module4WaveHandoff({ approved }: { approved: boolean }) {
  if (!approved) {
    return (
      <Card>
        <Pill tone="neutral">Module 4 · Locked</Pill>
        <h2 style={{ margin: "14px 0 10px", ...T.h2 }}>WAVE Handoff</h2>
        <p style={{ margin: 0, ...T.body }}>
          The WAVE Revision System™ bridge unlocks only after the Story Ledger is
          accepted. The craft evaluation uses the accepted ledger as its sole
          narrative authority to diagnose craft across 13 criteria.
        </p>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 22 }}>
      {/* Header */}
      <Card accent="gold">
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            flexWrap: "wrap",
            gap: 18,
          }}
        >
          <div style={{ flex: 1 }}>
            <Pill tone="gold">Module 4 · Active</Pill>
            <h2 style={{ margin: "14px 0 10px", ...T.h2 }}>WAVE Handoff</h2>
            <p style={{ margin: 0, maxWidth: "58ch", ...T.bodyLg }}>
              The accepted story ledger is now the authorized narrative matrix. The
              craft evaluation will diagnose your manuscript across 13 criteria using
              it as the sole source of story-fact authority.
            </p>
          </div>
          <div
            style={{
              background: P.goldLight,
              border: `1px solid ${P.goldBorder}`,
              borderRadius: 12,
              padding: "14px 18px",
              flexShrink: 0,
              textAlign: "right" as const,
            }}
          >
            <SectionLabel>System</SectionLabel>
            <div
              style={{ fontFamily: "monospace", fontSize: 12, color: P.gold }}
            >
              WAVE Revision System™
            </div>
            <div
              style={{ fontFamily: "monospace", fontSize: 12, color: P.ash, marginTop: 4 }}
            >
              v1.0.0 · Canonical
            </div>
          </div>
        </div>
      </Card>

      {/* Flow diagram */}
      <Card>
        <SectionLabel>Handoff chain</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
          {[
            "accepted_story_ledger_v1",
            "→",
            "Craft Diagnosis",
            "→",
            "13 Criteria Scores",
            "→",
            "WAVE Repair Priorities",
          ].map((item, i) =>
            item === "→" ? (
              <span key={i} style={{ color: P.gold, fontSize: 18 }}>
                →
              </span>
            ) : (
              <div
                key={i}
                style={{
                  background: P.surfaceAlt,
                  border: `1px solid ${P.border}`,
                  borderRadius: 8,
                  padding: "7px 14px",
                  fontSize: 12,
                  fontFamily: "monospace",
                  color: P.boneAlt,
                  whiteSpace: "nowrap" as const,
                }}
              >
                {item}
              </div>
            )
          )}
        </div>
      </Card>

      {/* 13 Criteria grid */}
      <Card>
        <SectionLabel>13 evaluation criteria</SectionLabel>
        <p style={{ margin: "0 0 20px", ...T.body }}>
          The craft evaluation will produce a scored diagnosis across each criterion.
          Scores unlock the WAVE Revision System™ repair path — the structured revision
          sequence designed to resolve each failing criterion in priority order.
        </p>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(auto-fill, minmax(290px, 1fr))",
            gap: 12,
          }}
        >
          {CRITERIA_13.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 14,
                background: P.surfaceAlt,
                border: `1px solid ${P.border}`,
                borderRadius: 12,
                padding: "13px 16px",
              }}
            >
              <span
                style={{
                  width: 30,
                  height: 30,
                  borderRadius: 9,
                  background: P.goldLight,
                  border: `1px solid ${P.goldBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 12,
                  fontWeight: 700,
                  color: P.gold,
                  flexShrink: 0,
                }}
              >
                {c.id}
              </span>
              <div>
                <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.bone, lineHeight: 1.3 }}>
                  {c.label}
                </p>
                <p style={{ margin: "3px 0 0", ...T.caption }}>
                  WAVE: {c.wave}
                </p>
              </div>
              <div
                style={{
                  marginLeft: "auto",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: P.border,
                  flexShrink: 0,
                }}
              />
            </div>
          ))}
        </div>
      </Card>

      {/* WAVE doctrine note */}
      <Card>
        <SectionLabel>WAVE Revision System™ — doctrine</SectionLabel>
        <div
          style={{ display: "grid", gap: 14, gridTemplateColumns: "1fr 1fr" }}
        >
          {[
            {
              title: "Accepted ledger = sole authority",
              body: "The craft evaluation reads the accepted ledger as its only source of character, relationship, and narrative facts. The original Story Layer is not consulted directly.",
            },
            {
              title: "Criteria servant to WAVE canon",
              body: "All 13 criteria derive from and are governed by the WAVE Revision Guide. If platform output conflicts with WAVE canon, the platform is wrong.",
            },
            {
              title: "Repair order is governed",
              body: "WAVE prescribes a specific revision sequence. Criteria failures are not treated as independent — some repairs unlock others.",
            },
            {
              title: "No craft evaluation without accepted ledger",
              body: "The system will not run craft diagnosis without accepted_story_ledger_v1. The gate contract is enforced in backend logic, not front-end gating.",
            },
          ].map(({ title, body }) => (
            <div
              key={title}
              style={{
                background: P.surfaceAlt,
                border: `1px solid ${P.border}`,
                borderRadius: 12,
                padding: "16px 18px",
              }}
            >
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 14,
                  fontWeight: 700,
                  color: P.gold,
                  lineHeight: 1.3,
                }}
              >
                {title}
              </p>
              <p style={{ margin: 0, ...T.body }}>{body}</p>
            </div>
          ))}
        </div>
      </Card>
    </div>
  );
}

// ─── Main shell ───────────────────────────────────────────────────────────────

export function StoryLedgerShell(props: LedgerShellProps) {
  const {
    jobId,
    manuscriptTitle,
    atReviewGate,
    approved,
    justApproved,
    justRejected,
    storyLayers,
    layerCompletionSummary,
    hardFails,
    hasHardFails,
    acceptedLedger,
    approveLedgerAction,
    rejectLedgerAction,
  } = props;

  const defaultModule: ModuleId = approved ? "accepted_ledger" : "story_layer";
  const [active, setActive] = useState<ModuleId>(defaultModule);
  const layerDecisionsRef = useRef<Record<string, { status: string; comment: string }>>({});

  const moduleAvailable: Record<ModuleId, boolean> = {
    story_layer: Boolean(storyLayers),
    review_gate: atReviewGate || approved,
    accepted_ledger: approved,
    wave_handoff: approved,
  };

  return (
    <div
      style={{
        minHeight: "100vh",
        background: P.bg,
        color: P.bone,
        fontFamily: "'Geist', 'Inter', system-ui, sans-serif",
      }}
    >
      <div style={{ maxWidth: 1220, margin: "0 auto", padding: "36px 28px" }}>

        {/* ── Page header ── */}
        <header
          style={{
            marginBottom: 32,
            paddingBottom: 28,
            borderBottom: `1px solid ${P.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 24,
            flexWrap: "wrap",
          }}
        >
          <div>
            <div
              style={{
                fontSize: 10,
                fontWeight: 700,
                letterSpacing: "0.32em",
                textTransform: "uppercase" as const,
                color: P.gold,
                marginBottom: 10,
              }}
            >
              RevisionGrade™ · Story Ledger
            </div>
            <h1
              style={{
                margin: "0 0 8px",
                ...T.display,
              }}
            >
              {manuscriptTitle}
            </h1>
            <p style={{ margin: 0, fontSize: 15, color: P.boneAlt }}>
              Job{" "}
              <span
                style={{ fontFamily: "monospace", fontSize: 13, color: P.ash }}
              >
                {jobId.slice(0, 8)}
              </span>
              {" · "}
              <span style={{ color: P.ash }}>
                {approved
                  ? "Accepted — craft evaluation queued"
                  : atReviewGate
                  ? "Awaiting your approval"
                  : "In progress"}
              </span>
            </p>
          </div>

          {/* Job state badge */}
          <div
            style={{
              background:
                atReviewGate && !approved
                  ? P.amberLight
                  : approved
                  ? P.greenLight
                  : P.surfaceAlt,
              border: `1px solid ${
                atReviewGate && !approved
                  ? "rgba(230,162,60,0.35)"
                  : approved
                  ? "rgba(52,168,83,0.35)"
                  : P.border
              }`,
              borderRadius: 14,
              padding: "14px 20px",
              textAlign: "right" as const,
              flexShrink: 0,
            }}
          >
            <div
              style={{ ...T.overline, marginBottom: 6 }}
            >
              Job state
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 12,
                color:
                  atReviewGate && !approved
                    ? P.amber
                    : approved
                    ? "#6ECA88"
                    : P.ash,
              }}
            >
              {approved
                ? "accepted_story_ledger_v1"
                : atReviewGate
                ? "review_gate · awaiting_approval"
                : "analysis · in progress"}
            </div>
          </div>
        </header>

        {/* ── Flash banners ── */}
        {justApproved && (
          <AlertBanner tone="green">
            Story Ledger approved. The accepted ledger has been written and the
            craft evaluation is queued. You can close this tab — you will be
            notified when the evaluation is complete.
          </AlertBanner>
        )}
        {justRejected && (
          <AlertBanner tone="oxblood">
            Evaluation closed. Revise your manuscript and submit a new evaluation
            when ready.
          </AlertBanner>
        )}

        {/* ── Module navigation ── */}
        <nav
          style={{
            display: "grid",
            gridTemplateColumns: "repeat(4, 1fr)",
            gap: 14,
            marginBottom: 32,
          }}
        >
          {MODULES.map((m) => {
            const isActive = active === m.id;
            const isAvailable = moduleAvailable[m.id];
            return (
              <button
                key={m.id}
                onClick={() => isAvailable && setActive(m.id)}
                style={{
                  borderRadius: 16,
                  border: isActive
                    ? `1px solid ${P.goldBorder}`
                    : `1px solid ${P.border}`,
                  background: isActive ? P.goldLight : P.surface,
                  padding: "18px 20px",
                  textAlign: "left" as const,
                  cursor: isAvailable ? "pointer" : "default",
                  opacity: isAvailable ? 1 : 0.38,
                }}
              >
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    marginBottom: 8,
                  }}
                >
                  <span
                    style={{
                      width: 30,
                      height: 30,
                      borderRadius: 9,
                      background: isActive ? P.gold : P.surfaceAlt,
                      display: "flex",
                      alignItems: "center",
                      justifyContent: "center",
                      fontSize: 13,
                      fontWeight: 700,
                      color: isActive ? P.bg : P.ash,
                      flexShrink: 0,
                    }}
                  >
                    {m.number}
                  </span>
                  <span
                    style={{
                      fontSize: 14,
                      fontWeight: 700,
                      color: isActive ? P.gold : P.bone,
                      lineHeight: 1.3,
                    }}
                  >
                    {m.label}
                  </span>
                </div>
                <p
                  style={{
                    margin: 0,
                    fontSize: 12,
                    color: isActive ? P.gold : P.ash,
                    paddingLeft: 42,
                  }}
                >
                  {m.sublabel}
                </p>
              </button>
            );
          })}
        </nav>

        {/* ── Active module ── */}
        <main>
          {active === "story_layer" && (
            <Module1StoryLayer
              storyLayers={storyLayers}
              layerCompletionSummary={layerCompletionSummary}
              atReviewGate={atReviewGate}
              onAllLayersDecided={(decisions) => {
                layerDecisionsRef.current = decisions;
                setActive("review_gate");
              }}
            />
          )}
          {active === "review_gate" && (
            <Module2ReviewGate
              jobId={jobId}
              atReviewGate={atReviewGate}
              approved={approved}
              hasHardFails={hasHardFails}
              hardFails={hardFails}
              layerDecisions={layerDecisionsRef.current}
              approveLedgerAction={approveLedgerAction}
              rejectLedgerAction={rejectLedgerAction}
            />
          )}
          {active === "accepted_ledger" && (
            <Module3AcceptedLedger
              approved={approved}
              acceptedLedger={acceptedLedger}
            />
          )}
          {active === "wave_handoff" && (
            <Module4WaveHandoff approved={approved} />
          )}
        </main>

        {/* ── Footer nav ── */}
        <footer
          style={{
            marginTop: 48,
            paddingTop: 24,
            borderTop: `1px solid ${P.border}`,
            display: "flex",
            gap: 12,
            flexWrap: "wrap",
          }}
        >
          <a
            href={`/evaluate/${jobId}`}
            style={{
              fontSize: 13,
              color: P.ash,
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: 10,
              border: `1px solid ${P.border}`,
              background: P.surface,
            }}
          >
            ← Back to evaluation
          </a>
          <a
            href="/evaluate"
            style={{
              fontSize: 13,
              color: P.ash,
              textDecoration: "none",
              padding: "8px 16px",
              borderRadius: 10,
              border: `1px solid ${P.border}`,
              background: P.surface,
            }}
          >
            Job list
          </a>
        </footer>
      </div>
    </div>
  );
}
