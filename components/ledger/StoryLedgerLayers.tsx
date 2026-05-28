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
  // Descriptive phrases: "younger recruit with bandage wrist", "kid in yankees cap", etc.
  // Heuristic: no capital letter suggests it was never treated as a proper name
  if (n.length > 0 && n === n.toLowerCase() && n.split(" ").length > 1) return true;
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
    "The forces working against your protagonist — named people, institutions, environments, and internal pressures — mapped to their final state at story's end.",
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
}: {
  label: string;
  value?: unknown;
  mono?: boolean;
}) {
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
          }}
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
        }}
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
  const isClean = statusUpper === "CLEAN";
  const isDegraded = statusUpper === "DEGRADED";
  const isHardFail = statusUpper === "HARD_FAIL" || statusUpper === "FAILED";

  const hardFailPresent = data?.hard_fail_present === true;
  const totalChunks =
    typeof data?.total_chunks_processed === "number"
      ? data.total_chunks_processed
      : null;

  const emptyLayerWarnings = Array.isArray(data?.empty_layer_warnings)
    ? (data.empty_layer_warnings as Array<{ layer: string; code: string; message: string }>)
    : [];

  const tone = isHardFail || hardFailPresent ? "block" : isDegraded ? "warn" : "neutral";

  return (
    <LayerShell tone={tone}>
      <LayerTitle
        icon="🔒"
        title="Source Integrity"
        description={LAYER_DESCRIPTIONS.source_integrity_layer}
      />

      {/* ── Section 1: System Source Check (read-only) ── */}
      <SubHeading>System Source Check</SubHeading>
      <div
        style={{
          background: C.surfaceAlt,
          border: `1px solid ${C.border}`,
          borderRadius: 10,
          padding: "14px 18px",
          marginBottom: 20,
        }}
      >
        <div style={{ display: "flex", flexWrap: "wrap", gap: 10, alignItems: "center", marginBottom: emptyLayerWarnings.length > 0 ? 14 : 0 }}>
          {integrityStatus && (
            <Pill
              label={`Manuscript ingestion: ${integrityStatus}`}
              tone={isClean ? "green" : isHardFail ? "oxblood" : isDegraded ? "gold" : "neutral"}
            />
          )}
          {hardFailPresent && <Pill label="Hard failure" tone="oxblood" />}
          {totalChunks !== null && (
            <Pill label={`${totalChunks} section${totalChunks === 1 ? "" : "s"} processed`} tone="neutral" />
          )}
          {emptyLayerWarnings.length > 0 ? (
            <Pill label={`${emptyLayerWarnings.length} empty layer warning${emptyLayerWarnings.length === 1 ? "" : "s"}`} tone="gold" />
          ) : (
            <Pill label="0 warnings" tone="green" />
          )}
        </div>

        {emptyLayerWarnings.length > 0 && (
          <div style={{ marginTop: 8 }}>
            {emptyLayerWarnings.map((w) => (
              <WarnBanner key={w.code} reason={w.message} />
            ))}
          </div>
        )}
      </div>

      {/* ── Section 2: Author Context ── */}
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
        What you write here is injected into Phase 2 as <strong>Author Enrichment Context</strong>.
        Use the buttons below to save your context or skip if none is needed.
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
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.07em",
              textTransform: "uppercase" as const,
              color: C.textMuted,
            }}
          >
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
  "secondary",
  "foil",
  "mentor",
  "animal_companion",
  "symbolic_force",
  "collective_force",
  "unknown",
] as const;

const TIER_DISPLAY: Record<string, string> = {
  protagonist: "Protagonist",
  co_protagonist: "Co-Protagonist",
  antagonist: "Antagonist",
  secondary: "Secondary Cast",
  foil: "Foil",
  mentor: "Mentor",
  animal_companion: "Animal Companion",
  symbolic_force: "Symbolic Force",
  collective_force: "Collective Force",
  unknown: "Uncategorised",
};

const TIER_TONE: Record<string, "gold" | "oxblood" | "blue" | "neutral"> = {
  protagonist: "gold",
  co_protagonist: "gold",
  antagonist: "oxblood",
  secondary: "blue",
  foil: "blue",
  mentor: "blue",
  animal_companion: "neutral",
  symbolic_force: "neutral",
  collective_force: "neutral",
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

          return (
            <div key={tier}>
              <p
                style={{
                  margin: "0 0 8px",
                  fontSize: 11,
                  fontWeight: 700,
                  letterSpacing: "0.08em",
                  textTransform: "uppercase" as const,
                  color: C.textMuted,
                }}
              >
                {TIER_DISPLAY[tier] ?? tier}
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
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: C.textMuted,
            }}
          >
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
          <p
            style={{
              margin: "0 0 8px",
              fontSize: 11,
              fontWeight: 700,
              letterSpacing: "0.08em",
              textTransform: "uppercase" as const,
              color: C.textMuted,
            }}
          >
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
}: {
  data?: Record<string, unknown> | null;
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
  const count = pairArray.length;

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
  const payoff = item.payoff_description ? String(item.payoff_description) : null;
  const fn = (narrativeFunction ?? "").toLowerCase();

  if (critical || transfers.length > 0 || payoff) return "key_evidence";

  const evidenceKeywords = [
    "evidence", "investigation", "document", "letter", "shareholder",
    "corporate", "institutional", "conflict", "mystery", "contrast",
    "official", "fleet", "numbering",
  ];
  const symbolicKeywords = [
    "symbol", "metaphor", "motif", "teaching", "authority", "rootedness",
    "marker", "cultural", "tradition", "ritual", "memory", "listening",
    "respecting", "power",
  ];

  if (evidenceKeywords.some((kw) => fn.includes(kw))) return "key_evidence";
  if (symbolicKeywords.some((kw) => fn.includes(kw))) return "symbolic_motif";

  const name = String(item.object_name ?? item.name ?? "").toLowerCase();
  const propKeywords = ["tool", "wrench", "truck", "roll", "tube", "strap"];
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

  const totalLocCount =
    hasV1Data
      ? uniqueLocations.length
      : legacyLocationArray.length;

  // Collapsible sections for state snapshots
  const [showAllSnapshots, setShowAllSnapshots] = React.useState(false);
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

      {/* ── V1 schema: unique locations ── */}
      {uniqueLocations.length > 0 && (
        <>
          <SubHeading>Unique Locations</SubHeading>
          <div
            style={{
              display: "flex",
              flexWrap: "wrap",
              gap: 8,
              marginBottom: 20,
            }}
          >
            {uniqueLocations.map((loc, i) => (
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
                  maxWidth: "100%",
                }}
              >
                {loc}
              </div>
            ))}
          </div>
        </>
      )}

      {/* ── V1 schema: character state snapshots ── */}
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

      {/* ── V1 schema: state conflicts ── */}
      {stateConflicts.length > 0 && (
        <>
          <SubHeading>State Conflicts</SubHeading>
          {stateConflicts.map((c, i) => (
            <WarnBanner
              key={i}
              reason={typeof c === "string" ? c : JSON.stringify(c)}
            />
          ))}
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

// ─── Layer 8 — Threat · Antagonist · Ending ───────────────────────────────────

const ANTAGONIST_STATUS_TONE: Record<
  string,
  "green" | "oxblood" | "warn" | "neutral"
> = {
  resolved: "green",
  defeated: "green",
  unresolved: "warn",
};

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
        emptyLabel="Threat, antagonist, and ending data not yet populated."
        emptyDetail="Antagonists and character pressure profiles will appear here once the manuscript has been analysed."
      />
    );

  const antagonists = Array.isArray(data.antagonists)
    ? (data.antagonists as Antagonist[])
    : [];
  const antagonistCount =
    typeof data.antagonist_count === "number"
      ? data.antagonist_count
      : antagonists.length;

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

  const hasAntagonists = antagonists.length > 0;
  const totalPressure = pressureForces.length;

  // Collapsible state for pressure forces
  const [pressureExpanded, setPressureExpanded] = React.useState(true);
  const [charProfilesExpanded, setCharProfilesExpanded] = React.useState(true);

  return (
    <LayerShell>
      <LayerTitle
        icon="⚔️"
        title="Threat · Antagonist · Ending"
        description={LAYER_DESCRIPTIONS.threat_antagonist_ending_layer}
        badge={
          hasAntagonists
            ? `${antagonistCount} antagonist${antagonistCount === 1 ? "" : "s"}`
            : totalPressure > 0
              ? `${totalPressure} pressure force${totalPressure === 1 ? "" : "s"}`
              : undefined
        }
        badgeTone={hasAntagonists ? "oxblood" : totalPressure > 0 ? "warn" : "neutral"}
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
          <span style={{ fontWeight: 600, color: C.textPrimary }}>Named antagonists:</span>{" "}
          {antagonistCount}
        </span>
        {totalPressure > 0 && (
          <span>
            <span style={{ fontWeight: 600, color: C.textPrimary }}>Pressure forces:</span>{" "}
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

      {/* Antagonists */}
      <SubHeading>Named Antagonists</SubHeading>
      {hasAntagonists ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10, marginBottom: 16 }}>
          {antagonists.map((a, i) => {
            const name =
              typeof a.canonical_name === "string" && a.canonical_name
                ? a.canonical_name
                : typeof a.character_id === "string"
                  ? sentenceCaseId(a.character_id)
                  : `Antagonist ${i + 1}`;
            const status =
              typeof a.final_status === "string" ? a.final_status : "";
            const tone =
              ANTAGONIST_STATUS_TONE[status.toLowerCase()] ?? "neutral";
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
                  <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 16 }}>
                    {name}
                  </span>
                  {status && <Pill label={status.replace(/_/g, " ")} tone={tone} />}
                </div>
              </CharacterCard>
            );
          })}
        </div>
      ) : (
        <p style={{ color: C.textFaint, fontSize: 15, lineHeight: 1.75, marginBottom: 16 }}>
          No named human antagonists identified in this chapter.
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
              Pressure Forces
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

      {accountabilityWarnings.length > 0 && (
        <>
          <Divider />
          <SubHeading>Ending Accountability Warnings</SubHeading>
          {accountabilityWarnings.map((warning, i) => (
            <WarnBanner
              key={i}
              reason={
                typeof warning === "string" ? warning : JSON.stringify(warning)
              }
            />
          ))}
        </>
      )}

      {(terminalLedger.length > 0 || openTerminalLedgers.length > 0) && (
        <>
          <Divider />
          <SubHeading>Terminal Ledger</SubHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {[...terminalLedger, ...openTerminalLedgers].map((entry, i) => (
              <div
                key={i}
                style={{
                  background: C.surfaceAlt,
                  border: `1px solid ${C.border}`,
                  borderRadius: 10,
                  padding: "12px 16px",
                  fontSize: 14,
                  color: C.textMuted,
                  lineHeight: 1.7,
                }}
              >
                {typeof entry === "string" ? entry : JSON.stringify(entry)}
              </div>
            ))}
          </div>
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
  sourceIntegrityEnrichmentNote,
  onSourceIntegrityEnrichmentNoteChange,
  pronounDecisions,
  onPronounDecision,
}: {
  layerKey: string;
  data: Record<string, unknown> | undefined | null;
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
      return <RelationshipNetworkLayer data={data} />;
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
