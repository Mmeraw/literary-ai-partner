/**
 * StoryLedgerLayers.tsx
 *
 * Purpose-built UI maps for all 9 canonical Story Ledger layers.
 * Each renderer is spec'd against STORY_LAYER_PROFORMA_V1 and the
 * dream-state gold samples from the Story-Ledger-Phase documentation pack.
 *
 * Contract:
 *   - No raw key-value dumps.
 *   - Every layer has a dedicated visual structure.
 *   - Palette: Obsidian #0E0E0E, Bone White #F2EFEA, Oxblood #7A1E1E,
 *               Ash Gray #7B7B7B, Tarnished Gold #A98E4A
 *   - Internal phase names never appear. No "phase_0", "phase_1a", etc.
 *   - "chunk" → "evidence span" everywhere.
 *   - Black Ops UI: performance > decoration.
 *   - Premium typography: min 15px body, 1.75 line-height, editorial warmth.
 */

"use client";

import React from "react";

// ─── Palette ────────────────────────────────────────────────────────────────

const C = {
  obsidian: "#0E0E0E",
  bone: "#F2EFEA",
  oxblood: "#7A1E1E",
  ash: "#7B7B7B",
  gold: "#A98E4A",
  surface: "#161614",
  surfaceAlt: "#1C1B19",
  border: "#2A2926",
  borderStrong: "#3D3B38",
  textPrimary: "#E8E5E0",
  textMuted: "#9A9690",
  textFaint: "#6A6866",
  goldLight: "rgba(169,142,74,0.12)",
  oxbloodLight: "rgba(122,30,30,0.12)",
  successLight: "rgba(52,168,83,0.12)",
  warnLight: "rgba(230,162,60,0.12)",
};

// ─── Label-only relationship guard ──────────────────────────────────────────
// Author rule: if either party has no proper name, strip the pair.
const LABEL_ONLY_TERMS = new Set([
  "canadian",
  "driver",
  "driver from highway",
  "foreigner",
  "unnamed",
  "unknown",
  "unknown character",
  "unnamed character",
  "passenger",
  "stranger",
  "man",
  "woman",
  "boy",
  "girl",
  "old man",
  "old woman",
  "guard",
  "soldier",
]);

function isLabelOnly(name: string): boolean {
  const n = name.trim().toLowerCase();
  if (LABEL_ONLY_TERMS.has(n)) return true;
  // Only reject purely generic descriptors ("a soldier", "the child", etc.).
  // The old lowercase-multi-word heuristic was broken: it lowercased first,
  // then checked isLowerCase — which is *always* true. Removed.
  // Keep the explicit LABEL_ONLY_TERMS set as the only filter.
  return false;
}

// ─── Hidden internal fields (Object Symbol layer) ───────────────────────────
const OBJECT_INTERNAL_FIELDS = new Set([
  "coping_index",
  "schema_version",
  "symbol_payoff_index",
  "object_presence_index",
  "object_count",
  "high_value_object_ids",
  "symbol_payoff_items_v1",
]);

// ─── Hidden internal fields (Source Integrity layer) ────────────────────────
const SOURCE_INTERNAL_FIELDS = new Set([
  "generated_at",
  "prompt_version",
  "schema_version",
  "schema_ledger_version",
  "hard_fail_count",
  "state_conflict_count",
]);

// ─── Subtle label definitions (hover tooltips for non-obvious terms) ────────
// Only labels that aren't self-explanatory get a hint. Not a Christmas tree.
const LABEL_HINTS: Record<string, string> = {
  // Canonical Identity layer
  "Legal name states": "Every formal version of this character's name found in the manuscript — full name, married name, title + surname, etc.",
  "Captivity name states": "Names used for a character while held captive, imprisoned, or under an assumed identity.",
  "Resolution status": "Whether the system detected a name change (marriage, alias reveal, etc.) and how it was resolved.",
  "Aliases & Name States": "All the different names, nicknames, and forms of address used for this character across the manuscript.",
  // Cast / Role Tier layer
  "Protagonist": "The central consciousness the narrative orbits. In literary fiction, this may mean the character under the most structural pressure — not necessarily the hero.",
  "Co-protagonist": "A second character who shares roughly equal narrative weight, perspective time, or structural importance.",
  "Antagonist": "The primary opposing force. In literary fiction, this may be a person, institution, social norm, or internal conflict — not necessarily a villain.",
  "Mentor": "A character who offers the protagonist guidance, counter-models, or hard truths — whether kindly or harshly.",
  "Foil": "A character who contrasts with the protagonist to highlight particular qualities or themes.",
  "Major Secondary": "Characters with sustained presence who shape the protagonist's arc but don't carry their own major plotline.",
  "Relational Engines": "The character pairings that drive the story forward — where conflict, growth, or transformation happens between two people.",
  "Collective Force": "A group acting as a single narrative force — a mob, a family, an institution — rather than individual characters.",
  "Symbolic Force": "An abstract or non-human force that functions as a character — fate, the sea, an institution, a disease.",
  // Relationship Network layer
  "Initial dynamic": "How the relationship started — the power balance, emotional tone, or circumstances of first contact.",
  "Rupture / separation": "The breaking point — what event or revelation fractured the relationship.",
  "Current / final state": "Where the relationship stands at the end of the manuscript or the most recent scene.",
  // Object / Symbol layer
  "Key Evidence": "Objects that directly drive plot resolution, reveal hidden information, or serve as turning-point evidence — not social props.",
  "Symbolic / Motif": "Recurring objects or images that carry thematic weight across the manuscript — they mean more than their literal function.",
  "Scene Props": "Objects that appear in specific scenes and contribute to atmosphere, social context, or character detail without carrying broader symbolic weight.",
  "Story-critical": "This object carries significant narrative weight — it drives plot, reveals character, or resolves a theme.",
  "Held by": "The character(s) who possess, use, or are most associated with this object at different points in the story.",
  "Payoff": "How the object resolves or pays off narratively — its final meaning, use, or transformation.",
  // Timeline / Location layer
  "Movement path": "The physical route a character or object takes through the story's geography.",
  "World state rules": "The governing logic of the story's world at a given point — laws, customs, environmental conditions, or supernatural rules in effect.",
  // Threat / Pressure / Ending layer
  "Pressure": "The specific force this threat applies to the protagonist — emotional, physical, social, institutional, or internal.",
  "Pressure Agents": "Named characters or forces that exert opposing pressure on the protagonist — not necessarily villains. Includes marital constraint, maternal obligation, social convention, and other literary pressure types.",
  "Pressure agents": "Named characters or forces that exert opposing pressure on the protagonist — not necessarily villains.",
  "maternal obligation": "Pressure from children, parenthood expectations, or the cultural role of mother — not villainous, but structurally constraining.",
  "marital constraint": "Pressure from a marriage, spouse, or domestic expectation system — ownership, respectability, property, household control.",
  "social convention": "Pressure from the community's rules, reputation systems, or collective judgment about acceptable behavior.",
  "sexual destabilizer": "A character who activates physical/sexual autonomy without offering true liberation — temptation without resolution.",
  "symbolic terminal force": "An environmental or abstract force (the sea, weather, landscape) that functions as the story's terminal pressure or final reckoning.",
  "medical-social surveillance": "A character who observes the protagonist through a diagnostic or institutional lens — doctor, counselor, authority figure interpreting behavior.",
  "narrative pressure": "A general opposing force that constrains the protagonist's freedom, choices, or self-determination.",
  "Ending Accountability": "Tracks whether characters who carried open narrative threads received adequate closure by the story's end.",
  "Terminal States": "Where each character was last seen and whether their narrative thread resolved, remained open, or was abandoned.",
  "accidentally abandoned": "The character disappeared from the narrative without their thread being resolved — may be intentional for background figures, but significant for named characters.",
  // Source Integrity layer
  "Hard failure": "A critical extraction error — the system could not reliably identify this element and needs author guidance.",
  // Identity & Pronouns layer
  "Pronoun variation detected": "The system found different pronouns used for this character in different parts of the manuscript. This may be intentional (character development) or a continuity error.",
};

function labelHint(label: string): string | undefined {
  return LABEL_HINTS[label];
}

/** Shared style + title for uppercase section headers that may have a hint. */
function sectionHeaderProps(label: string): { style: React.CSSProperties; title?: string } {
  const hint = labelHint(label);
  return {
    style: {
      margin: "0 0 8px",
      fontSize: 11,
      fontWeight: 700,
      letterSpacing: "0.08em",
      textTransform: "uppercase" as const,
      color: C.textMuted,
      cursor: hint ? "help" : undefined,
      borderBottom: hint ? `1px dotted ${C.textFaint}` : undefined,
      display: hint ? "inline-block" : undefined,
    },
    title: hint,
  };
}

// ─── Author-facing layer descriptions (permanent, locked) ───────────────────
const LAYER_DESCRIPTIONS: Record<string, string> = {
  source_integrity_layer:
    "System extraction health and author guidance. Review the extraction status below, then tell RevisionGrade anything intentional that should not be treated as an error.",
  pov_structure_layer:
    "Whose eyes does the reader see through, and when? Maps the narrative cameras, voice ownership, and any perspective shifts across your story.",
  canonical_identity_layer:
    "How the system tracks a character across every name, alias, nickname, and role they carry. Especially important when a character is known by several names or hides their identity.",
  cast_role_tier_layer:
    "Every character ranked by the structural job they do — from protagonist through antagonist to walk-on. Reveals who the story centers on and who applies pressure.",
  relationship_network_layer:
    "The named bonds between characters: how they began, what stressed them, how they changed. Only sustained relationships between named characters appear here.",
  object_symbol_layer:
    "Tracks significant objects from their first appearance through ownership changes to their final meaning. Weapons, documents, tokens — anything the story puts weight on.",
  location_timeline_worldstate_layer:
    "Where the story takes place, in what order, and what rules govern the world at each point. Movement paths, time sequences, and environmental logic.",
  threat_antagonist_ending_layer:
    "The forces working against your protagonist — people, institutions, environments, internal conflicts, and social pressures — mapped to their final state at story's end.",
  identity_pronoun_layer:
    "How each character is identified: pronouns detected across the manuscript, gender signals, and any pronoun shifts between sections. Confirm intentional transitions or flag continuity errors.",
};

// ─── Shared primitives ───────────────────────────────────────────────────────

function LayerTitle({
  icon,
  title,
  description,
  badge,
  badgeTone = "neutral",
}: {
  icon: string;
  title: string;
  description?: string;
  badge?: string;
  badgeTone?: "neutral" | "gold" | "oxblood" | "green" | "warn";
}) {
  const badgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 12px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.05em",
    textTransform: "uppercase" as const,
    whiteSpace: "nowrap" as const,
    ...(badgeTone === "gold"
      ? { background: C.goldLight, color: C.gold, border: `1px solid ${C.gold}44` }
      : badgeTone === "oxblood"
        ? { background: C.oxbloodLight, color: "#C05050", border: `1px solid ${C.oxblood}44` }
        : badgeTone === "green"
          ? { background: C.successLight, color: "#5CB85C", border: "1px solid rgba(52,168,83,0.3)" }
          : badgeTone === "warn"
            ? { background: C.warnLight, color: "#E6A23C", border: "1px solid rgba(230,162,60,0.3)" }
            : { background: "rgba(255,255,255,0.05)", color: C.textMuted, border: `1px solid ${C.border}` }),
  };

  return (
    <div style={{ marginBottom: 22 }}>
      <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12 }}>
        <div style={{ display: "flex", alignItems: "flex-start", gap: 12, flex: 1 }}>
          <span style={{ fontSize: 22, lineHeight: 1, marginTop: 2, flexShrink: 0 }}>{icon}</span>
          <div>
            <h3
              style={{
                margin: 0,
                fontSize: 17,
                fontWeight: 700,
                letterSpacing: "-0.01em",
                color: C.textPrimary,
                lineHeight: 1.3,
              }}
            >
              {title}
            </h3>
            {description && (
              <p
                style={{
                  margin: "6px 0 0",
                  fontSize: 14,
                  color: C.textMuted,
                  lineHeight: 1.7,
                  maxWidth: "64ch",
                  fontStyle: "italic",
                }}
              >
                {description}
              </p>
            )}
          </div>
        </div>
        {badge && <span style={badgeStyle}>{badge}</span>}
      </div>
      <div style={{ height: 1, background: C.border, marginTop: 18 }} />
    </div>
  );
}

function LayerShell({
  children,
  tone = "neutral",
  empty = false,
  emptyLabel,
  emptyDetail,
}: {
  children?: React.ReactNode;
  tone?: "neutral" | "warn" | "block";
  empty?: boolean;
  emptyLabel?: string;
  emptyDetail?: string;
}) {
  const borderColor =
    tone === "block" ? C.oxblood : tone === "warn" ? "#6B5B00" : C.border;
  const borderLeft =
    tone === "block"
      ? `3px solid ${C.oxblood}`
      : tone === "warn"
        ? "3px solid #8B7300"
        : `1px solid ${C.border}`;

  if (empty) {
    return (
      <div
        style={{
          border: `1px dashed ${C.border}`,
          borderRadius: 14,
          padding: "28px 24px",
          background: C.surface,
          textAlign: "center",
        }}
      >
        <p style={{ margin: "0 0 8px", fontSize: 15, color: C.textMuted, fontWeight: 600 }}>
          {emptyLabel ?? "No data populated for this layer."}
        </p>
        {emptyDetail && (
          <p style={{ margin: 0, fontSize: 14, color: C.textFaint, lineHeight: 1.7, maxWidth: "52ch", marginLeft: "auto", marginRight: "auto" }}>
            {emptyDetail}
          </p>
        )}
      </div>
    );
  }

  return (
    <div
      style={{
        borderLeft,
        borderTop: `1px solid ${borderColor}`,
        borderRight: `1px solid ${borderColor}`,
        borderBottom: `1px solid ${borderColor}`,
        borderRadius: 14,
        padding: "22px 24px",
        background: C.surface,
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

/**
 * Attempt to produce a human-readable string from an object.
 * Recognises name-state objects ({name, confidence?, validFromChunk?})
 * and falls back to extracting common label-like keys before resorting
 * to JSON.stringify.
 */
function humanizeObject(v: unknown): string {
  if (v === null || v === undefined) return "";
  if (typeof v !== "object" || Array.isArray(v)) return String(v);

  const obj = v as Record<string, unknown>;

  // Name-state objects: {name, confidence?, validFromChunk?, validUntilChunk?}
  if (typeof obj.name === "string") {
    const parts: string[] = [obj.name];
    if (typeof obj.confidence === "string" && obj.confidence !== "explicit") {
      parts.push(`(${obj.confidence})`);
    }
    return parts.join(" ");
  }

  // Objects with a label or description field
  for (const key of ["label", "description", "title", "value", "display"]) {
    if (typeof obj[key] === "string" && obj[key]) return obj[key] as string;
  }

  // Last resort: compact JSON
  return JSON.stringify(v);
}

function FieldRow({
  label,
  value,
  mono = false,
  hint,
}: {
  label: string;
  value?: unknown;
  mono?: boolean;
  hint?: string;
}) {
  const resolvedHint = hint ?? labelHint(label);
  if (value === null || value === undefined || value === "") return null;

  // Arrays — render as pill-style tags when items are objects with names
  if (Array.isArray(value)) {
    if (value.length === 0) return null;

    const hasStructuredItems = value.some(
      (v) => typeof v === "object" && v !== null && !Array.isArray(v),
    );

    const items: string[] = value.map((v) =>
      typeof v === "string" ? v : humanizeObject(v),
    );

    if (items.length === 0) return null;

    return (
      <div
        style={{
          display: "grid",
          gridTemplateColumns: "180px 1fr",
          gap: "4px 20px",
          padding: "10px 0",
          borderBottom: `1px solid ${C.border}`,
          alignItems: "start",
        }}
      >
        <span
          style={{
            fontSize: 11,
            fontWeight: 700,
            letterSpacing: "0.07em",
            textTransform: "uppercase" as const,
            color: C.textMuted,
            paddingTop: 2,
            cursor: resolvedHint ? "help" : undefined,
            borderBottom: resolvedHint ? `1px dotted ${C.textFaint}` : undefined,
          }}
          title={resolvedHint}
        >
          {label}
        </span>
        {hasStructuredItems ? (
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, paddingTop: 2 }}>
            {items.map((item, idx) => (
              <Pill key={idx} label={item} tone="neutral" />
            ))}
          </div>
        ) : (
          <span style={{ fontSize: 15, color: C.textPrimary, lineHeight: 1.75 }}>
            {items.join(", ")}
          </span>
        )}
      </div>
    );
  }

  // Single objects — humanize
  const display =
    typeof value === "object"
      ? humanizeObject(value)
      : String(value);

  if (!display) return null;

  // "unresolved" gets a muted style
  const isUnresolved =
    typeof display === "string" && display.toLowerCase() === "unresolved";

  return (
    <div
      style={{
        display: "grid",
        gridTemplateColumns: "180px 1fr",
        gap: "4px 20px",
        padding: "10px 0",
        borderBottom: `1px solid ${C.border}`,
        alignItems: "start",
      }}
    >
      <span
        style={{
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: "0.07em",
          textTransform: "uppercase" as const,
          color: C.textMuted,
          paddingTop: 2,
          cursor: resolvedHint ? "help" : undefined,
          borderBottom: resolvedHint ? `1px dotted ${C.textFaint}` : undefined,
        }}
        title={resolvedHint}
      >
        {label}
      </span>
      {mono ? (
        <pre
          style={{
            margin: 0,
            fontSize: 12,
            color: C.textPrimary,
            whiteSpace: "pre-wrap",
            fontFamily: "monospace",
            lineHeight: 1.6,
          }}
        >
          {display}
        </pre>
      ) : (
        <span
          style={{
            fontSize: 15,
            color: isUnresolved ? C.textFaint : C.textPrimary,
            lineHeight: 1.75,
            fontStyle: isUnresolved ? "italic" : "normal",
          }}
        >
          {isUnresolved ? "Unresolved" : display}
        </span>
      )}
    </div>
  );
}

function Pill({
  label,
  tone = "neutral",
}: {
  label: string;
  tone?: "neutral" | "gold" | "oxblood" | "green" | "warn" | "blue";
}) {
  const styles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "4px 12px",
    borderRadius: 99,
    fontSize: 12,
    fontWeight: 600,
    ...(tone === "gold"
      ? { background: C.goldLight, color: C.gold }
      : tone === "oxblood"
        ? { background: C.oxbloodLight, color: "#C05050" }
        : tone === "green"
          ? { background: C.successLight, color: "#5CB85C" }
          : tone === "warn"
            ? { background: C.warnLight, color: "#E6A23C" }
            : tone === "blue"
              ? { background: "rgba(59,130,246,0.12)", color: "#60A5FA" }
              : { background: "rgba(255,255,255,0.06)", color: C.textMuted }),
  };
  return <span style={styles}>{label}</span>;
}

function EvidenceTag({ id }: { id?: string | null }) {
  if (!id) return null;
  return (
    <span
      style={{
        fontFamily: "monospace",
        fontSize: 10,
        color: C.gold,
        background: C.goldLight,
        padding: "2px 8px",
        borderRadius: 4,
      }}
    >
      {id}
    </span>
  );
}

function BlockerBanner({ reason }: { reason: string }) {
  return (
    <div
      style={{
        background: C.oxbloodLight,
        border: `1px solid ${C.oxblood}55`,
        borderLeft: `3px solid ${C.oxblood}`,
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 14,
        color: "#C05050",
        marginBottom: 14,
        lineHeight: 1.6,
      }}
    >
      ⛔ {reason}
    </div>
  );
}

function WarnBanner({ reason }: { reason: string }) {
  return (
    <div
      style={{
        background: C.warnLight,
        border: "1px solid rgba(230,162,60,0.3)",
        borderLeft: "3px solid #E6A23C",
        borderRadius: 8,
        padding: "10px 14px",
        fontSize: 14,
        color: "#E6A23C",
        marginBottom: 14,
        lineHeight: 1.6,
      }}
    >
      ⚠ {reason}
    </div>
  );
}

function Divider() {
  return <div style={{ borderBottom: `1px solid ${C.border}`, margin: "18px 0" }} />;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p
      style={{
        margin: "20px 0 10px",
        fontSize: 11,
        fontWeight: 700,
        letterSpacing: "0.08em",
        textTransform: "uppercase" as const,
        color: C.textMuted,
      }}
    >
      {children}
    </p>
  );
}

function CharacterCard({
  children,
  style,
}: {
  children: React.ReactNode;
  style?: React.CSSProperties;
}) {
  return (
    <div
      style={{
        background: C.surfaceAlt,
        border: `1px solid ${C.borderStrong}`,
        borderRadius: 12,
        padding: "16px 20px",
        ...style,
      }}
    >
      {children}
    </div>
  );
}

// ─── Layer 1 — Source Integrity ──────────────────────────────────────────────

// Map raw pipeline status to author-friendly labels
const STATUS_AUTHOR_LABELS: Record<string, { label: string; description: string; tone: "green" | "oxblood" | "warn" | "neutral" | "gold" }> = {
  CLEAN: {
    label: "No source issues detected",
    description: "Manuscript ingestion completed successfully. All extraction layers returned data.",
    tone: "green",
  },
  DEGRADED: {
    label: "Extraction needs review",
    description: "Manuscript ingestion completed, but one or more extraction layers produced incomplete or conflicting results.",
    tone: "gold",
  },
  HARD_FAIL: {
    label: "Extraction needs review",
    description: "Manuscript was processed, but the system flagged issues that may affect evaluation quality. Review the detected issues below.",
    tone: "warn",
  },
  FAILED: {
    label: "Evaluation cannot continue",
    description: "A critical error prevented the system from processing the manuscript. Contact support if this persists.",
    tone: "oxblood",
  },
};

// True blockers that should actually show as "Evaluation cannot continue"
const TRUE_BLOCKER_PATTERNS = [
  "no chunk outputs",
  "character ledger empty",
  "file unreadable",
  "chunking failed",
  "manuscript text missing",
  "schema invalid",
];

function isTrueBlocker(trigger: string): boolean {
  const t = trigger.toLowerCase();
  return TRUE_BLOCKER_PATTERNS.some((p) => t.includes(p));
}

// Classify hard_fail_triggers into blockers vs review items
function classifyTriggers(triggers: string[]): { blockers: string[]; reviewItems: string[] } {
  const blockers: string[] = [];
  const reviewItems: string[] = [];
  for (const trigger of triggers) {
    if (isTrueBlocker(trigger)) {
      blockers.push(trigger);
    } else {
      // Strip internal prefixes like "HARD_FAIL:" or "WARN:" for author-facing display
      const cleaned = trigger
        .replace(/^HARD_FAIL:\s*/i, "")
        .replace(/^WARN:\s*/i, "");
      reviewItems.push(cleaned);
    }
  }
  return { blockers, reviewItems };
}

export function SourceIntegrityLayer({
  data,
  enrichmentNote,
  onEnrichmentNoteChange,
}: {
  data?: Record<string, unknown> | null;
  enrichmentNote?: string;
  onEnrichmentNoteChange?: (next: string) => void;
}) {
  const integrityStatus =
    typeof data?.integrity_status === "string" ? data.integrity_status : "";
  const statusUpper = integrityStatus.toUpperCase();
  const totalChunks =
    typeof data?.total_chunks_processed === "number"
      ? data.total_chunks_processed
      : null;

  const emptyLayerWarnings = Array.isArray(data?.empty_layer_warnings)
    ? (data.empty_layer_warnings as Array<{ layer: string; code: string; message: string }>)
    : [];

  const hardFailTriggers = Array.isArray(data?.hard_fail_triggers)
    ? (data.hard_fail_triggers as string[])
    : [];
  const { blockers, reviewItems } = classifyTriggers(hardFailTriggers);

  // Determine effective status: if we have true blockers and zero chunks, it's
  // genuinely FAILED. Otherwise, if manuscript was processed, downgrade to
  // review-required.
  const hasTrueBlockers = blockers.length > 0 && (totalChunks === null || totalChunks === 0);
  const effectiveStatus = hasTrueBlockers
    ? "FAILED"
    : (reviewItems.length > 0 || emptyLayerWarnings.length > 0)
      ? "DEGRADED"
      : statusUpper === "CLEAN"
        ? "CLEAN"
        : "DEGRADED";

  const statusInfo = STATUS_AUTHOR_LABELS[effectiveStatus] ?? STATUS_AUTHOR_LABELS.DEGRADED;
  const hasIssues = reviewItems.length > 0 || emptyLayerWarnings.length > 0 || blockers.length > 0;
  const tone = effectiveStatus === "FAILED" ? "block" : effectiveStatus === "DEGRADED" ? "warn" : "neutral";

  return (
    <LayerShell tone={tone}>
      <LayerTitle
        icon="🔒"
        title="Source Integrity"
        description="System extraction health and author guidance. Review the extraction status below, then tell RevisionGrade anything intentional that should not be treated as an error."
      />

      {/* ── Section A: System Extraction Health (read-only) ── */}
      <SubHeading>System Extraction Health</SubHeading>
      <div
        style={{
          background: C.surfaceAlt,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "16px 20px",
          marginBottom: 20,
        }}
      >
        {/* Status headline */}
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: 10 }}>
          <Pill
            label={statusInfo.label}
            tone={statusInfo.tone}
          />
          {totalChunks !== null && totalChunks > 0 && (
            <Pill label={`${totalChunks} section${totalChunks === 1 ? "" : "s"} processed`} tone="neutral" />
          )}
        </div>

        {/* Status description */}
        <p style={{ margin: "0 0 12px", fontSize: 14, color: C.textMuted, lineHeight: 1.65 }}>
          {statusInfo.description}
        </p>

        {/* Detected issues */}
        {hasIssues && (
          <div style={{ marginTop: 4 }}>
            <p style={{
              margin: "0 0 10px",
              fontSize: 13,
              fontWeight: 700,
              color: C.textPrimary,
              letterSpacing: "0.03em",
            }}>
              Detected issues:
            </p>
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {blockers.map((b, i) => (
                <div
                  key={`blocker-${i}`}
                  style={{
                    background: "rgba(176,64,64,0.08)",
                    border: "1px solid rgba(176,64,64,0.25)",
                    borderLeft: `3px solid ${C.oxblood}`,
                    borderRadius: "0 8px 8px 0",
                    padding: "10px 14px",
                    fontSize: 14,
                    color: C.textMuted,
                    lineHeight: 1.65,
                  }}
                >
                  {b}
                </div>
              ))}
              {reviewItems.map((item, i) => (
                <div
                  key={`review-${i}`}
                  style={{
                    background: "rgba(200,150,50,0.06)",
                    border: "1px solid rgba(200,150,50,0.2)",
                    borderLeft: "3px solid #E6A23C",
                    borderRadius: "0 8px 8px 0",
                    padding: "10px 14px",
                    fontSize: 14,
                    color: C.textMuted,
                    lineHeight: 1.65,
                  }}
                >
                  {item}
                </div>
              ))}
              {emptyLayerWarnings.map((w) => (
                <div
                  key={w.code}
                  style={{
                    background: "rgba(200,150,50,0.06)",
                    border: "1px solid rgba(200,150,50,0.2)",
                    borderLeft: "3px solid #E6A23C",
                    borderRadius: "0 8px 8px 0",
                    padding: "10px 14px",
                    fontSize: 14,
                    color: C.textMuted,
                    lineHeight: 1.65,
                  }}
                >
                  {w.message}
                </div>
              ))}
            </div>

            {/* Author action guidance */}
            <p style={{ margin: "14px 0 0", fontSize: 13, color: C.textFaint, fontStyle: "italic", lineHeight: 1.6 }}>
              {effectiveStatus === "FAILED"
                ? "This evaluation cannot proceed until the blocking issue is resolved. Please re-upload your manuscript or contact support."
                : "You may add context below if something is intentional. Otherwise, RevisionGrade will not treat missing extraction data as an author problem."}
            </p>
          </div>
        )}
      </div>

      {/* ── Section B: Author Context (optional note) ── */}
      <SubHeading>Author Context</SubHeading>
      <p style={{ margin: "0 0 10px", fontSize: 14, color: C.textMuted, lineHeight: 1.65 }}>
        Tell RevisionGrade anything intentional that should not be treated as an error:
        non-linear timeline, dialect, ambiguous identity, withheld names, symbolic pronouns,
        dream logic, fragmented structure, invented language, or culturally specific references.
      </p>
      <textarea
        value={enrichmentNote ?? ""}
        onChange={(e) => onEnrichmentNoteChange?.(e.target.value)}
        placeholder="e.g. The protagonist's gender ambiguity is intentional. The timeline is non-linear by design. Dialect is authentic and should not be 'corrected'. The river is personified as 'she' but is not a human character."
        rows={5}
        style={{
          width: "100%",
          background: C.surfaceAlt,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "12px 14px",
          fontSize: 15,
          color: C.textPrimary,
          resize: "vertical" as const,
          fontFamily: "inherit",
          lineHeight: 1.7,
          outline: "none",
          boxSizing: "border-box" as const,
          minHeight: 120,
        }}
      />
      <p style={{ margin: "8px 0 0", fontSize: 12, color: C.textMuted, lineHeight: 1.6 }}>
        Your note will be saved as <strong>Author Context</strong> and used in the next analysis step
        or re-evaluation. It will not rewrite your manuscript.
      </p>
    </LayerShell>
  );
}

// ─── Layer 2 — POV Structure ─────────────────────────────────────────────────

export function PovStructureLayer({
  data,
}: {
  data?: Record<string, unknown> | null;
}) {
  if (!data || Object.keys(data).length === 0)
    return (
      <LayerShell
        empty
        emptyLabel="POV structure not yet mapped."
        emptyDetail="This layer will appear once the system has analysed narrative perspective across your manuscript."
      />
    );

  const povChars = Array.isArray(data.pov_characters)
    ? (data.pov_characters as Record<string, unknown>[])
    : [];
  const povIdentified = data.pov_identified === true;
  const detectionNote = data.pov_detection_note as string | null | undefined;

  if (!povIdentified && povChars.length === 0)
    return (
      <LayerShell
        empty
        emptyLabel="No POV characters identified."
        emptyDetail="The system could not determine narrative perspective owners for this manuscript. This may indicate an unusual or experimental structure."
      />
    );

  const POV_ROLE_LABEL: Record<string, string> = {
    protagonist: "Protagonist",
    co_protagonist: "Co-Protagonist",
    antagonist: "Antagonist",
    narrator: "Narrator",
    secondary_pov: "Secondary POV",
  };

  const POV_ROLE_TONE: Record<string, "gold" | "oxblood" | "blue" | "neutral"> = {
    protagonist: "gold",
    co_protagonist: "gold",
    antagonist: "oxblood",
    narrator: "gold",
    secondary_pov: "blue",
  };

  const charCount = povChars.length;

  return (
    <LayerShell>
      <LayerTitle
        icon="👁"
        title="POV Structure"
        description={LAYER_DESCRIPTIONS.pov_structure_layer}
        badge={charCount > 0 ? `${charCount} POV ${charCount === 1 ? "character" : "characters"}` : undefined}
        badgeTone="gold"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {povChars.map((char, i) => {
          const name = String(char.canonical_name ?? char.character_id ?? `Character ${i + 1}`);
          const role = String(char.narrative_role ?? "");
          const importance = char.importance_level ? String(char.importance_level) : null;
          const roleLabel = POV_ROLE_LABEL[role] ?? role;
          const roleTone = POV_ROLE_TONE[role] ?? "neutral";

          return (
            <CharacterCard key={i}>
              <div
                style={{
                  display: "flex",
                  justifyContent: "space-between",
                  alignItems: "center",
                  flexWrap: "wrap",
                  gap: 8,
                }}
              >
                <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 16 }}>
                  {name}
                </span>
                <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
                  {role && <Pill label={roleLabel} tone={roleTone} />}
                  {importance && (
                    <Pill
                      label={importance.charAt(0).toUpperCase() + importance.slice(1)}
                      tone="neutral"
                    />
                  )}
                </div>
              </div>
            </CharacterCard>
          );
        })}
      </div>

      {detectionNote && (
        <div style={{ marginTop: 12, padding: "10px 14px", background: C.surfaceAlt, borderRadius: 8 }}>
          <p style={{ margin: 0, fontSize: 13, color: C.textMuted, lineHeight: 1.6 }}>
            <span style={{ fontWeight: 600 }}>System note: </span>
            {detectionNote}
          </p>
        </div>
      )}
    </LayerShell>
  );
}

// ─── Layer 3 — Canonical Identity ────────────────────────────────────────────

// Tier classification for identity cards
type IdentityTier =
  | "core_cast"
  | "named_secondary"
  | "symbolic_collective"
  | "background"
  | "needs_confirmation";

const TIER_LABELS: Record<IdentityTier, string> = {
  core_cast: "Core Cast",
  named_secondary: "Named Secondary",
  symbolic_collective: "Symbolic / Collective Forces",
  background: "Background / One-off",
  needs_confirmation: "Needs Confirmation",
};

const TIER_ORDER: IdentityTier[] = [
  "needs_confirmation",
  "core_cast",
  "named_secondary",
  "symbolic_collective",
  "background",
];

function classifyIdentityTier(id: Record<string, unknown>): IdentityTier {
  const role = String(id.role ?? id.narrative_role ?? "").toLowerCase();
  const importance = String(id.importance_level ?? "").toLowerCase();
  const contradictions = id.contradictions as unknown[] | null;
  const hasContradictions = Array.isArray(contradictions) && contradictions.length > 0;
  const finalStatus = String(id.final_status ?? id.post_resolution_name_states ?? "");
  const isUnresolved = finalStatus.toLowerCase() === "unresolved" && hasContradictions;

  if (isUnresolved || hasContradictions) return "needs_confirmation";

  if (
    role === "protagonist" || role === "co_protagonist" || role === "antagonist" ||
    importance === "primary"
  ) return "core_cast";

  if (
    role === "symbolic_force" || role === "collective_force" || role === "animal_companion"
  ) return "symbolic_collective";

  if (
    role === "mentor" || role === "foil" || role === "secondary" ||
    importance === "major" || importance === "supporting"
  ) return "named_secondary";

  if (importance === "minor" || importance === "background") return "background";

  // Default: if the role looks like a named character, secondary; otherwise background
  if (role === "unknown" || !role) return "background";
  return "named_secondary";
}

function formatResolutionStatus(id: Record<string, unknown>): {
  label: string;
  value: string;
  tone: "neutral" | "gold" | "warn";
} {
  const postRes = id.post_resolution_name_states;
  const finalStatus = String(id.final_status ?? "");
  const canonicalName = String(id.canonical_name ?? id.name ?? "");

  if (typeof postRes === "string" && postRes.toLowerCase() !== "unresolved" && postRes) {
    return { label: "Resolved as", value: postRes, tone: "gold" };
  }

  if (finalStatus && finalStatus.toLowerCase() !== "unresolved") {
    return { label: "Resolved as", value: canonicalName || finalStatus, tone: "gold" };
  }

  const contradictions = id.contradictions as unknown[] | null;
  if (Array.isArray(contradictions) && contradictions.length > 0) {
    return { label: "Resolution status", value: "Needs author confirmation", tone: "warn" };
  }

  return { label: "Resolution status", value: "No rename detected", tone: "neutral" };
}

function IdentityCard({ id, index }: { id: Record<string, unknown>; index: number }) {
  const name = String(id.canonical_name ?? id.name ?? `Character ${index + 1}`);
  const aliases = id.aliases as string[] | null;
  const pronouns = id.pronouns;
  const role = id.role;
  const legalNames = id.legal_name_states;
  const captivityNames = id.captivity_name_states;
  const anchors = id.evidence_anchors as string[] | null;
  const resolution = formatResolutionStatus(id);

  return (
    <CharacterCard>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          flexWrap: "wrap",
          gap: 10,
          marginBottom: 12,
        }}
      >
        <h4
          style={{
            margin: 0,
            fontSize: 18,
            fontWeight: 700,
            color: C.textPrimary,
            letterSpacing: "-0.01em",
          }}
        >
          {name}
        </h4>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
          {role && (
            <Pill
              label={String(role)}
              tone={
                String(role).includes("protagonist")
                  ? "gold"
                  : String(role).includes("antagonist")
                    ? "oxblood"
                    : "neutral"
              }
            />
          )}
          {pronouns && <Pill label={String(pronouns)} tone="blue" />}
        </div>
      </div>

      {aliases && aliases.length > 0 && (
        <div style={{ marginBottom: 12 }}>
          <p {...sectionHeaderProps("Aliases & Name States")}>
            Aliases &amp; Name States
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {aliases.map((a, j) => (
              <Pill key={j} label={a} tone="neutral" />
            ))}
          </div>
        </div>
      )}

      <div>
        {legalNames && (
          <FieldRow label="Legal name states" value={legalNames} />
        )}
        {captivityNames && (
          <FieldRow label="Captivity name states" value={captivityNames} />
        )}
        <FieldRow
          label={resolution.label}
          value={resolution.value}
        />
      </div>

      {anchors && anchors.length > 0 && (
        <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
          {anchors.map((a, j) => (
            <EvidenceTag key={j} id={a} />
          ))}
        </div>
      )}
    </CharacterCard>
  );
}

function CompactIdentityRow({ id, index }: { id: Record<string, unknown>; index: number }) {
  const name = String(id.canonical_name ?? id.name ?? `Entity ${index + 1}`);
  const role = id.role;
  const aliases = id.aliases as string[] | null;
  const aliasCount = aliases?.length ?? 0;

  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        background: C.surfaceAlt,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
      }}
    >
      <span style={{ fontSize: 14, fontWeight: 600, color: C.textPrimary, flex: 1, minWidth: 0 }}>
        {name}
      </span>
      {role && <Pill label={String(role)} tone="neutral" />}
      {aliasCount > 0 && (
        <span style={{ fontSize: 11, color: C.textMuted }}>
          {aliasCount} alias{aliasCount !== 1 ? "es" : ""}
        </span>
      )}
    </div>
  );
}

function TierSection({
  tier,
  identities,
  defaultExpanded,
  compact,
}: {
  tier: IdentityTier;
  identities: Record<string, unknown>[];
  defaultExpanded: boolean;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const count = identities.length;
  if (count === 0) return null;

  const tierColor = tier === "needs_confirmation" ? "#E6A23C"
    : tier === "core_cast" ? C.gold
    : C.textMuted;

  return (
    <div style={{ marginBottom: 8 }}>
      <button
        type="button"
        onClick={() => setExpanded((v) => !v)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          padding: "10px 14px",
          background: expanded ? C.surfaceAlt : "transparent",
          border: `1px solid ${expanded ? C.borderStrong : C.border}`,
          borderRadius: 10,
          cursor: "pointer",
          textAlign: "left" as const,
        }}
      >
        <span style={{ fontSize: 14, color: tierColor, transform: expanded ? "rotate(90deg)" : "rotate(0deg)", transition: "transform 0.15s" }}>
          ▸
        </span>
        <span style={{ fontSize: 13, fontWeight: 700, color: tierColor, letterSpacing: "0.04em", textTransform: "uppercase" as const }}>
          {TIER_LABELS[tier]}
        </span>
        <span style={{
          fontSize: 11,
          fontWeight: 700,
          color: tierColor,
          background: tier === "needs_confirmation" ? C.warnLight
            : tier === "core_cast" ? C.goldLight
            : "rgba(255,255,255,0.06)",
          padding: "2px 8px",
          borderRadius: 6,
        }}>
          {count}
        </span>
        {!expanded && (
          <span style={{ fontSize: 12, color: C.textFaint, marginLeft: "auto" }}>
            {identities.slice(0, 4).map((id) => String(id.canonical_name ?? id.name ?? "")).filter(Boolean).join(", ")}
            {count > 4 ? `, +${count - 4} more` : ""}
          </span>
        )}
      </button>
      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 14, marginTop: 10, paddingLeft: 12 }}>
          {identities.map((id, i) =>
            compact
              ? <CompactIdentityRow key={i} id={id} index={i} />
              : <IdentityCard key={i} id={id} index={i} />
          )}
        </div>
      )}
    </div>
  );
}

export function CanonicalIdentityLayer({
  data,
}: {
  data?: Record<string, unknown> | null;
}) {
  if (!data || Object.keys(data).length === 0)
    return (
      <LayerShell
        empty
        emptyLabel="Canonical identity mapping not yet built."
        emptyDetail="This layer will populate once the manuscript has been processed."
      />
    );

  const groups = data.canonical_identity_group as unknown[] | null;
  const singleGroup = data.canonical_name ?? data.canonical_identity;

  const identities: Record<string, unknown>[] = groups
    ? (groups as Record<string, unknown>[])
    : singleGroup
      ? [data as Record<string, unknown>]
      : [];

  if (identities.length === 0) {
    return (
      <LayerShell>
        <LayerTitle
          icon="🪪"
          title="Canonical Identity"
          description={LAYER_DESCRIPTIONS.canonical_identity_layer}
        />
        <div
          style={{
            background: C.surfaceAlt,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "20px 22px",
          }}
        >
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 15,
              fontWeight: 600,
              color: C.textPrimary,
              lineHeight: 1.5,
            }}
          >
            No identity groups extracted yet.
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: C.textMuted,
              lineHeight: 1.8,
              maxWidth: "60ch",
            }}
          >
            This is common in first-person narratives where the protagonist moves through the
            story under shifting names and aliases — the system may have tracked the alias
            shifts inside individual chapters rather than consolidating them into a single
            identity group. If your main character uses multiple names (legal, captivity,
            assumed), check the Cast & Role Tier layer where they may have been catalogued
            as a primary character entry.
          </p>
        </div>
      </LayerShell>
    );
  }

  // Group identities by tier
  const tierGroups: Record<IdentityTier, Record<string, unknown>[]> = {
    core_cast: [],
    named_secondary: [],
    symbolic_collective: [],
    background: [],
    needs_confirmation: [],
  };
  for (const id of identities) {
    tierGroups[classifyIdentityTier(id)].push(id);
  }

  // Count non-empty tiers for the summary
  const tierCounts = TIER_ORDER
    .map((t) => ({ tier: t, count: tierGroups[t].length }))
    .filter((t) => t.count > 0);

  return (
    <LayerShell>
      <LayerTitle
        icon="🪪"
        title="Canonical Identity"
        description={LAYER_DESCRIPTIONS.canonical_identity_layer}
        badge={`${identities.length} ${identities.length === 1 ? "identity" : "identities"}`}
        badgeTone="gold"
      />

      {/* Summary bar */}
      <div style={{
        display: "flex",
        flexWrap: "wrap",
        gap: 12,
        marginBottom: 16,
        padding: "10px 14px",
        background: C.surfaceAlt,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
      }}>
        {tierCounts.map(({ tier, count }) => (
          <span key={tier} style={{ fontSize: 12, color: C.textMuted }}>
            <span style={{
              fontWeight: 700,
              color: tier === "needs_confirmation" ? "#E6A23C"
                : tier === "core_cast" ? C.gold
                : C.textPrimary,
            }}>
              {count}
            </span>
            {" "}{TIER_LABELS[tier].toLowerCase()}
          </span>
        ))}
      </div>

      {/* Tier sections */}
      <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
        {TIER_ORDER.map((tier) => (
          <TierSection
            key={tier}
            tier={tier}
            identities={tierGroups[tier]}
            defaultExpanded={tier === "core_cast" || tier === "needs_confirmation"}
            compact={tier === "background" || tier === "symbolic_collective"}
          />
        ))}
      </div>
    </LayerShell>
  );
}

// ─── Layer 4 — Cast & Role Tier ───────────────────────────────────────────────

const TIER_MAP_ORDER = [
  "protagonist",
  "co_protagonist",
  "antagonist",
  "pressure_agent",
  "romantic_catalyst",
  "sexual_destabilizer",
  "patriarchal_pressure",
  "artistic_countermodel",
  "domestic_foil",
  "social_observer",
  "social_catalyst",
  "secondary",
  "foil",
  "mentor",
  "animal_companion",
  "symbolic_force",
  "collective_force",
  "background_mention",
  "unknown",
] as const;

const TIER_DISPLAY: Record<string, string> = {
  protagonist: "Protagonist",
  co_protagonist: "Co-Protagonist",
  antagonist: "Antagonist",
  pressure_agent: "Pressure Agent",
  romantic_catalyst: "Romantic Catalyst",
  sexual_destabilizer: "Sexual Destabilizer",
  patriarchal_pressure: "Patriarchal Pressure",
  artistic_countermodel: "Artistic Counter-Model",
  domestic_foil: "Domestic / Maternal Foil",
  social_observer: "Social Observer",
  social_catalyst: "Social Catalyst",
  secondary: "Secondary Cast",
  foil: "Foil",
  mentor: "Mentor",
  animal_companion: "Animal Companion",
  symbolic_force: "Symbolic Force",
  collective_force: "Collective Force",
  background_mention: "Background Mention",
  unknown: "Uncategorised",
};

const TIER_TONE: Record<string, "gold" | "oxblood" | "blue" | "neutral"> = {
  protagonist: "gold",
  co_protagonist: "gold",
  antagonist: "oxblood",
  pressure_agent: "oxblood",
  romantic_catalyst: "blue",
  sexual_destabilizer: "oxblood",
  patriarchal_pressure: "oxblood",
  artistic_countermodel: "blue",
  domestic_foil: "blue",
  social_observer: "neutral",
  social_catalyst: "neutral",
  secondary: "blue",
  foil: "blue",
  mentor: "blue",
  animal_companion: "neutral",
  symbolic_force: "neutral",
  collective_force: "neutral",
  background_mention: "neutral",
  unknown: "neutral",
};

type TierEntry = {
  character_id?: string;
  canonical_name?: string;
  importance_level?: string;
};

export function CastRoleTierLayer({
  data,
}: {
  data?: Record<string, unknown> | null;
}) {
  const tierMap = (data?.tier_map as Record<string, TierEntry[]> | undefined) ?? null;
  const hasNewSchema = tierMap !== null;

  if (!data || Object.keys(data).length === 0) {
    return (
      <LayerShell
        empty
        emptyLabel="Cast and role tiers not yet extracted."
        emptyDetail="This layer will populate once the full cast has been analysed."
      />
    );
  }

  const totalCast = hasNewSchema
    ? (data.total_cast as number | undefined) ?? 0
    : TIER_MAP_ORDER.reduce((sum, key) => {
        const val = data[key];
        if (Array.isArray(val)) return sum + val.length;
        if (val) return sum + 1;
        return sum;
      }, 0);

  const hasAntagonists = hasNewSchema
    ? ((data.antagonist_count as number | undefined) ?? 0) > 0 ||
      (Array.isArray(tierMap?.["antagonist"]) && (tierMap?.["antagonist"]?.length ?? 0) > 0)
    : ((data.antagonist as unknown[]) ?? []).length > 0 ||
      ((data.complex_antagonist as unknown[]) ?? []).length > 0;

  const relationalEngines = Array.isArray(data.relational_engines)
    ? (data.relational_engines as string[])
    : [];

  const majorSecondary = Array.isArray(data.major_secondary_characters)
    ? (data.major_secondary_characters as string[])
    : [];

  return (
    <LayerShell tone={!hasAntagonists ? "warn" : "neutral"}>
      <LayerTitle
        icon="🎭"
        title="Cast & Role Tier"
        description={LAYER_DESCRIPTIONS.cast_role_tier_layer}
        badge={`${totalCast} characters`}
        badgeTone="gold"
      />

      {!hasAntagonists && (
        <WarnBanner reason="No antagonists detected. This may affect threat-driven scoring." />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {TIER_MAP_ORDER.map((tier) => {
          let entries: string[] = [];

          if (hasNewSchema && tierMap) {
            const raw = tierMap[tier];
            if (!Array.isArray(raw) || raw.length === 0) return null;
            entries = raw.map((e) => e.canonical_name ?? e.character_id ?? "Unknown");
          } else {
            const val = data[tier];
            if (!val) return null;
            entries = Array.isArray(val) ? (val as string[]).filter(Boolean) : [String(val)];
          }

          if (entries.length === 0) return null;

          const displayLabel = TIER_DISPLAY[tier] ?? tier;
          return (
            <div key={tier}>
              <p {...sectionHeaderProps(displayLabel)}>
                {displayLabel}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
                {entries.map((name, i) => (
                  <Pill key={i} label={name} tone={TIER_TONE[tier] ?? "neutral"} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {relationalEngines.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p {...sectionHeaderProps("Relational Engines")}>
            Relational Engines
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {relationalEngines.map((pair, i) => (
              <Pill key={i} label={pair} tone="neutral" />
            ))}
          </div>
        </div>
      )}

      {!hasNewSchema && majorSecondary.length > 0 && (
        <div style={{ marginTop: 16 }}>
          <p {...sectionHeaderProps("Major Secondary")}>
            Major Secondary
          </p>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {majorSecondary.map((name, i) => (
              <Pill key={i} label={name} tone="blue" />
            ))}
          </div>
        </div>
      )}
    </LayerShell>
  );
}

// ─── Layer 5 — Relationship Network ──────────────────────────────────────────

export function RelationshipNetworkLayer({
  data,
  castData,
}: {
  data?: Record<string, unknown> | null;
  castData?: Record<string, unknown> | null;
}) {
  if (!data || Object.keys(data).length === 0)
    return (
      <LayerShell
        empty
        emptyLabel="Relationship network not yet mapped."
        emptyDetail="Sustained relationships between named characters will appear here once the manuscript has been analysed."
      />
    );

  const pairs = data.relationship_pairs ?? data.pairs ?? data.relationships;
  const rawPairs: Record<string, unknown>[] = Array.isArray(pairs)
    ? (pairs as Record<string, unknown>[])
    : [];

  // Filter out label-only relationships (author rule: no name = no relationship)
  const pairArray = rawPairs.filter((pair) => {
    const a = String(pair.character_a ?? pair.from ?? pair.a ?? "");
    const b = String(pair.character_b ?? pair.to ?? pair.b ?? "");
    return !isLabelOnly(a) && !isLabelOnly(b) && a !== "—" && b !== "—";
  });

  const filtered = rawPairs.length - pairArray.length;

  // ── Relational-engine fallback ──────────────────────────────────────────────
  // If the relationship layer has no qualifying pairs but Cast/Role Tier found
  // relational engines, promote those engines as inferred relationship pairs so
  // the author still sees the story's relationship architecture.
  let inferredFromEngines: { a: string; b: string }[] = [];
  if (pairArray.length === 0 && castData) {
    const engines = castData.relational_engines;
    if (Array.isArray(engines)) {
      inferredFromEngines = (engines as (string | Record<string, unknown>)[])
        .map((e) => {
          if (typeof e === "string") {
            // "Name A–Name B" or "Name A — Name B"
            const sep = e.includes("–") ? "–" : e.includes("—") ? "—" : "↔";
            const parts = e.split(sep).map((s) => s.trim());
            if (parts.length === 2 && parts[0] && parts[1]) return { a: parts[0], b: parts[1] };
          }
          return null;
        })
        .filter((x): x is { a: string; b: string } => x !== null);
    }
  }

  const count = pairArray.length + inferredFromEngines.length;

  return (
    <LayerShell>
      <LayerTitle
        icon="🔗"
        title="Relationship Network"
        description={LAYER_DESCRIPTIONS.relationship_network_layer}
        badge={count > 0 ? `${count} pairs` : undefined}
        badgeTone="neutral"
      />

      {filtered > 0 && (
        <div
          style={{
            background: "rgba(255,255,255,0.03)",
            border: `1px solid ${C.border}`,
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: C.textFaint,
            lineHeight: 1.6,
          }}
        >
          {filtered} label-only {filtered === 1 ? "entry" : "entries"} removed
          (unnamed or descriptor-only parties are not tracked as relationships).
        </div>
      )}

      {inferredFromEngines.length > 0 && pairArray.length === 0 && (
        <div
          style={{
            background: "rgba(200,169,110,0.06)",
            border: `1px solid ${C.gold}33`,
            borderRadius: 8,
            padding: "10px 14px",
            marginBottom: 16,
            fontSize: 13,
            color: C.textMuted,
            lineHeight: 1.6,
          }}
        >
          These pairs were inferred from the Cast / Role Tier relational engines.
          Relationship details (type, arc, pivot moments) may be incomplete.
        </div>
      )}

      {count === 0 ? (
        <div
          style={{
            background: C.surfaceAlt,
            border: `1px solid ${C.border}`,
            borderRadius: 10,
            padding: "20px 22px",
          }}
        >
          <p
            style={{
              margin: "0 0 10px",
              fontSize: 15,
              fontWeight: 600,
              color: C.textPrimary,
            }}
          >
            No qualifying relationship pairs found.
          </p>
          <p
            style={{
              margin: 0,
              fontSize: 14,
              color: C.textMuted,
              lineHeight: 1.8,
              maxWidth: "60ch",
            }}
          >
            Only sustained relationships between named characters are recorded here.
            Single-scene encounters and interactions with unnamed parties do not qualify.
          </p>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
          {pairArray.map((pair, i) => {
            const a = String(pair.character_a ?? pair.from ?? pair.a ?? "—");
            const b = String(pair.character_b ?? pair.to ?? pair.b ?? "—");
            const types = pair.relationship_type ?? pair.type;
            const typeStart = pair.relationship_type_start;
            const typeEnd = pair.relationship_type_end;
            const typeArr: string[] = Array.isArray(types)
              ? (types as string[])
              : types
                ? [String(types)]
                : [];
            // Fall back to start/end fields from pipeline when relationship_type is absent
            if (typeArr.length === 0 && (typeStart || typeEnd)) {
              const startStr = typeStart ? String(typeStart) : "";
              const endStr = typeEnd ? String(typeEnd) : "";
              if (startStr && endStr && startStr !== endStr) {
                typeArr.push(`${startStr} → ${endStr}`);
              } else {
                typeArr.push(startStr || endStr);
              }
            }
            const evidenceAnchors = pair.evidence_anchors as string[] | null;

            return (
              <CharacterCard key={i}>
                <div
                  style={{
                    display: "flex",
                    alignItems: "center",
                    gap: 12,
                    flexWrap: "wrap",
                    marginBottom: 12,
                  }}
                >
                  <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 16 }}>
                    {a}
                  </span>
                  <span style={{ color: C.gold, fontSize: 16 }}>↔</span>
                  <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 16 }}>
                    {b}
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {typeArr.map((t, j) => (
                      <Pill key={j} label={t.replace(/_/g, " ")} tone="blue" />
                    ))}
                  </div>
                </div>

                <div>
                  {pair.relationship_origin && (
                    <FieldRow label="Origin" value={pair.relationship_origin} />
                  )}
                  {pair.initial_dynamic && (
                    <FieldRow label="Initial dynamic" value={pair.initial_dynamic} />
                  )}
                  {pair.pressure_points && (
                    <FieldRow label="Pressure" value={pair.pressure_points} />
                  )}
                  {pair.rupture_or_separation && (
                    <FieldRow
                      label="Rupture / separation"
                      value={pair.rupture_or_separation}
                    />
                  )}
                  {pair.transformation && (
                    <FieldRow label="Transformation" value={pair.transformation} />
                  )}
                  {pair.current_or_final_state && (
                    <FieldRow
                      label="Current / final state"
                      value={pair.current_or_final_state}
                    />
                  )}
                </div>

                {evidenceAnchors && evidenceAnchors.length > 0 && (
                  <div style={{ marginTop: 12, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {evidenceAnchors.map((a, j) => (
                      <EvidenceTag key={j} id={a} />
                    ))}
                  </div>
                )}
              </CharacterCard>
            );
          })}

          {/* Inferred pairs from relational engines (fallback) */}
          {inferredFromEngines.map((eng, i) => (
            <CharacterCard key={`inferred-${i}`}>
              <div
                style={{
                  display: "flex",
                  alignItems: "center",
                  gap: 12,
                  flexWrap: "wrap",
                  marginBottom: 8,
                }}
              >
                <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 16 }}>
                  {eng.a}
                </span>
                <span style={{ color: C.gold, fontSize: 16 }}>↔</span>
                <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 16 }}>
                  {eng.b}
                </span>
                <Pill label="inferred from Cast/Role Tier" tone="gold" />
              </div>
            </CharacterCard>
          ))}
        </div>
      )}
    </LayerShell>
  );
}

// ─── Layer 6 — Object / Symbol ────────────────────────────────────────────────

type ObjectTier = "key_evidence" | "symbolic_motif" | "scene_prop" | "background";

const OBJ_TIER_LABELS: Record<ObjectTier, string> = {
  key_evidence: "Key Evidence",
  symbolic_motif: "Symbolic / Motif",
  scene_prop: "Scene Props",
  background: "Background",
};

const OBJ_TIER_ORDER: ObjectTier[] = [
  "key_evidence",
  "symbolic_motif",
  "scene_prop",
  "background",
];

function classifyObjectTier(
  item: Record<string, unknown>,
  narrativeFunction: string | null,
): ObjectTier {
  const critical = item.missed_if_absent_from_report === true;
  const transfers = Array.isArray(item.transfer_events) ? item.transfer_events : [];
  const fn = (narrativeFunction ?? "").toLowerCase();
  const name = String(item.object_name ?? item.name ?? "").toLowerCase();

  // ── Symbolic / Motif — recurring thematic weight ──────────────────────
  const symbolicKeywords = [
    "symbol", "metaphor", "motif", "teaching", "authority", "rootedness",
    "marker", "cultural", "tradition", "ritual", "memory", "listening",
    "respecting", "power", "freedom", "awakening", "confinement", "flight",
    "death", "nature", "identity", "rebellion", "independence", "personif",
    "recur", "thematic", "represents", "embodies", "signif",
  ];
  if (symbolicKeywords.some((kw) => fn.includes(kw))) return "symbolic_motif";

  // ── Key Evidence — objects that drive plot resolution or reveal info ───
  // Only promote to Key Evidence when the object actually drives plot
  // (transfers hands, is flagged critical, or has hard evidence keywords).
  // Having a payoff description alone is not enough — scene props can
  // have payoff text too (e.g. "used as conversational prop").
  const evidenceKeywords = [
    "evidence", "investigation", "document", "shareholder",
    "corporate", "institutional", "mystery",
    "official", "clue", "proof", "reveal", "confession", "testament",
  ];
  if (critical || transfers.length > 0) return "key_evidence";
  if (evidenceKeywords.some((kw) => fn.includes(kw))) return "key_evidence";

  // ── Scene Props — atmosphere, social context, character detail ─────────
  const propKeywords = [
    "tool", "wrench", "truck", "roll", "tube", "strap",
    "prop", "habit", "leisure", "conversational", "nervous", "composure",
    "social", "camaraderie", "gift", "provider",
  ];
  if (propKeywords.some((kw) => fn.includes(kw))) return "scene_prop";
  if (propKeywords.some((kw) => name.includes(kw))) return "scene_prop";

  if (!fn) return "background";
  return "scene_prop";
}

function ObjectCard({
  item,
  index,
  narrativeFunction,
}: {
  item: Record<string, unknown>;
  index: number;
  narrativeFunction: string | null;
}) {
  const name = String(item.object_name ?? item.name ?? `Object ${index + 1}`);
  const holder = item.current_holder ? String(item.current_holder) : null;
  const attachedChars = Array.isArray(item.attached_characters)
    ? (item.attached_characters as unknown[]).map((c) => String(c)).filter((c) => c !== holder)
    : [];
  const transfers = Array.isArray(item.transfer_events) ? (item.transfer_events as unknown[]) : [];
  const payoff = item.payoff_description ? String(item.payoff_description) : null;
  const critical = item.missed_if_absent_from_report === true;

  return (
    <CharacterCard>
      <div
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "flex-start",
          flexWrap: "wrap",
          gap: 8,
          marginBottom: narrativeFunction ? 8 : 12,
        }}
      >
        <span
          style={{
            fontWeight: 700,
            color: C.textPrimary,
            fontSize: 16,
            letterSpacing: "-0.01em",
          }}
        >
          {name}
        </span>
        {critical && <Pill label="Story-critical" tone="warn" />}
      </div>

      {narrativeFunction && (
        <p
          style={{
            margin: "0 0 12px",
            fontSize: 14,
            color: C.textMuted,
            fontStyle: "italic",
            lineHeight: 1.65,
          }}
        >
          {narrativeFunction}
        </p>
      )}

      {(holder || attachedChars.length > 0) && (
        <div
          style={{
            display: "flex",
            flexWrap: "wrap",
            gap: 8,
            alignItems: "center",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 12,
              color: C.textMuted,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            Held by
          </span>
          {holder && <Pill label={holder} tone="neutral" />}
          {attachedChars.map((c, j) => (
            <Pill key={j} label={c} tone="neutral" />
          ))}
        </div>
      )}

      {payoff && (
        <p style={{ margin: "8px 0 0", fontSize: 14, color: C.textMuted, lineHeight: 1.65 }}>
          <span style={{ fontWeight: 600, color: C.textPrimary }}>Payoff: </span>
          {payoff}
        </p>
      )}

      {transfers.length > 0 && (
        <div style={{ marginTop: 8 }}>
          <span
            style={{
              fontSize: 12,
              color: C.textMuted,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            Changed hands
          </span>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6, marginTop: 4 }}>
            {transfers.map((t, j) => (
              <Pill
                key={j}
                label={typeof t === "object" ? JSON.stringify(t) : String(t)}
                tone="neutral"
              />
            ))}
          </div>
        </div>
      )}
    </CharacterCard>
  );
}

function CompactObjectRow({
  item,
  index,
}: {
  item: Record<string, unknown>;
  index: number;
}) {
  const name = String(item.object_name ?? item.name ?? `Object ${index + 1}`);
  const holder = item.current_holder ? String(item.current_holder) : null;
  return (
    <div
      style={{
        display: "flex",
        alignItems: "center",
        gap: 10,
        padding: "8px 14px",
        background: C.surfaceAlt,
        border: `1px solid ${C.border}`,
        borderRadius: 8,
        fontSize: 14,
      }}
    >
      <span style={{ fontWeight: 600, color: C.textPrimary, flex: 1 }}>{name}</span>
      {holder && <Pill label={holder} tone="neutral" />}
    </div>
  );
}

function ObjectTierSection({
  tier,
  objects,
  functionByName,
  defaultExpanded,
  compact,
}: {
  tier: ObjectTier;
  objects: Record<string, unknown>[];
  functionByName: Record<string, string>;
  defaultExpanded: boolean;
  compact?: boolean;
}) {
  const [expanded, setExpanded] = React.useState(defaultExpanded);
  const label = OBJ_TIER_LABELS[tier];
  const names = objects
    .slice(0, 4)
    .map((o) => String(o.object_name ?? o.name ?? ""))
    .filter(Boolean);
  const preview = names.join(", ") + (objects.length > 4 ? ` +${objects.length - 4} more` : "");

  return (
    <div style={{ marginBottom: 16 }}>
      <button
        onClick={() => setExpanded((p) => !p)}
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          width: "100%",
          background: "none",
          border: "none",
          cursor: "pointer",
          padding: "8px 0",
          textAlign: "left",
        }}
      >
        <span style={{ color: C.gold, fontSize: 13, width: 18, textAlign: "center" }}>
          {expanded ? "▾" : "▸"}
        </span>
        <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 15 }}>{label}</span>
        <span
          style={{
            fontSize: 12,
            fontWeight: 600,
            color: C.gold,
            background: "rgba(169,142,74,0.12)",
            padding: "2px 8px",
            borderRadius: 10,
          }}
        >
          {objects.length}
        </span>
        {!expanded && (
          <span
            style={{
              fontSize: 13,
              color: C.textFaint,
              flex: 1,
              overflow: "hidden",
              textOverflow: "ellipsis",
              whiteSpace: "nowrap",
            }}
          >
            {preview}
          </span>
        )}
      </button>

      {expanded && (
        <div style={{ display: "flex", flexDirection: "column", gap: compact ? 6 : 14, marginTop: 8, marginLeft: 28 }}>
          {objects.map((obj, i) => {
            const name = String(obj.object_name ?? obj.name ?? "");
            const fn = functionByName[name] ?? null;
            return compact ? (
              <CompactObjectRow key={i} item={obj} index={i} />
            ) : (
              <ObjectCard key={i} item={obj} index={i} narrativeFunction={fn} />
            );
          })}
        </div>
      )}
    </div>
  );
}

export function ObjectSymbolLayer({
  data,
}: {
  data?: Record<string, unknown> | null;
}) {
  if (!data || Object.keys(data).length === 0)
    return (
      <LayerShell
        empty
        emptyLabel="Object and symbol ledger not yet populated."
        emptyDetail="Significant objects and their lifecycle will appear here once the manuscript has been analysed."
      />
    );

  const items = data.objects ?? data.symbols ?? data.items ?? data.object_list;
  const itemArray: Record<string, unknown>[] = Array.isArray(items)
    ? (items as Record<string, unknown>[])
    : [];

  const payoffItems = Array.isArray(data.symbol_payoff_items_v1)
    ? (data.symbol_payoff_items_v1 as Record<string, unknown>[])
    : [];
  const functionByName: Record<string, string> = {};
  for (const p of payoffItems) {
    const key = String(p.object ?? "");
    const fn = p.first_function ? String(p.first_function) : null;
    if (key && fn) functionByName[key] = fn;
  }

  // Group objects by tier
  const tierGroups: Record<ObjectTier, Record<string, unknown>[]> = {
    key_evidence: [],
    symbolic_motif: [],
    scene_prop: [],
    background: [],
  };
  for (const item of itemArray) {
    const name = String(item.object_name ?? item.name ?? "");
    const fn = functionByName[name] ?? null;
    const tier = classifyObjectTier(item, fn);
    tierGroups[tier].push(item);
  }

  const nonEmptyTiers = OBJ_TIER_ORDER.filter((t) => tierGroups[t].length > 0);

  return (
    <LayerShell>
      <LayerTitle
        icon="🗡"
        title="Objects & Symbols"
        description={LAYER_DESCRIPTIONS.object_symbol_layer}
        badge={itemArray.length > 0 ? `${itemArray.length} objects` : undefined}
        badgeTone="gold"
      />

      {itemArray.length === 0 ? (
        <p style={{ color: C.textFaint, fontSize: 15, lineHeight: 1.75 }}>
          No objects or symbols extracted yet.
        </p>
      ) : (
        <>
          {/* Summary bar */}
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 16,
              marginBottom: 20,
              fontSize: 13,
              color: C.textMuted,
            }}
          >
            {nonEmptyTiers.map((t) => (
              <span key={t}>
                <span style={{ fontWeight: 600, color: C.textPrimary }}>
                  {OBJ_TIER_LABELS[t]}:
                </span>{" "}
                {tierGroups[t].length}
              </span>
            ))}
          </div>

          {nonEmptyTiers.map((tier) => (
            <ObjectTierSection
              key={tier}
              tier={tier}
              objects={tierGroups[tier]}
              functionByName={functionByName}
              defaultExpanded={tier === "key_evidence" || tier === "symbolic_motif"}
              compact={tier === "scene_prop" || tier === "background"}
            />
          ))}
        </>
      )}
    </LayerShell>
  );
}

// ─── Layer 7 — Location · Timeline · World State ──────────────────────────────

function TimelineCard({
  snapshot,
  timeline,
}: {
  snapshot: Record<string, unknown>;
  timeline: Record<string, unknown> | null;
}) {
  const name = String(snapshot.nameUsed ?? snapshot.characterId ?? "Unknown");
  const location = snapshot.location ? String(snapshot.location) : null;
  const role = snapshot.jobOrRole ? String(snapshot.jobOrRole) : null;
  const psych = snapshot.psychologicalState ? String(snapshot.psychologicalState) : null;
  const confidence = snapshot.confidence ? String(snapshot.confidence).replace(/_/g, " ") : null;
  const health = snapshot.healthState ? String(snapshot.healthState) : null;
  const mobility = snapshot.mobilityStatus ? String(snapshot.mobilityStatus) : null;
  const legal = snapshot.legalStatus ? String(snapshot.legalStatus) : null;
  const age = snapshot.ageOrLifeStage ? String(snapshot.ageOrLifeStage) : null;

  const locSeq = timeline
    ? (Array.isArray((timeline as Record<string, unknown>).locationSequence)
        ? ((timeline as Record<string, unknown>).locationSequence as string[])
        : [])
    : [];

  return (
    <CharacterCard>
      <div
        style={{
          display: "flex",
          alignItems: "center",
          gap: 10,
          flexWrap: "wrap",
          marginBottom: 10,
        }}
      >
        <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 16 }}>
          {name}
        </span>
        {confidence && <Pill label={confidence} tone="neutral" />}
      </div>

      {location && <FieldRow label="Location" value={location} />}
      {role && <FieldRow label="Role" value={role} />}
      {psych && <FieldRow label="Psychological state" value={psych} />}
      {health && <FieldRow label="Health" value={health} />}
      {mobility && <FieldRow label="Mobility" value={mobility} />}
      {legal && <FieldRow label="Legal status" value={legal} />}
      {age && <FieldRow label="Age / life stage" value={age} />}

      {locSeq.length > 1 && (
        <div style={{ marginTop: 8 }}>
          <span
            style={{
              fontSize: 12,
              color: C.textMuted,
              fontWeight: 600,
              letterSpacing: "0.04em",
            }}
          >
            Movement path
          </span>
          <div style={{ display: "flex", gap: 6, flexWrap: "wrap", marginTop: 4 }}>
            {locSeq.map((loc, j) => (
              <React.Fragment key={j}>
                {j > 0 && <span style={{ color: C.gold, fontSize: 13 }}>→</span>}
                <Pill label={loc.length > 50 ? loc.slice(0, 47) + "…" : loc} tone="neutral" />
              </React.Fragment>
            ))}
          </div>
        </div>
      )}
    </CharacterCard>
  );
}

// ── Location normalizer ──────────────────────────────────────────────────────
// Itinerary strings like "Beach and cottage porch at Grand Isle; bedroom..."
// are split on common delimiters and deduped into canonical place tokens.
function normalizeLocations(rawLocations: string[]): string[] {
  const seen = new Set<string>();
  const result: string[] = [];
  for (const raw of rawLocations) {
    // Split on semicolons, commas followed by "then"/"later"/"and", or standalone delimiters
    const fragments = raw
      .split(/[;]|,\s*(?:then|later|and then)\b|(?:^|\s)then\s|(?:^|\s)later\s/i)
      .map((f) => f.trim())
      .filter(Boolean);
    for (const frag of fragments) {
      // Strip leading temporal/connective phrases
      const cleaned = frag
        .replace(/^(?:then|later|and|back)\s+(?:at|in|on|to)?\s*/i, "")
        .replace(/\s+at\s+(?:the\s+)?(?:far\s+)?end\b.*$/i, "")
        .trim();
      if (!cleaned || cleaned.length < 2) continue;
      // Extract the core place name — drop trailing character references
      const place = cleaned
        .replace(/\s+with\s+.*$/i, "")
        .replace(/\s+by\s+(?:afternoon|morning|evening|night|day)\b.*$/i, "")
        .replace(/\s+in\s+(?:company|speculation)\b.*$/i, "")
        .trim();
      if (!place || place.length < 2) continue;
      // Capitalize first letter for display
      const display = place.charAt(0).toUpperCase() + place.slice(1);
      const key = display.toLowerCase().replace(/[^a-z0-9\s]/g, "");
      if (!seen.has(key)) {
        seen.add(key);
        result.push(display);
      }
    }
  }
  return result;
}

// ── State conflict formatter ─────────────────────────────────────────────────
// Converts raw JSON conflict objects to plain-English warnings.
function formatConflict(c: Record<string, unknown>): string {
  const charId = String(c.characterId ?? "");
  const field = String(c.field ?? "");
  const claimA = String(c.claimA ?? "");
  const claimB = String(c.claimB ?? "");
  if (field === "co_presence" && charId) {
    const names = charId.split("+").map((n) => n.trim()).filter(Boolean);
    if (names.length === 2) {
      return `${names[0]} and ${names[1]} have inconsistent first co-presence markers across extraction passes (${claimA} vs. ${claimB}). This may reflect extraction-pass disagreement, not a manuscript error.`;
    }
  }
  if (charId && claimA && claimB) {
    return `${charId}: ${field} conflict — ${claimA} vs. ${claimB}.`;
  }
  return `Timeline consistency check: ${claimA || claimB || String(c.conflictId ?? "unknown")}`;
}

export function LocationTimelineWorldstateLayer({
  data,
}: {
  data?: Record<string, unknown> | null;
}) {
  if (!data || Object.keys(data).length === 0)
    return (
      <LayerShell
        empty
        emptyLabel="Location and timeline map not yet built."
        emptyDetail="Movement paths, world-state rules, and place sequences will appear here once the manuscript has been analysed."
      />
    );

  // Pipeline v1 schema: unique_locations, all_state_snapshots, character_timelines
  const uniqueLocations = Array.isArray(data.unique_locations)
    ? (data.unique_locations as string[])
    : [];
  const stateSnapshots = Array.isArray(data.all_state_snapshots)
    ? (data.all_state_snapshots as Record<string, unknown>[])
    : [];
  const charTimelines = Array.isArray(data.character_timelines)
    ? (data.character_timelines as Record<string, unknown>[])
    : [];
  const stateConflicts = Array.isArray(data.state_conflicts)
    ? (data.state_conflicts as Record<string, unknown>[])
    : [];

  // Legacy schema fallback
  const legacyLocations = data.locations ?? data.location_list ?? data.location_entries;
  const legacyLocationArray: Record<string, unknown>[] = Array.isArray(legacyLocations)
    ? (legacyLocations as Record<string, unknown>[])
    : [];

  const continuityRisks = data.continuity_risks as string[] | null;
  const worldStateRules = data.world_state_rules;

  // Build timeline lookup by characterId
  const timelineByCharId: Record<string, Record<string, unknown>> = {};
  for (const ct of charTimelines) {
    const cid = String(ct.characterId ?? "");
    if (cid) timelineByCharId[cid] = ct;
  }

  const hasV1Data = uniqueLocations.length > 0 || stateSnapshots.length > 0;

  // Normalize itinerary strings into canonical location names
  const canonicalLocations = normalizeLocations(uniqueLocations);
  const totalLocCount = hasV1Data ? canonicalLocations.length : legacyLocationArray.length;

  // Collapsible sections
  const [showAllSnapshots, setShowAllSnapshots] = React.useState(false);
  const [showConflicts, setShowConflicts] = React.useState(false);
  const visibleSnapshots = showAllSnapshots ? stateSnapshots : stateSnapshots.slice(0, 5);

  return (
    <LayerShell>
      <LayerTitle
        icon="🗺"
        title="Location · Timeline · World State"
        description={LAYER_DESCRIPTIONS.location_timeline_worldstate_layer}
        badge={totalLocCount > 0 ? `${totalLocCount} locations` : undefined}
        badgeTone="neutral"
      />

      {worldStateRules && (
        <>
          <SubHeading>World State Rules</SubHeading>
          <div
            style={{
              background: C.surfaceAlt,
              borderRadius: 10,
              padding: "14px 18px",
              fontSize: 15,
              color: C.textPrimary,
              border: `1px solid ${C.border}`,
              marginBottom: 18,
              lineHeight: 1.75,
            }}
          >
            {typeof worldStateRules === "string"
              ? worldStateRules
              : Array.isArray(worldStateRules)
                ? (worldStateRules as string[]).map((r, i) => (
                    <p key={i} style={{ margin: i > 0 ? "8px 0 0" : 0 }}>{r}</p>
                  ))
                : JSON.stringify(worldStateRules, null, 2)}
          </div>
        </>
      )}

      {/* ── Canonical locations (normalized from itinerary strings) ── */}
      {canonicalLocations.length > 0 && (
        <>
          <SubHeading>Canonical Locations</SubHeading>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {canonicalLocations.map((loc, i) => (
              <div
                key={i}
                style={{
                  background: C.surfaceAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: 8,
                  padding: "8px 14px",
                  fontSize: 14,
                  color: C.textPrimary,
                  lineHeight: 1.6,
                }}
              >
                {loc}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── Character state snapshots ── */}
      {stateSnapshots.length > 0 && (
        <>
          <SubHeading>Character State Snapshots</SubHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
            {visibleSnapshots.map((ss, i) => {
              const cid = String(ss.characterId ?? "");
              const tl = timelineByCharId[cid] ?? null;
              return <TimelineCard key={i} snapshot={ss} timeline={tl} />;
            })}
          </div>
          {stateSnapshots.length > 5 && (
            <button
              onClick={() => setShowAllSnapshots((p) => !p)}
              style={{
                display: "block",
                margin: "12px auto 0",
                background: "none",
                border: `1px solid ${C.border}`,
                borderRadius: 8,
                padding: "8px 20px",
                color: C.gold,
                fontSize: 13,
                fontWeight: 600,
                cursor: "pointer",
              }}
            >
              {showAllSnapshots
                ? "Show fewer"
                : `Show all ${stateSnapshots.length} snapshots`}
            </button>
          )}
        </>
      )}

      {/* ── State conflicts — plain-English, collapsible ── */}
      {stateConflicts.length > 0 && (
        <>
          <button
            onClick={() => setShowConflicts((p) => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 8,
              marginTop: 18,
              marginBottom: showConflicts ? 10 : 0,
              background: "none",
              border: "none",
              padding: 0,
              color: C.textMuted,
              fontSize: 13,
              fontWeight: 600,
              cursor: "pointer",
              letterSpacing: "0.04em",
            }}
          >
            <span style={{ fontSize: 11 }}>{showConflicts ? "▾" : "▸"}</span>
            Timeline Consistency Warnings ({stateConflicts.length})
          </button>
          {showConflicts && (
            <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
              {stateConflicts.map((c, i) => (
                <WarnBanner
                  key={i}
                  reason={typeof c === "string" ? c : formatConflict(c)}
                />
              ))}
              <div
                style={{
                  fontSize: 12,
                  color: C.textFaint,
                  marginTop: 4,
                  lineHeight: 1.6,
                  fontStyle: "italic",
                }}
              >
                These warnings reflect extraction-pass disagreements, not necessarily
                manuscript errors. They are internal diagnostics.
              </div>
            </div>
          )}
        </>
      )}

      {/* ── Legacy schema: location objects ── */}
      {!hasV1Data && legacyLocationArray.length > 0 && (
        <>
          <SubHeading>Locations</SubHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {legacyLocationArray.map((loc, i) => {
              const name = String(loc.location_name ?? loc.name ?? `Location ${i + 1}`);
              const anchors = loc.evidence_anchors as string[] | null;
              const chars = loc.characters_present as string[] | null;
              return (
                <CharacterCard key={i} style={{ borderRadius: 10, padding: "14px 18px" }}>
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 15 }}>
                      {name}
                    </span>
                    {chars && chars.length > 0 && (
                      <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                        {chars.map((c, j) => (
                          <Pill key={j} label={c} tone="neutral" />
                        ))}
                      </div>
                    )}
                  </div>
                  <div>
                    {loc.first_appearance && <FieldRow label="First appearance" value={loc.first_appearance} />}
                    {loc.movement_path && <FieldRow label="Movement path" value={loc.movement_path} />}
                    {loc.time_sequence && <FieldRow label="Time sequence" value={loc.time_sequence} />}
                    {loc.world_state_rules && <FieldRow label="World state rules" value={loc.world_state_rules} />}
                  </div>
                  {loc.continuity_risks && <WarnBanner reason={String(loc.continuity_risks)} />}
                  {anchors && anchors.length > 0 && (
                    <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                      {anchors.map((a, j) => <EvidenceTag key={j} id={a} />)}
                    </div>
                  )}
                </CharacterCard>
              );
            })}
          </div>
        </>
      )}

      {continuityRisks && continuityRisks.length > 0 && (
        <>
          <SubHeading>Global Continuity Risks</SubHeading>
          {continuityRisks.map((r, i) => (
            <WarnBanner key={i} reason={r} />
          ))}
        </>
      )}
    </LayerShell>
  );
}

// ─── Layer 8 — Threat · Pressure · Ending ─────────────────────────────────────

const PRESSURE_STATUS_TONE: Record<
  string,
  "green" | "oxblood" | "warn" | "neutral"
> = {
  resolved: "green",
  defeated: "green",
  unresolved: "warn",
  active: "oxblood",
  escalating: "oxblood",
  open: "warn",
};

// Infer a literary pressure type from the character/force name and context.
// Falls back to "narrative pressure" if no pattern matches.
function inferPressureType(name: string, _status: string): string {
  const n = name.toLowerCase();
  if (n.includes("child") || n.includes("son") || n.includes("daughter") || n.includes("motherhood"))
    return "maternal obligation";
  if (n.includes("husband") || n.includes("wife") || n.includes("marriage") || n.includes("marital"))
    return "marital constraint";
  if (n.includes("society") || n.includes("convention") || n.includes("social") || n.includes("convenances"))
    return "social convention";
  if (n.includes("sea") || n.includes("water") || n.includes("river") || n.includes("ocean"))
    return "symbolic terminal force";
  if (n.includes("doctor") || n.includes("medical") || n.includes("mandelet"))
    return "medical-social surveillance";
  if (n.includes("arobin") || n.includes("lover") || n.includes("tempt"))
    return "sexual destabilizer";
  if (n.includes("church") || n.includes("relig") || n.includes("god"))
    return "institutional pressure";
  return "narrative pressure";
}

// Classify ending-accountability warnings: filter out background/foil figures
// that don't carry open narrative promises.
const BACKGROUND_FIGURE_PATTERNS = [
  "lady in black", "lady_in_black",
  "unnamed", "two young lovers", "two_young_lovers",
  "background", "collective", "_group",
  "mocking", "parrot",
];

function isBackgroundFigure(charId: string): boolean {
  const id = charId.toLowerCase();
  return BACKGROUND_FIGURE_PATTERNS.some((p) => id.includes(p));
}

// Format a terminal ledger entry to plain English instead of raw JSON
function formatTerminalEntry(entry: Record<string, unknown>): {
  name: string;
  terminal: string;
  belief: string;
  condition: string;
  closure: string;
} {
  const charId = String(entry.characterId ?? "");
  const name = charId ? sentenceCaseId(charId) : "Unknown";
  const belief = String(entry.finalBeliefState ?? "");
  const rawCondition = String(entry.terminalCondition ?? "open");
  const TERMINAL_LABELS: Record<string, string> = {
    death: "Dies",
    departure: "Departs",
    disappearance: "Disappears",
    transformation: "Transformed",
    open: "Arc open",
    unresolved: "Arc unresolved",
  };
  const condition = TERMINAL_LABELS[rawCondition] ?? rawCondition.replace(/_/g, " ");
  const rawClosure = String(entry.narrativeClosureStatus ?? "unknown");
  const CLOSURE_LABELS: Record<string, string> = {
    closed: "Closed",
    open: "Open",
    ambiguous: "Ambiguous",
    unknown: "Not yet determined",
  };
  const closure = CLOSURE_LABELS[rawClosure] ?? rawClosure.replace(/_/g, " ");
  const chunk = entry.terminalChunk ?? entry.terminalChapter ?? "";
  const terminal = chunk ? `Last seen: ${typeof chunk === "number" ? `chunk ${chunk}` : chunk}` : "";
  return { name, terminal, belief, condition, closure };
}

// Format ending-accountability warning to plain English
function formatAccountabilityWarning(warning: unknown): { charName: string; reason: string } | null {
  if (typeof warning === "string") {
    const match = warning.match(/^(.+?):\s*(.+)$/);
    if (match) return { charName: match[1].trim(), reason: match[2].trim() };
    return { charName: "", reason: warning };
  }
  if (typeof warning === "object" && warning !== null) {
    const w = warning as Record<string, unknown>;
    const charName = String(w.characterId ?? w.character_id ?? w.name ?? "");
    const reason = String(w.status ?? w.reason ?? w.type ?? "unresolved");
    return { charName: sentenceCaseId(charName), reason: reason.replace(/_/g, " ") };
  }
  return null;
}

const THREAT_INTERNAL_FIELDS = new Set([
  "schema_version",
  "active_blockers",
  "suppress_blockers",
  "active_blocker_count",
  "terminal_entry_count",
  "antagonist_count",
]);

function sentenceCaseId(id: string): string {
  if (!id) return id;
  return id
    .split(/[_\s-]+/)
    .filter(Boolean)
    .map((s) => s.charAt(0).toUpperCase() + s.slice(1).toLowerCase())
    .join(" ");
}

type Antagonist = {
  canonical_name?: unknown;
  character_id?: unknown;
  final_status?: unknown;
};

type CopingMechanism = {
  description?: unknown;
  manifestsAs?: unknown;
  psychologicalFunction?: unknown;
};

type PsychologyEntry = {
  characterId?: unknown;
  copingMechanisms?: unknown;
};

// Classify psychology entries as human characters vs pressure/collective forces
const PRESSURE_FORCE_IDS = new Set([
  "the_river", "river", "pv115_mystery", "pv115", "ravens_group", "ravens",
  "disappeared-near-water_group", "disappeared_near_water_group",
  "fish_camp_dogs_group", "fish_camp_community", "fish_camp_children_group",
  "fish_table_women_group",
]);

function isPressureForce(characterId: string): boolean {
  const id = characterId.toLowerCase().replace(/\s+/g, "_");
  if (PRESSURE_FORCE_IDS.has(id)) return true;
  if (id.includes("_group") || id.includes("_community")) return true;
  if (id.includes("mystery") || id.includes("force")) return true;
  return false;
}

type PsychologyEntryFull = PsychologyEntry & {
  psychologicalArc?: unknown;
};

export function ThreatAntagonistEndingLayer({
  data,
}: {
  data?: Record<string, unknown> | null;
}) {
  if (!data || Object.keys(data).length === 0)
    return (
      <LayerShell
        empty
        emptyLabel="Threat, pressure, and ending data not yet populated."
        emptyDetail="Pressure agents, character response profiles, and terminal states will appear here once the manuscript has been analysed."
      />
    );

  const antagonists = Array.isArray(data.antagonists)
    ? (data.antagonists as Antagonist[])
    : [];

  const psychologyLedger = Array.isArray(data.psychology_ledger)
    ? (data.psychology_ledger as PsychologyEntryFull[])
    : [];

  // Separate human characters from pressure forces
  const characterProfiles: PsychologyEntryFull[] = [];
  const pressureForces: PsychologyEntryFull[] = [];
  for (const entry of psychologyLedger) {
    const cid = typeof entry.characterId === "string" ? entry.characterId : "";
    if (isPressureForce(cid)) {
      pressureForces.push(entry);
    } else {
      characterProfiles.push(entry);
    }
  }

  const accountabilityWarnings = Array.isArray(
    data.ending_accountability_warnings
  )
    ? (data.ending_accountability_warnings as unknown[])
    : [];
  const terminalLedger = Array.isArray(data.terminal_ledger)
    ? (data.terminal_ledger as Record<string, unknown>[])
    : [];
  const openTerminalLedgers = Array.isArray(data.open_terminal_ledgers)
    ? (data.open_terminal_ledgers as Record<string, unknown>[])
    : [];

  const totalPressureAgents = antagonists.length;
  const totalPressure = pressureForces.length;

  // Filter accountability warnings: drop background/foil figures
  const significantWarnings = accountabilityWarnings
    .map(formatAccountabilityWarning)
    .filter((w): w is NonNullable<typeof w> => w !== null && !isBackgroundFigure(w.charName));
  const backgroundWarningCount = accountabilityWarnings.length - significantWarnings.length;

  // Collapsible states
  const [pressureExpanded, setPressureExpanded] = React.useState(true);
  const [charProfilesExpanded, setCharProfilesExpanded] = React.useState(true);
  const [showTerminal, setShowTerminal] = React.useState(false);
  const [showAccountability, setShowAccountability] = React.useState(false);

  return (
    <LayerShell>
      <LayerTitle
        icon="⚔️"
        title="Threat · Pressure · Ending"
        description="The forces working against your protagonist — people, institutions, environments, internal conflicts, and social pressures — mapped to their final state at story's end."
        badge={
          totalPressureAgents > 0
            ? `${totalPressureAgents} pressure agent${totalPressureAgents === 1 ? "" : "s"}`
            : totalPressure > 0
              ? `${totalPressure} pressure force${totalPressure === 1 ? "" : "s"}`
              : undefined
        }
        badgeTone={totalPressureAgents > 0 ? "warn" : totalPressure > 0 ? "warn" : "neutral"}
      />

      {/* Summary bar */}
      <div
        style={{
          display: "flex",
          flexWrap: "wrap",
          gap: 16,
          marginBottom: 20,
          fontSize: 13,
          color: C.textMuted,
        }}
      >
        <span>
          <span style={{ fontWeight: 600, color: C.textPrimary }}>Pressure agents:</span>{" "}
          {totalPressureAgents}
        </span>
        {totalPressure > 0 && (
          <span>
            <span style={{ fontWeight: 600, color: C.textPrimary }}>Structural forces:</span>{" "}
            {totalPressure}
          </span>
        )}
        {characterProfiles.length > 0 && (
          <span>
            <span style={{ fontWeight: 600, color: C.textPrimary }}>Character responses:</span>{" "}
            {characterProfiles.length}
          </span>
        )}
      </div>

      {/* Pressure Agents (formerly "Named Antagonists") */}
      <SubHeading>Pressure Agents</SubHeading>
      {antagonists.length > 0 ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {antagonists.map((a, i) => {
            const name =
              typeof a.canonical_name === "string" && a.canonical_name
                ? a.canonical_name
                : typeof a.character_id === "string"
                  ? sentenceCaseId(a.character_id)
                  : `Agent ${i + 1}`;
            const status =
              typeof a.final_status === "string" ? a.final_status : "";
            const tone =
              PRESSURE_STATUS_TONE[status.toLowerCase()] ?? "neutral";
            const pressureType = inferPressureType(name, status);
            return (
              <CharacterCard key={i}>
                <div
                  style={{
                    display: "flex",
                    justifyContent: "space-between",
                    alignItems: "center",
                    flexWrap: "wrap",
                    gap: 10,
                  }}
                >
                  <div>
                    <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 16 }}>
                      {name}
                    </span>
                    <span style={{
                      marginLeft: 10,
                      fontSize: 12,
                      color: C.textFaint,
                      fontStyle: "italic",
                    }}>
                      {pressureType}
                    </span>
                  </div>
                  {status && <Pill label={status.replace(/_/g, " ")} tone={tone} />}
                </div>
              </CharacterCard>
            );
          })}
        </div>
      ) : (
        <p style={{ color: C.textFaint, fontSize: 15, lineHeight: 1.75, marginBottom: 16 }}>
          No named pressure agents identified.
        </p>
      )}

      {/* Pressure Forces */}
      {pressureForces.length > 0 && (
        <>
          <Divider />
          <button
            onClick={() => setPressureExpanded((p) => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 0",
              textAlign: "left",
              marginBottom: 8,
            }}
          >
            <span style={{ color: "#E6A23C", fontSize: 13, width: 18, textAlign: "center" }}>
              {pressureExpanded ? "▾" : "▸"}
            </span>
            <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 15 }}>
              Structural Pressure Forces
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: "#E6A23C",
                background: "rgba(200,150,50,0.12)",
                padding: "2px 8px",
                borderRadius: 10,
              }}
            >
              {pressureForces.length}
            </span>
          </button>
          {pressureExpanded && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginLeft: 28 }}>
              {pressureForces.map((entry, i) => {
                const rawId = typeof entry.characterId === "string" ? entry.characterId : "";
                const name = rawId ? sentenceCaseId(rawId) : `Force ${i + 1}`;
                const arc = typeof entry.psychologicalArc === "string" ? entry.psychologicalArc : "";
                const mechanisms = Array.isArray(entry.copingMechanisms)
                  ? (entry.copingMechanisms as CopingMechanism[])
                  : [];
                const prose = mechanisms.length > 0
                  ? (typeof mechanisms[0].description === "string" && mechanisms[0].description
                      ? mechanisms[0].description
                      : typeof mechanisms[0].manifestsAs === "string"
                        ? mechanisms[0].manifestsAs
                        : "")
                  : "";
                return (
                  <CharacterCard key={i}>
                    <div style={{ fontWeight: 700, color: C.textPrimary, fontSize: 16, marginBottom: 8 }}>
                      {name}
                    </div>
                    {prose && (
                      <p style={{ margin: "0 0 8px", fontSize: 14, color: C.textMuted, lineHeight: 1.75 }}>
                        {prose}
                      </p>
                    )}
                    {arc && (
                      <p style={{ margin: 0, fontSize: 13, color: C.textFaint, lineHeight: 1.65, fontStyle: "italic" }}>
                        {arc}
                      </p>
                    )}
                  </CharacterCard>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Character Response Profiles */}
      {characterProfiles.length > 0 && (
        <>
          <Divider />
          <button
            onClick={() => setCharProfilesExpanded((p) => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 0",
              textAlign: "left",
              marginBottom: 8,
            }}
          >
            <span style={{ color: C.gold, fontSize: 13, width: 18, textAlign: "center" }}>
              {charProfilesExpanded ? "▾" : "▸"}
            </span>
            <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 15 }}>
              Character Response Profiles
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.gold,
                background: "rgba(169,142,74,0.12)",
                padding: "2px 8px",
                borderRadius: 10,
              }}
            >
              {characterProfiles.length}
            </span>
          </button>
          {charProfilesExpanded && (
            <div style={{ display: "flex", flexDirection: "column", gap: 12, marginLeft: 28 }}>
              {characterProfiles.map((entry, i) => {
                const rawId = typeof entry.characterId === "string" ? entry.characterId : "";
                const name = rawId ? sentenceCaseId(rawId) : `Character ${i + 1}`;
                const arc = typeof entry.psychologicalArc === "string" ? entry.psychologicalArc : "";
                const mechanisms = Array.isArray(entry.copingMechanisms)
                  ? (entry.copingMechanisms as CopingMechanism[])
                  : [];
                return (
                  <CharacterCard key={i}>
                    <div style={{ fontWeight: 700, color: C.textPrimary, fontSize: 16, marginBottom: 8 }}>
                      {name}
                    </div>
                    {mechanisms.map((mech, j) => {
                      const prose =
                        typeof mech.description === "string" && mech.description
                          ? mech.description
                          : typeof mech.manifestsAs === "string"
                            ? mech.manifestsAs
                            : "";
                      return prose ? (
                        <p key={j} style={{ margin: "0 0 6px", fontSize: 14, color: C.textMuted, lineHeight: 1.75 }}>
                          {prose}
                        </p>
                      ) : null;
                    })}
                    {arc && (
                      <p style={{ margin: "4px 0 0", fontSize: 13, color: C.textFaint, lineHeight: 1.65, fontStyle: "italic" }}>
                        {arc}
                      </p>
                    )}
                  </CharacterCard>
                );
              })}
            </div>
          )}
        </>
      )}

      {/* Ending Accountability — plain English, filtered, collapsible */}
      {(significantWarnings.length > 0 || backgroundWarningCount > 0) && (
        <>
          <Divider />
          <button
            onClick={() => setShowAccountability((p) => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 0",
              textAlign: "left",
              marginBottom: 8,
            }}
          >
            <span style={{ color: "#E6A23C", fontSize: 13, width: 18, textAlign: "center" }}>
              {showAccountability ? "▾" : "▸"}
            </span>
            <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 15 }}>
              Ending Accountability
            </span>
            {significantWarnings.length > 0 && (
              <span
                style={{
                  fontSize: 12,
                  fontWeight: 600,
                  color: "#E6A23C",
                  background: "rgba(200,150,50,0.12)",
                  padding: "2px 8px",
                  borderRadius: 10,
                }}
              >
                {significantWarnings.length}
              </span>
            )}
          </button>
          {showAccountability && (
            <div style={{ marginLeft: 28 }}>
              {significantWarnings.length > 0 ? (
                <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 12 }}>
                  {significantWarnings.map((w, i) => (
                    <div
                      key={i}
                      style={{
                        background: "rgba(200,150,50,0.06)",
                        border: "1px solid rgba(200,150,50,0.2)",
                        borderRadius: 10,
                        padding: "10px 14px",
                        fontSize: 14,
                        color: C.textMuted,
                        lineHeight: 1.7,
                      }}
                    >
                      {w.charName && (
                        <span style={{ fontWeight: 600, color: C.textPrimary }}>{w.charName}: </span>
                      )}
                      {w.reason}
                    </div>
                  ))}
                </div>
              ) : null}
              {backgroundWarningCount > 0 && (
                <p style={{ margin: 0, fontSize: 13, color: C.textFaint, fontStyle: "italic", lineHeight: 1.65 }}>
                  {backgroundWarningCount} background/foil figure{backgroundWarningCount !== 1 ? "s" : ""} omitted
                  — these characters serve symbolic or atmospheric functions and do not carry open narrative promises
                  requiring ending accountability.
                </p>
              )}
            </div>
          )}
        </>
      )}

      {/* Terminal Ledger — plain English, collapsible (no raw JSON) */}
      {(terminalLedger.length > 0 || openTerminalLedgers.length > 0) && (
        <>
          <Divider />
          <button
            onClick={() => setShowTerminal((p) => !p)}
            style={{
              display: "flex",
              alignItems: "center",
              gap: 10,
              width: "100%",
              background: "none",
              border: "none",
              cursor: "pointer",
              padding: "8px 0",
              textAlign: "left",
              marginBottom: 8,
            }}
          >
            <span style={{ color: C.textFaint, fontSize: 13, width: 18, textAlign: "center" }}>
              {showTerminal ? "▾" : "▸"}
            </span>
            <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 15 }}>
              Terminal States
            </span>
            <span
              style={{
                fontSize: 12,
                fontWeight: 600,
                color: C.textFaint,
                background: C.surfaceAlt,
                padding: "2px 8px",
                borderRadius: 10,
              }}
            >
              {terminalLedger.length + openTerminalLedgers.length}
            </span>
          </button>
          {showTerminal && (
            <div style={{ display: "flex", flexDirection: "column", gap: 10, marginLeft: 28 }}>
              {[...terminalLedger, ...openTerminalLedgers].map((entry, i) => {
                const fmt = formatTerminalEntry(entry);
                const closureTone =
                  fmt.closure === "complete" || fmt.closure === "resolved" ? "green"
                    : fmt.closure === "underpaid" || fmt.closure === "abandoned" ? "warn"
                    : "neutral";
                return (
                  <CharacterCard key={i}>
                    <div style={{
                      display: "flex",
                      justifyContent: "space-between",
                      alignItems: "center",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 6,
                    }}>
                      <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 15 }}>
                        {fmt.name}
                      </span>
                      <div style={{ display: "flex", gap: 6 }}>
                        {fmt.condition && (
                          <Pill label={fmt.condition.replace(/_/g, " ")} tone={closureTone} />
                        )}
                      </div>
                    </div>
                    {fmt.belief && (
                      <p style={{ margin: "0 0 4px", fontSize: 14, color: C.textMuted, lineHeight: 1.7 }}>
                        {fmt.belief}
                      </p>
                    )}
                    {fmt.terminal && (
                      <p style={{ margin: 0, fontSize: 12, color: C.textFaint }}>
                        {fmt.terminal}
                        {fmt.closure && fmt.closure !== "unknown" && ` · Closure: ${fmt.closure.replace(/_/g, " ")}`}
                      </p>
                    )}
                  </CharacterCard>
                );
              })}
              <p style={{ margin: "8px 0 0", fontSize: 12, color: C.textFaint, fontStyle: "italic", lineHeight: 1.6 }}>
                Terminal states show where each character was last seen and their narrative closure status.
                &ldquo;Underpaid&rdquo; means the character exited without resolving their narrative thread.
              </p>
            </div>
          )}
        </>
      )}
    </LayerShell>
  );
}

// ─── Completion Summary Bar ───────────────────────────────────────────────────

export function LayerCompletionBar({
  summary,
}: {
  summary?: {
    total_layers: number;
    populated_layers: number;
    empty_layers?: string[];
    degraded_layers?: string[];
  } | null;
}) {
  if (!summary) return null;

  const pct = Math.round(
    (summary.populated_layers / summary.total_layers) * 100
  );
  const hasEmpty = (summary.empty_layers?.length ?? 0) > 0;
  const hasDegraded = (summary.degraded_layers?.length ?? 0) > 0;

  return (
    <div
      style={{
        background: C.surface,
        border: `1px solid ${C.border}`,
        borderRadius: 12,
        padding: "16px 20px",
        marginBottom: 22,
        display: "flex",
        alignItems: "center",
        gap: 18,
        flexWrap: "wrap",
      }}
    >
      <div style={{ flex: 1, minWidth: 200 }}>
        <div
          style={{
            display: "flex",
            justifyContent: "space-between",
            marginBottom: 8,
          }}
        >
          <span
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase" as const,
              color: C.textMuted,
            }}
          >
            Layer Completion
          </span>
          <span
            style={{
              fontSize: 12,
              fontWeight: 700,
              color:
                pct === 100 ? "#5CB85C" : pct >= 50 ? C.gold : "#C05050",
            }}
          >
            {summary.populated_layers}/{summary.total_layers} ({pct}%)
          </span>
        </div>
        <div
          style={{
            height: 6,
            background: C.surfaceAlt,
            borderRadius: 99,
            overflow: "hidden",
          }}
        >
          <div
            style={{
              height: "100%",
              width: `${pct}%`,
              background:
                pct === 100 ? "#34A853" : pct >= 50 ? C.gold : C.oxblood,
              borderRadius: 99,
              transition: "width 0.3s",
            }}
          />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {hasEmpty && (
          <Pill
            label={`${summary.empty_layers!.length} empty`}
            tone="warn"
          />
        )}
        {hasDegraded && (
          <Pill
            label={`${summary.degraded_layers!.length} degraded`}
            tone="oxblood"
          />
        )}
        {!hasEmpty && !hasDegraded && (
          <Pill label="All layers populated" tone="green" />
        )}
      </div>
    </div>
  );
}

// ─── Layer 9 — Identity & Pronoun Verification ──────────────────────────────

interface PronounShiftDecision {
  character: string;
  decision: "intentional" | "continuity_error" | null;
}

export function IdentityPronounLayer({
  data,
  pronounDecisions,
  onPronounDecision,
}: {
  data?: Record<string, unknown> | null;
  pronounDecisions?: PronounShiftDecision[];
  onPronounDecision?: (character: string, decision: "intentional" | "continuity_error") => void;
}) {
  if (!data || Object.keys(data).length === 0)
    return (
      <LayerShell
        empty
        emptyLabel="Identity & pronoun data not yet available."
        emptyDetail="Character pronoun usage, gender signals, and identity verification will appear here once the manuscript has been analysed."
      />
    );

  const entries: Record<string, unknown>[] = Array.isArray(data.entries)
    ? (data.entries as Record<string, unknown>[])
    : [];

  if (entries.length === 0)
    return (
      <LayerShell
        empty
        emptyLabel="No characters detected for pronoun verification."
        emptyDetail="This layer requires at least one named character from the character evidence sweep."
      />
    );

  const charactersWithShifts: Array<{
    name: string;
    pronouns: string[];
    genderIdentity: string;
    warning: string | null;
    chunkFirst: number;
    chunkLast: number;
  }> = [];

  const charactersNormal: Array<{
    name: string;
    pronouns: string[];
    genderIdentity: string;
  }> = [];

  for (const entry of entries) {
    const name = String(entry.canonical_name ?? "Unknown");
    const pronouns: string[] = Array.isArray(entry.pronouns) ? (entry.pronouns as string[]) : [];
    const genderIdentity = String(entry.gender_identity ?? "unknown");
    const warnings: Array<{ type: string; message: string }> = Array.isArray(entry.warnings)
      ? (entry.warnings as Array<{ type: string; message: string }>)
      : [];
    const pronounWarning = warnings.find((w) => w.type === "pronoun_inconsistency");

    if (pronounWarning) {
      charactersWithShifts.push({
        name,
        pronouns,
        genderIdentity,
        warning: pronounWarning.message,
        chunkFirst: typeof entry.first_chunk_index === "number" ? (entry.first_chunk_index as number) : 0,
        chunkLast: typeof entry.last_chunk_index === "number" ? (entry.last_chunk_index as number) : 0,
      });
    } else {
      charactersNormal.push({ name, pronouns, genderIdentity });
    }
  }

  const shiftCount = charactersWithShifts.length;
  const tone = shiftCount > 0 ? "warn" as const : "neutral" as const;

  return (
    <LayerShell tone={tone}>
      <LayerTitle
        icon="🏷️"
        title="Identity & Pronoun Verification"
        description={LAYER_DESCRIPTIONS.identity_pronoun_layer}
        badge={
          shiftCount > 0
            ? `${shiftCount} pronoun ${shiftCount === 1 ? "shift" : "shifts"} detected`
            : `${entries.length} ${entries.length === 1 ? "identity" : "identities"} verified`
        }
        badgeTone={shiftCount > 0 ? "oxblood" : "gold"}
      />

      {shiftCount > 0 && (
        <div style={{ display: "flex", flexDirection: "column", gap: 14, marginBottom: 20 }}>
          <SubHeading>Pronoun Shifts Requiring Confirmation</SubHeading>
          {charactersWithShifts.map((char) => {
            const existing = pronounDecisions?.find((d) => d.character === char.name);
            const decided = existing?.decision ?? null;

            return (
              <div
                key={char.name}
                style={{
                  border: `1px solid ${decided ? C.border : C.gold}`,
                  borderRadius: 12,
                  padding: "14px 16px",
                  background: decided ? C.surface : C.goldLight,
                }}
              >
                <div style={{ display: "flex", alignItems: "center", gap: 10, marginBottom: 8 }}>
                  <span style={{ fontSize: 17, fontWeight: 600, color: C.textPrimary }}>{char.name}</span>
                  <div style={{ display: "flex", gap: 6 }}>
                    {char.pronouns.map((p, i) => (
                      <Pill key={i} label={p} tone="gold" />
                    ))}
                  </div>
                </div>
                <p style={{ fontSize: 14, color: C.textMuted, margin: "0 0 10px", lineHeight: 1.6 }}>
                  Pronoun variation detected across evidence spans{" "}
                  {char.chunkFirst}–{char.chunkLast}.{" "}
                  {char.genderIdentity !== "unknown" && (
                    <span>Gender signal: <em>{char.genderIdentity}</em>.</span>
                  )}
                </p>
                <p style={{ fontSize: 13, color: C.ash, margin: "0 0 12px", fontStyle: "italic" }}>
                  Is this an intentional character transition or a continuity error?
                </p>
                <div style={{ display: "flex", gap: 8 }}>
                  <button
                    type="button"
                    onClick={() => onPronounDecision?.(char.name, "intentional")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: `1px solid ${decided === "intentional" ? C.gold : C.borderStrong}`,
                      background: decided === "intentional" ? C.goldLight : "transparent",
                      color: decided === "intentional" ? C.gold : C.textMuted,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Intentional transition
                  </button>
                  <button
                    type="button"
                    onClick={() => onPronounDecision?.(char.name, "continuity_error")}
                    style={{
                      padding: "6px 14px",
                      borderRadius: 8,
                      border: `1px solid ${decided === "continuity_error" ? C.oxblood : C.borderStrong}`,
                      background: decided === "continuity_error" ? C.oxbloodLight : "transparent",
                      color: decided === "continuity_error" ? C.oxblood : C.textMuted,
                      fontSize: 13,
                      fontWeight: 600,
                      cursor: "pointer",
                    }}
                  >
                    Continuity error
                  </button>
                </div>
              </div>
            );
          })}
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        <SubHeading>Character Pronoun Registry</SubHeading>
        <div
          style={{
            display: "grid",
            gridTemplateColumns: "1fr auto auto",
            gap: "8px 16px",
            alignItems: "center",
          }}
        >
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: C.textMuted }}>
            Character
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: C.textMuted }}>
            Pronouns
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.08em", textTransform: "uppercase" as const, color: C.textMuted }}>
            Gender Signal
          </span>

          {[...charactersWithShifts.map((c) => ({ ...c, hasShift: true })), ...charactersNormal.map((c) => ({ ...c, hasShift: false }))].map(
            (char) => (
              <React.Fragment key={char.name}>
                <span style={{ fontSize: 15, fontWeight: 500, color: C.textPrimary }}>
                  {char.name}
                  {char.hasShift && (
                    <span style={{ marginLeft: 6, fontSize: 11, color: C.gold, fontWeight: 600 }}>SHIFT</span>
                  )}
                </span>
                <div style={{ display: "flex", gap: 4, flexWrap: "wrap" }}>
                  {char.pronouns.length > 0
                    ? char.pronouns.map((p, i) => <Pill key={i} label={p} tone={char.hasShift ? "gold" : "neutral"} />)
                    : <span style={{ fontSize: 13, color: C.textFaint }}>—</span>}
                </div>
                <span style={{ fontSize: 14, color: C.textMuted }}>
                  {char.genderIdentity !== "unknown" ? char.genderIdentity : "—"}
                </span>
              </React.Fragment>
            ),
          )}
        </div>
      </div>
    </LayerShell>
  );
}

// ─── Master dispatcher ────────────────────────────────────────────────────────

/**
 * Dispatches the correct purpose-built layer renderer based on layer key.
 * Drop-in replacement for the old generic StoryLayerPanel.
 */
export function StoryLayerRenderer({
  layerKey,
  data,
  castData,
  sourceIntegrityEnrichmentNote,
  onSourceIntegrityEnrichmentNoteChange,
  pronounDecisions,
  onPronounDecision,
}: {
  layerKey: string;
  data: Record<string, unknown> | undefined | null;
  castData?: Record<string, unknown> | null;
  sourceIntegrityEnrichmentNote?: string;
  onSourceIntegrityEnrichmentNoteChange?: (next: string) => void;
  pronounDecisions?: PronounShiftDecision[];
  onPronounDecision?: (character: string, decision: "intentional" | "continuity_error") => void;
}) {
  switch (layerKey) {
    case "source_integrity_layer":
      return (
        <SourceIntegrityLayer
          data={data}
          enrichmentNote={sourceIntegrityEnrichmentNote}
          onEnrichmentNoteChange={onSourceIntegrityEnrichmentNoteChange}
        />
      );
    case "pov_structure_layer":
      return <PovStructureLayer data={data} />;
    case "canonical_identity_layer":
      return <CanonicalIdentityLayer data={data} />;
    case "cast_role_tier_layer":
      return <CastRoleTierLayer data={data} />;
    case "identity_pronoun_layer":
      return (
        <IdentityPronounLayer
          data={data}
          pronounDecisions={pronounDecisions}
          onPronounDecision={onPronounDecision}
        />
      );
    case "relationship_network_layer":
      return <RelationshipNetworkLayer data={data} castData={castData} />;
    case "object_symbol_layer":
      return <ObjectSymbolLayer data={data} />;
    case "location_timeline_worldstate_layer":
      return <LocationTimelineWorldstateLayer data={data} />;
    case "threat_antagonist_ending_layer":
      return <ThreatAntagonistEndingLayer data={data} />;
    default:
      if (!data || Object.keys(data).length === 0) {
        return (
          <div
            style={{
              border: `1px dashed ${C.border}`,
              borderRadius: 14,
              padding: 24,
              background: C.surface,
              color: C.textFaint,
              fontSize: 15,
            }}
          >
            No data for layer: {layerKey}
          </div>
        );
      }
      return (
        <div
          style={{
            border: `1px solid ${C.border}`,
            borderRadius: 14,
            padding: 24,
            background: C.surface,
          }}
        >
          <p
            style={{
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase" as const,
              color: C.textMuted,
              marginBottom: 14,
            }}
          >
            {layerKey.replace(/_/g, " ")}
          </p>
          <dl style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(data)
              .filter(([k]) => !k.startsWith("_"))
              .map(([k, v]) => (
                <FieldRow key={k} label={k.replace(/_/g, " ")} value={v} />
              ))}
          </dl>
        </div>
      );
  }
}
