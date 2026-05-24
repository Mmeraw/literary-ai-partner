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
        padding: "5px 10px",
        borderRadius: 7,
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
        gap: 5,
        transition: "all 0.15s",
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
  surfaceAlt: "#171614",
  surfaceHover: "#1C1B19",
  border: "#272523",
  borderStrong: "#393734",
  bone: "#F2EFEA",
  boneAlt: "rgba(242,239,234,0.65)",
  boneFaint: "rgba(242,239,234,0.30)",
  boneMuted: "rgba(242,239,234,0.10)",
  gold: "#A98E4A",
  goldLight: "rgba(169,142,74,0.14)",
  goldBorder: "rgba(169,142,74,0.35)",
  oxblood: "#7A1E1E",
  oxbloodLight: "rgba(122,30,30,0.18)",
  oxbloodBorder: "rgba(122,30,30,0.40)",
  ash: "#7B7B7B",
  green: "#34A853",
  greenLight: "rgba(52,168,83,0.14)",
  amber: "#E6A23C",
  amberLight: "rgba(230,162,60,0.14)",
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
    padding: size === "xs" ? "2px 8px" : "3px 11px",
    fontSize: size === "xs" ? 10 : 11,
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

function Card({
  children,
  pad = true,
  style,
}: {
  children: React.ReactNode;
  pad?: boolean;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: P.surface,
        border: `1px solid ${P.border}`,
        borderRadius: 20,
        ...(pad ? { padding: "24px 28px" } : {}),
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
        margin: "0 0 10px",
        fontSize: 10,
        fontWeight: 700,
        letterSpacing: "0.1em",
        textTransform: "uppercase" as const,
        color: P.ash,
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
        borderRadius: "0 10px 10px 0",
        padding: "10px 14px",
        fontSize: 13,
        color: s.color,
        marginBottom: 16,
        lineHeight: 1.5,
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

type LayerDecisionStatus = "undecided" | "approved" | "approved_with_comment" | "rejected" | "rejected_with_comment";

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
  approved: "✓ Approved",
  approved_with_comment: "✓ Approved with comment",
  rejected: "✗ Rejected",
  rejected_with_comment: "✗ Rejected with comment",
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
    () => Object.fromEntries(LAYER_ORDER.map((k) => [k, { status: "undecided", comment: "" }]))
  );
  const [showCommentFor, setShowCommentFor] = useState<string | null>(null);
  const [pendingComment, setPendingComment] = useState("");
  const [allDecidedTriggered, setAllDecidedTriggered] = useState(false);

  const decidedCount = LAYER_ORDER.filter((k) => decisions[k].status !== "undecided").length;
  const allDecided = decidedCount === LAYER_ORDER.length;

  // Auto-advance to review gate when all layers decided
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
    const needsComment = status === "approved_with_comment" || status === "rejected_with_comment";
    if (needsComment) {
      setShowCommentFor(layerKey);
      setPendingComment(decisions[layerKey].comment ?? "");
    } else {
      setShowCommentFor(null);
      setDecision(layerKey, status);
      // Advance to next undecided layer
      const currentIdx = LAYER_ORDER.indexOf(layerKey as typeof LAYER_ORDER[number]);
      const nextUndecided = LAYER_ORDER.find(
        (k, i) => i > currentIdx && decisions[k].status === "undecided"
      ) ?? LAYER_ORDER.find((k) => decisions[k].status === "undecided" && k !== layerKey);
      if (nextUndecided) setActiveLayer(nextUndecided);
    }
  }

  function confirmComment(layerKey: string, status: LayerDecisionStatus) {
    setDecision(layerKey, status, pendingComment);
    setShowCommentFor(null);
    setPendingComment("");
    const currentIdx = LAYER_ORDER.indexOf(layerKey as typeof LAYER_ORDER[number]);
    const nextUndecided = LAYER_ORDER.find(
      (k, i) => i > currentIdx && decisions[k].status === "undecided"
    ) ?? LAYER_ORDER.find((k) => decisions[k].status === "undecided" && k !== layerKey);
    if (nextUndecided) setActiveLayer(nextUndecided);
  }

  if (!storyLayers) {
    return (
      <Card>
        <SectionLabel>Module 1 · Generated</SectionLabel>
        <h2 style={{ margin: "0 0 8px", fontSize: 22, fontWeight: 600, color: P.bone }}>
          Story Layer Map
        </h2>
        <p style={{ margin: 0, fontSize: 14, color: P.boneAlt, lineHeight: 1.6 }}>
          The Story Layer has not been generated yet. It will appear here once analysis is complete.
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header card */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <Pill tone="gold">Module 1 · Generated</Pill>
            <h2 style={{ margin: "10px 0 6px", fontSize: 24, fontWeight: 600, color: P.bone }}>
              Story Layer Map
            </h2>
            <p style={{ margin: 0, maxWidth: "60ch", fontSize: 13, color: P.boneAlt, lineHeight: 1.6 }}>
              This is not the score report. It is the extracted narrative map — what RevisionGrade believes your manuscript contains before craft diagnosis begins.
            </p>
          </div>
          <div style={{ background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: 12, padding: "12px 16px", textAlign: "right", flexShrink: 0 }}>
            <SectionLabel>Artifacts</SectionLabel>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: P.gold }}>pass1a_story_layer_v1</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: P.gold }}>ledger_quality_report_v1</div>
          </div>
        </div>
      </Card>

      {/* Instruction banner — only shown when at review gate */}
      {atReviewGate && (
        <div style={{
          background: "rgba(169,142,74,0.10)",
          border: `1px solid ${P.goldBorder}`,
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          gap: 14,
          alignItems: "flex-start",
        }}>
          <span style={{ fontSize: 18, flexShrink: 0 }}>📋</span>
          <div>
            <p style={{ margin: "0 0 6px", fontWeight: 700, fontSize: 13, color: P.gold }}>Review each layer before approving</p>
            <p style={{ margin: 0, fontSize: 12, color: P.boneAlt, lineHeight: 1.6 }}>
              RevisionGrade extracted these story facts from your manuscript. Review each of the 8 layers and mark it Approve, Approve with comment, Reject, or Reject with comment.
              Once all layers are reviewed, you will be taken to the approval gate automatically.
            </p>
            <div style={{ marginTop: 10, display: "flex", alignItems: "center", gap: 10 }}>
              <div style={{ flex: 1, height: 4, background: P.border, borderRadius: 99 }}>
                <div style={{ width: `${(decidedCount / LAYER_ORDER.length) * 100}%`, height: "100%", background: P.gold, borderRadius: 99, transition: "width 0.3s" }} />
              </div>
              <span style={{ fontSize: 11, color: P.gold, fontWeight: 700, flexShrink: 0 }}>
                {decidedCount} / {LAYER_ORDER.length} layers reviewed
              </span>
            </div>
          </div>
        </div>
      )}

      {/* Completion bar */}
      <LayerCompletionBar summary={layerCompletionSummary} />

      {/* Layer navigator + panel */}
      <div style={{ display: "grid", gridTemplateColumns: "220px 1fr", gap: 16, alignItems: "start" }}>
        {/* Sidebar nav */}
        <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
          {LAYER_ORDER.map((key) => {
            const isActive = activeLayer === key;
            const isPopulated = populated.includes(key);
            const dec = decisions[key];
            const isDecided = dec.status !== "undecided";
            const isApproved = dec.status === "approved" || dec.status === "approved_with_comment";
            const isRejected = dec.status === "rejected" || dec.status === "rejected_with_comment";
            const dotColor = isDecided ? (isApproved ? P.green : "#D07070") : isPopulated ? P.green : P.ash;
            return (
              <button
                key={key}
                onClick={() => setActiveLayer(key)}
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 10,
                  padding: "10px 14px",
                  borderRadius: 10,
                  border: isActive ? `1px solid ${P.goldBorder}` : `1px solid transparent`,
                  background: isActive ? P.goldLight : "transparent",
                  color: isActive ? P.gold : isPopulated ? P.boneAlt : P.ash,
                  cursor: "pointer",
                  textAlign: "left" as const,
                  fontSize: 12,
                  fontWeight: isActive ? 700 : 500,
                  transition: "all 0.15s",
                  width: "100%",
                }}
              >
                <span style={{ fontSize: 14, flexShrink: 0 }}>{LAYER_ICONS[key]}</span>
                <span style={{ lineHeight: 1.3, flex: 1 }}>{LAYER_LABELS[key]}</span>
                {/* Decision indicator */}
                <span style={{
                  marginLeft: "auto",
                  width: 8,
                  height: 8,
                  borderRadius: "50%",
                  background: dotColor,
                  flexShrink: 0,
                  outline: isDecided ? `2px solid ${dotColor}40` : "none",
                }} />
              </button>
            );
          })}
        </div>

        {/* Active layer panel */}
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          <StoryLayerRenderer
            layerKey={activeLayer}
            data={currentData}
          />

          {/* Per-layer decision bar — only shown at review gate */}
          {atReviewGate && (
            <Card>
              <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 10, marginBottom: 12 }}>
                <div>
                  <SectionLabel>Your decision — {LAYER_LABELS[activeLayer]}</SectionLabel>
                  {currentDecision.status !== "undecided" && (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: DECISION_COLORS[currentDecision.status], fontWeight: 600 }}>
                      {DECISION_LABELS[currentDecision.status]}
                      {currentDecision.comment ? ` — "${currentDecision.comment.slice(0, 60)}${currentDecision.comment.length > 60 ? "…" : ""}"` : ""}
                    </p>
                  )}
                </div>
              </div>

              {showCommentFor === activeLayer ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
                  <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 2 }}>
                    <SectionLabel>Comment for {LAYER_LABELS[activeLayer]}</SectionLabel>
                    <MicButton setValue={setPendingComment} />
                  </div>
                  <textarea
                    value={pendingComment}
                    onChange={(e) => setPendingComment(e.target.value)}
                    placeholder="Add your comment or correction for this layer..."
                    rows={3}
                    autoFocus
                    style={{
                      width: "100%",
                      background: P.surfaceAlt,
                      border: `1px solid ${P.borderStrong}`,
                      borderRadius: 8,
                      padding: "10px 12px",
                      fontSize: 13,
                      color: P.bone,
                      resize: "vertical" as const,
                      fontFamily: "inherit",
                      lineHeight: 1.5,
                      outline: "none",
                      boxSizing: "border-box" as const,
                    }}
                  />
                  <div style={{ display: "flex", gap: 8 }}>
                    <button
                      onClick={() => confirmComment(activeLayer, decisions[activeLayer].status === "undecided" ?
                        (pendingComment.trim() ? "approved_with_comment" : "approved") :
                        decisions[activeLayer].status.includes("reject") ? "rejected_with_comment" : "approved_with_comment"
                      )}
                      style={{ padding: "8px 16px", borderRadius: 8, border: "none", background: P.gold, color: P.bg, fontSize: 12, fontWeight: 700, cursor: "pointer" }}
                    >
                      Save comment
                    </button>
                    <button
                      onClick={() => { setShowCommentFor(null); setPendingComment(""); }}
                      style={{ padding: "8px 16px", borderRadius: 8, border: `1px solid ${P.border}`, background: "transparent", color: P.boneAlt, fontSize: 12, cursor: "pointer" }}
                    >
                      Cancel
                    </button>
                  </div>
                </div>
              ) : (
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  <button
                    onClick={() => handleDecisionButton(activeLayer, "approved")}
                    style={{
                      padding: "9px 16px", borderRadius: 8,
                      border: currentDecision.status === "approved" || currentDecision.status === "approved_with_comment" ? `2px solid ${P.green}` : `1px solid ${P.border}`,
                      background: currentDecision.status === "approved" || currentDecision.status === "approved_with_comment" ? "rgba(52,168,83,0.14)" : "transparent",
                      color: P.green, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    ✓ Approve
                  </button>
                  <button
                    onClick={() => handleDecisionButton(activeLayer, "approved_with_comment")}
                    style={{
                      padding: "9px 16px", borderRadius: 8,
                      border: `1px solid ${P.border}`,
                      background: "transparent",
                      color: P.green, fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    ✓ Approve with comment
                  </button>
                  <button
                    onClick={() => handleDecisionButton(activeLayer, "rejected")}
                    style={{
                      padding: "9px 16px", borderRadius: 8,
                      border: currentDecision.status === "rejected" || currentDecision.status === "rejected_with_comment" ? "2px solid #D07070" : `1px solid ${P.border}`,
                      background: currentDecision.status === "rejected" || currentDecision.status === "rejected_with_comment" ? "rgba(208,112,112,0.14)" : "transparent",
                      color: "#D07070", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    ✗ Reject
                  </button>
                  <button
                    onClick={() => handleDecisionButton(activeLayer, "rejected_with_comment")}
                    style={{
                      padding: "9px 16px", borderRadius: 8,
                      border: `1px solid ${P.border}`,
                      background: "transparent",
                      color: "#D07070", fontSize: 12, fontWeight: 600, cursor: "pointer",
                    }}
                  >
                    ✗ Reject with comment
                  </button>
                </div>
              )}
            </Card>
          )}
        </div>
      </div>

      {/* Manual CTA if all decided but auto-advance hasn't fired */}
      {atReviewGate && allDecided && (
        <div style={{
          background: "rgba(52,168,83,0.10)",
          border: `1px solid rgba(52,168,83,0.40)`,
          borderRadius: 12,
          padding: "16px 20px",
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          gap: 16,
          flexWrap: "wrap",
        }}>
          <div>
            <p style={{ margin: "0 0 4px", fontWeight: 700, fontSize: 13, color: P.green }}>All 8 layers reviewed</p>
            <p style={{ margin: 0, fontSize: 12, color: P.boneAlt }}>Your layer decisions have been recorded. Proceed to the approval gate.</p>
          </div>
          <button
            onClick={() => onAllLayersDecided(decisions)}
            style={{
              padding: "11px 24px", borderRadius: 10, border: "none",
              background: P.gold, color: P.bg, fontSize: 13, fontWeight: 700, cursor: "pointer", flexShrink: 0,
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
    (d) => d.status === "accepted_with_comment" || d.status === "approved_with_comment"
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
        <h2 style={{ margin: "12px 0 8px", fontSize: 24, fontWeight: 600, color: P.bone }}>
          Review Gate — Passed
        </h2>
        <AlertBanner tone="green">
          Story Layer approved. The accepted ledger has been written and Phase 2 is queued.
        </AlertBanner>
        <p style={{ margin: 0, fontSize: 13, color: P.boneAlt, lineHeight: 1.6 }}>
          This gate is closed. To view the frozen narrative matrix your evaluation is using, go to Module 3 — Accepted Ledger.
        </p>
      </Card>
    );
  }

  if (!atReviewGate) {
    return (
      <Card>
        <Pill tone="neutral">Module 2 · Pending</Pill>
        <h2 style={{ margin: "12px 0 8px", fontSize: 24, fontWeight: 600, color: P.bone }}>
          Review Gate
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: P.boneAlt, lineHeight: 1.6 }}>
          The Review Gate opens once the Story Layer Map is complete. Return here when the Story Layer has been generated and this evaluation is awaiting your approval.
        </p>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <Pill tone="amber">Module 2 · Awaiting Approval</Pill>
            <h2 style={{ margin: "10px 0 6px", fontSize: 24, fontWeight: 600, color: P.bone }}>
              Review Gate
            </h2>
            <p style={{ margin: 0, maxWidth: "58ch", fontSize: 13, color: P.boneAlt, lineHeight: 1.6 }}>
              Before RevisionGrade diagnoses craft, confirm the story facts. The Story Layer is what the system believes your manuscript contains. Approve it, correct it, or reject this evaluation.
            </p>
          </div>
          <div style={{ background: P.amberLight, border: `1px solid rgba(230,162,60,0.35)`, borderRadius: 12, padding: "12px 16px", textAlign: "center", flexShrink: 0 }}>
            <div style={{ fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: P.ash, marginBottom: 4 }}>Gate state</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: P.amber }}>awaiting_approval</div>
          </div>
        </div>
      </Card>

      {/* Hard fail alert */}
      {hasHardFails && (
        <Card>
          <div style={{ display: "flex", gap: 12, alignItems: "flex-start" }}>
            <span style={{ fontSize: 18, flexShrink: 0 }}>⛔</span>
            <div>
              <p style={{ margin: "0 0 6px", fontWeight: 700, color: "#D07070", fontSize: 14 }}>
                Blocking issues detected
              </p>
              <p style={{ margin: "0 0 12px", fontSize: 12, color: P.boneAlt, lineHeight: 1.5 }}>
                The Story Layer has {hardFails.length} hard failure{hardFails.length !== 1 ? "s" : ""} that may affect the quality of Phase 2. You may still approve, but the issues below are logged and will be carried into the accepted ledger as unresolved.
              </p>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {hardFails.map((f, i) => (
                  <div key={i} style={{ background: P.oxbloodLight, border: `1px solid ${P.oxbloodBorder}`, borderRadius: 8, padding: "8px 12px", fontSize: 12, color: "#D07070" }}>
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
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
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
                borderRadius: 10,
                padding: "11px 14px",
              }}
            >
              <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase" as const, color: P.ash }}>{label}</p>
              <p style={{ margin: 0, fontSize: 12, color: P.boneAlt, lineHeight: 1.5 }}>{desc}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Three-state gate decision card */}
      {allDecided && (
        <Card>
          {gateState === "A" && (
            <div>
              <AlertBanner tone="green">Everything checks out. Ready to run Phase 2?</AlertBanner>
              <p style={{ margin: 0, fontSize: 12, color: P.boneAlt }}>
                All 8 layers reviewed — no flags, no notes.
              </p>
            </div>
          )}
          {gateState === "B" && (
            <div>
              <AlertBanner tone="gold">Proceed with notes on record?</AlertBanner>
              <p style={{ margin: 0, fontSize: 12, color: P.boneAlt }}>
                You left notes on {notedCount} layer{notedCount !== 1 ? "s" : ""}. They will be preserved in the accepted ledger. No layers were flagged as incorrect.
              </p>
            </div>
          )}
          {gateState === "C" && (
            <div>
              <AlertBanner tone="oxblood">
                You flagged {rejectedCount} layer{rejectedCount !== 1 ? "s" : ""} as incorrect.
              </AlertBanner>
              <p style={{ margin: "0 0 8px", fontSize: 13, color: P.bone, fontWeight: 600 }}>
                This is your manuscript. You decide.
              </p>
              <p style={{ margin: 0, fontSize: 12, color: P.boneAlt }}>
                Proceeding records your flags permanently. Phase 2 will run with the contested layers noted in the governance rail.
              </p>
            </div>
          )}
        </Card>
      )}

      {/* Author notes toggle */}
      <Card>
        <SectionLabel>Optional — notes for the record</SectionLabel>
        <p style={{ margin: "0 0 12px", fontSize: 13, color: P.boneAlt, lineHeight: 1.5 }}>
          You may attach corrections, clarifications, or comments that will be preserved in the accepted ledger. These are for the record — they do not block or modify the Story Layer automatically.
        </p>
        <button
          onClick={() => setShowNotes(!showNotes)}
          style={{
            padding: "8px 16px",
            borderRadius: 8,
            border: `1px solid ${P.border}`,
            background: "transparent",
            color: P.boneAlt,
            fontSize: 12,
            cursor: "pointer",
            marginBottom: showNotes ? 12 : 0,
          }}
        >
          {showNotes ? "Hide notes" : "Add notes / corrections"}
        </button>

        {showNotes && (
          <div style={{ display: "flex", flexDirection: "column", gap: 10, marginTop: 4 }}>
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
              <SectionLabel>Author notes</SectionLabel>
              <MicButton setValue={setNotes} />
            </div>
            <textarea
              value={notes}
              onChange={(e) => setNotes(e.target.value)}
              placeholder="Example: The character known as 'Michael Wagner' is the same as Michael Salter — please merge. The heron species is a great blue heron, not Pacific."
              rows={5}
              style={{
                width: "100%",
                background: P.surfaceAlt,
                border: `1px solid ${P.borderStrong}`,
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 13,
                color: P.bone,
                resize: "vertical" as const,
                fontFamily: "inherit",
                lineHeight: 1.6,
                outline: "none",
                boxSizing: "border-box" as const,
              }}
            />
            <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginTop: 6 }}>
              <SectionLabel>Specific edit requests</SectionLabel>
              <MicButton setValue={setEditText} />
            </div>
            <textarea
              value={editText}
              onChange={(e) => setEditText(e.target.value)}
              placeholder="Specific edit requests (one per line) — e.g.: 'Merge Zimeon + Zimeon-the-heir as one character entry'"
              rows={3}
              style={{
                width: "100%",
                background: P.surfaceAlt,
                border: `1px solid ${P.borderStrong}`,
                borderRadius: 10,
                padding: "12px 14px",
                fontSize: 13,
                color: P.bone,
                resize: "vertical" as const,
                fontFamily: "inherit",
                lineHeight: 1.6,
                outline: "none",
                boxSizing: "border-box" as const,
              }}
            />
          </div>
        )}
      </Card>

      {/* Action buttons */}
      <Card>
        <SectionLabel>Decision</SectionLabel>
        <p style={{ margin: "0 0 16px", fontSize: 13, color: P.boneAlt, lineHeight: 1.5 }}>
          Approval is backend-enforced. Phase 2 will not start until this gate is passed. Rejection closes this evaluation — you may revise and resubmit.
        </p>
        <div style={{ display: "flex", gap: 12, flexWrap: "wrap", alignItems: "center" }}>
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
                padding: "11px 24px",
                borderRadius: 10,
                border: "none",
                background: P.gold,
                color: P.bg,
                fontSize: 13,
                fontWeight: 700,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
                letterSpacing: "0.03em",
              }}
            >
              {isPending
                ? "Processing…"
                : gateState === "A"
                ? "Run Phase 2 →"
                : gateState === "B"
                ? "Proceed with notes on record"
                : gateState === "C"
                ? "Proceed with flags on record"
                : "Approve — Run Phase 2"}
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
                padding: "11px 24px",
                borderRadius: 10,
                border: `1px solid ${P.oxbloodBorder}`,
                background: "transparent",
                color: "#D07070",
                fontSize: 13,
                fontWeight: 600,
                cursor: isPending ? "not-allowed" : "pointer",
                opacity: isPending ? 0.6 : 1,
              }}
            >
              Reject — Close Evaluation
            </button>
          </form>
        </div>

        <p style={{ margin: "12px 0 0", fontSize: 11, color: P.ash }}>
          No justification is required. No response obligation. This is your manuscript.
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
        <h2 style={{ margin: "12px 0 8px", fontSize: 24, fontWeight: 600, color: P.bone }}>
          Accepted Story Ledger
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: P.boneAlt, lineHeight: 1.6 }}>
          The accepted ledger is written only after you pass the Review Gate. It becomes the frozen narrative matrix that Phase 2 is authorized to use — no modifications after lock.
        </p>
        <div
          style={{
            marginTop: 20,
            padding: "20px 24px",
            background: P.surfaceAlt,
            border: `1px dashed ${P.border}`,
            borderRadius: 12,
            textAlign: "center" as const,
            color: P.ash,
            fontSize: 13,
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
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <Pill tone="green">Module 3 · Accepted</Pill>
            <h2 style={{ margin: "10px 0 6px", fontSize: 24, fontWeight: 600, color: P.bone }}>
              Accepted Story Ledger
            </h2>
            <p style={{ margin: 0, maxWidth: "58ch", fontSize: 13, color: P.boneAlt, lineHeight: 1.6 }}>
              This is the frozen canonical narrative matrix Phase 2 is authorized to use. It cannot be modified after acceptance. Any changes require a new evaluation.
            </p>
          </div>
          <div style={{ background: P.greenLight, border: `1px solid rgba(52,168,83,0.35)`, borderRadius: 12, padding: "12px 16px", flexShrink: 0 }}>
            <SectionLabel>Artifact</SectionLabel>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: "#6ECA88" }}>accepted_story_ledger_v1</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: P.ash, marginTop: 4 }}>
              {acceptedLedger.approval_status ?? "accepted"}
            </div>
          </div>
        </div>
      </Card>

      {/* Approval metadata */}
      <Card>
        <SectionLabel>Approval record</SectionLabel>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fit, minmax(180px, 1fr))", gap: 16 }}>
          {[
            { label: "Approved by role", value: acceptedLedger.approved_by_role ?? "author" },
            { label: "Approved at", value: acceptedLedger.approved_at ? new Date(acceptedLedger.approved_at).toLocaleString() : "—" },
            { label: "Approval type", value: acceptedLedger.approval_status ?? "accepted" },
            { label: "Layers locked", value: String(acceptedLedger.layer_count ?? 8) },
          ].map(({ label, value }) => (
            <div key={label} style={{ background: P.surfaceAlt, border: `1px solid ${P.border}`, borderRadius: 10, padding: "12px 14px" }}>
              <p style={{ margin: "0 0 4px", fontSize: 10, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: P.ash }}>{label}</p>
              <p style={{ margin: 0, fontSize: 14, fontWeight: 600, color: P.bone }}>{value}</p>
            </div>
          ))}
        </div>
      </Card>

      {/* Governance warnings */}
      {warnings.length > 0 && (
        <Card>
          <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 14, flexWrap: "wrap", gap: 8 }}>
            <SectionLabel>Governance rail — preserved warnings</SectionLabel>
            <div style={{ display: "flex", gap: 8 }}>
              {hardFailCount > 0 && <Pill tone="oxblood" size="xs">{hardFailCount} hard fail{hardFailCount !== 1 ? "s" : ""}</Pill>}
              {softFailCount > 0 && <Pill tone="amber" size="xs">{softFailCount} soft fail{softFailCount !== 1 ? "s" : ""}</Pill>}
            </div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {warnings.map((w, i) => {
              const isHard = w.severity === "hard_fail";
              return (
                <div
                  key={w.warning_id ?? i}
                  style={{
                    background: isHard ? P.oxbloodLight : P.amberLight,
                    border: `1px solid ${isHard ? P.oxbloodBorder : "rgba(230,162,60,0.35)"}`,
                    borderLeft: `3px solid ${isHard ? P.oxblood : P.amber}`,
                    borderRadius: "0 10px 10px 0",
                    padding: "10px 14px",
                  }}
                >
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 4 }}>
                    <span style={{ fontSize: 12, fontWeight: 700, color: isHard ? "#D07070" : P.amber }}>
                      {w.affected_layer?.replace(/_/g, " ") ?? "General"}
                      {w.affected_character_or_object ? ` · ${w.affected_character_or_object}` : ""}
                    </span>
                    <Pill tone={isHard ? "oxblood" : "amber"} size="xs">{w.severity?.replace(/_/g, " ")}</Pill>
                  </div>
                  <p style={{ margin: 0, fontSize: 12, color: P.boneAlt, lineHeight: 1.5 }}>{w.reason}</p>
                  {w.evidence_location && w.evidence_location.length > 0 && (
                    <p style={{ margin: "6px 0 0", fontSize: 11, color: P.ash }}>
                      Evidence: {w.evidence_location.join(", ")}
                    </p>
                  )}
                  {w.suggested_resolution && (
                    <p style={{ margin: "4px 0 0", fontSize: 11, color: P.ash, fontStyle: "italic" as const }}>
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
            No governance warnings carried into the accepted ledger. Clean acceptance.
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
        <h2 style={{ margin: "12px 0 8px", fontSize: 24, fontWeight: 600, color: P.bone }}>
          WAVE Handoff
        </h2>
        <p style={{ margin: 0, fontSize: 13, color: P.boneAlt, lineHeight: 1.6 }}>
          The WAVE Revision System™ bridge unlocks only after the Story Ledger is accepted. Phase 2 uses the accepted ledger as its sole narrative authority to diagnose craft across 13 criteria.
        </p>
      </Card>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
      {/* Header */}
      <Card>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 16 }}>
          <div>
            <Pill tone="gold">Module 4 · Active</Pill>
            <h2 style={{ margin: "10px 0 6px", fontSize: 24, fontWeight: 600, color: P.bone }}>
              WAVE Handoff
            </h2>
            <p style={{ margin: 0, maxWidth: "58ch", fontSize: 13, color: P.boneAlt, lineHeight: 1.6 }}>
              The accepted story ledger is now the authorized narrative matrix. Phase 2 will diagnose craft across 13 criteria using it as the sole source of story-fact authority.
            </p>
          </div>
          <div style={{ background: P.goldLight, border: `1px solid ${P.goldBorder}`, borderRadius: 12, padding: "12px 16px", flexShrink: 0, textAlign: "right" as const }}>
            <SectionLabel>System</SectionLabel>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: P.gold }}>WAVE Revision System™</div>
            <div style={{ fontFamily: "monospace", fontSize: 11, color: P.ash, marginTop: 2 }}>v1.0.0 · Canonical</div>
          </div>
        </div>
      </Card>

      {/* Flow diagram */}
      <Card>
        <SectionLabel>Handoff chain</SectionLabel>
        <div style={{ display: "flex", alignItems: "center", gap: 6, flexWrap: "wrap" }}>
          {[
            "accepted_story_ledger_v1",
            "→",
            "Phase 2 Diagnosis",
            "→",
            "13 Criteria Scores",
            "→",
            "WAVE Repair Priorities",
          ].map((item, i) =>
            item === "→" ? (
              <span key={i} style={{ color: P.gold, fontSize: 16 }}>→</span>
            ) : (
              <div
                key={i}
                style={{
                  background: P.surfaceAlt,
                  border: `1px solid ${P.border}`,
                  borderRadius: 8,
                  padding: "6px 12px",
                  fontSize: 11,
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
        <p style={{ margin: "0 0 16px", fontSize: 13, color: P.boneAlt, lineHeight: 1.5 }}>
          Phase 2 will produce a scored diagnosis across each criterion. Scores unlock the WAVE Revision System™ repair path — the structured revision sequence designed to resolve each failing criterion in priority order.
        </p>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(auto-fill, minmax(280px, 1fr))", gap: 10 }}>
          {CRITERIA_13.map((c) => (
            <div
              key={c.id}
              style={{
                display: "flex",
                alignItems: "center",
                gap: 12,
                background: P.surfaceAlt,
                border: `1px solid ${P.border}`,
                borderRadius: 10,
                padding: "11px 14px",
              }}
            >
              <span
                style={{
                  width: 28,
                  height: 28,
                  borderRadius: 8,
                  background: P.goldLight,
                  border: `1px solid ${P.goldBorder}`,
                  display: "flex",
                  alignItems: "center",
                  justifyContent: "center",
                  fontSize: 11,
                  fontWeight: 700,
                  color: P.gold,
                  flexShrink: 0,
                }}
              >
                {c.id}
              </span>
              <div>
                <p style={{ margin: 0, fontSize: 12, fontWeight: 600, color: P.bone }}>{c.label}</p>
                <p style={{ margin: "2px 0 0", fontSize: 10, color: P.ash }}>WAVE: {c.wave}</p>
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
        <div style={{ display: "grid", gap: 12, gridTemplateColumns: "1fr 1fr" }}>
          {[
            {
              title: "Accepted ledger = sole authority",
              body: "Phase 2 reads the accepted ledger as its only source of character, relationship, and narrative facts. The original Story Layer is not consulted directly.",
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
              title: "No Phase 2 without accepted ledger",
              body: "The system will not run craft diagnosis without accepted_story_ledger_v1. The gate contract is enforced in backend logic, not front-end gating.",
            },
          ].map(({ title, body }) => (
            <div
              key={title}
              style={{
                background: P.surfaceAlt,
                border: `1px solid ${P.border}`,
                borderRadius: 12,
                padding: "14px 16px",
              }}
            >
              <p style={{ margin: "0 0 6px", fontSize: 12, fontWeight: 700, color: P.gold }}>{title}</p>
              <p style={{ margin: 0, fontSize: 12, color: P.boneAlt, lineHeight: 1.6 }}>{body}</p>
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

  // Default to Story Layer Map so the author reads the layer content before approving.
  // Review Gate module is always one click away via the stepper.
  const defaultModule: ModuleId = approved ? "accepted_ledger" : "story_layer";
  const [active, setActive] = useState<ModuleId>(defaultModule);
  // Stores per-layer decisions from Module 1 to pass into Module 2 approve form
  const layerDecisionsRef = useRef<Record<string, { status: string; comment: string }>>({});

  // Determine which modules are "available" (not locked)
  const moduleAvailable: Record<ModuleId, boolean> = {
    story_layer: Boolean(storyLayers),
    review_gate: atReviewGate || approved,
    accepted_ledger: approved,
    wave_handoff: approved,
  };

  return (
    <div style={{ minHeight: "100vh", background: P.bg, color: P.bone, fontFamily: "'Geist', 'Inter', system-ui, sans-serif" }}>
      <div style={{ maxWidth: 1200, margin: "0 auto", padding: "32px 24px" }}>

        {/* ── Page header ── */}
        <header
          style={{
            marginBottom: 28,
            paddingBottom: 24,
            borderBottom: `1px solid ${P.border}`,
            display: "flex",
            justifyContent: "space-between",
            alignItems: "flex-start",
            gap: 20,
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
                marginBottom: 8,
              }}
            >
              RevisionGrade™ · Story Ledger
            </div>
            <h1 style={{ margin: "0 0 6px", fontSize: 32, fontWeight: 600, letterSpacing: "-0.02em", color: P.bone }}>
              {manuscriptTitle}
            </h1>
            <p style={{ margin: 0, fontSize: 13, color: P.boneAlt }}>
              Job{" "}
              <span style={{ fontFamily: "monospace", color: P.ash }}>{jobId.slice(0, 8)}</span>
              {" · "}
              <span style={{ color: P.ash }}>
                {approved ? "Accepted — Phase 2 queued" : atReviewGate ? "Awaiting approval" : "In progress"}
              </span>
            </p>
          </div>

          {/* Job state badge */}
          <div
            style={{
              background: atReviewGate && !approved ? P.amberLight : approved ? P.greenLight : P.surfaceAlt,
              border: `1px solid ${atReviewGate && !approved ? "rgba(230,162,60,0.35)" : approved ? "rgba(52,168,83,0.35)" : P.border}`,
              borderRadius: 14,
              padding: "12px 18px",
              textAlign: "right" as const,
              flexShrink: 0,
            }}
          >
            <div style={{ fontSize: 10, textTransform: "uppercase" as const, letterSpacing: "0.1em", color: P.ash, marginBottom: 4 }}>
              Job state target
            </div>
            <div
              style={{
                fontFamily: "monospace",
                fontSize: 11,
                color: atReviewGate && !approved ? P.amber : approved ? "#6ECA88" : P.ash,
              }}
            >
              {approved ? "accepted_story_ledger_v1" : atReviewGate ? "review_gate · awaiting_approval" : "phase_1a · in progress"}
            </div>
          </div>
        </header>

        {/* ── Flash banners ── */}
        {justApproved && (
          <AlertBanner tone="green">
            Story Ledger approved. The accepted ledger has been written and Phase 2 is queued. You can close this tab — you will be notified when the craft evaluation is complete.
          </AlertBanner>
        )}
        {justRejected && (
          <AlertBanner tone="oxblood">
            Evaluation closed. Revise your manuscript and submit a new evaluation when ready.
          </AlertBanner>
        )}

        {/* ── Module navigation ── */}
        <nav style={{ display: "grid", gridTemplateColumns: "repeat(4, 1fr)", gap: 12, marginBottom: 28 }}>
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
                  padding: "16px 18px",
                  textAlign: "left" as const,
                  cursor: isAvailable ? "pointer" : "default",
                  opacity: isAvailable ? 1 : 0.4,
                  transition: "all 0.15s",
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 6 }}>
                  <span
                    style={{
                      width: 28,
                      height: 28,
                      borderRadius: 8,
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
                  <span style={{ fontSize: 13, fontWeight: 700, color: isActive ? P.gold : P.bone }}>
                    {m.label}
                  </span>
                </div>
                <p style={{ margin: 0, fontSize: 11, color: isActive ? P.gold : P.ash }}>
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
                // Carry layer decisions into the review gate module via a ref
                // so the author's per-layer notes are available in the approval form.
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
        <footer style={{ marginTop: 40, paddingTop: 20, borderTop: `1px solid ${P.border}`, display: "flex", gap: 12, flexWrap: "wrap" }}>
          <a
            href={`/evaluate/${jobId}`}
            style={{ fontSize: 12, color: P.ash, textDecoration: "none", padding: "6px 12px", borderRadius: 8, border: `1px solid ${P.border}`, background: P.surface }}
          >
            ← Back to evaluation
          </a>
          <a
            href="/evaluate"
            style={{ fontSize: 12, color: P.ash, textDecoration: "none", padding: "6px 12px", borderRadius: 8, border: `1px solid ${P.border}`, background: P.surface }}
          >
            Job list
          </a>
        </footer>
      </div>
    </div>
  );
}
