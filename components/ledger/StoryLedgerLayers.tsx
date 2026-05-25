/**
 * StoryLedgerLayers.tsx
 *
 * Purpose-built UI maps for all 8 canonical Story Ledger layers.
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

// ─── Author-facing layer descriptions (permanent, locked) ───────────────────
const LAYER_DESCRIPTIONS: Record<string, string> = {
  source_integrity_layer:
    "Did the system read your manuscript cleanly? Confirms that your text was extracted without corruption, missing sections, or gaps — so every finding traces back to real pages.",
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

function FieldRow({
  label,
  value,
  mono = false,
}: {
  label: string;
  value?: unknown;
  mono?: boolean;
}) {
  const display = (() => {
    if (value === null || value === undefined || value === "") return null;
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      return (value as unknown[])
        .map((v) => (typeof v === "string" ? v : JSON.stringify(v)))
        .join(", ");
    }
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  })();

  if (!display) return null;

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
        <span style={{ fontSize: 15, color: C.textPrimary, lineHeight: 1.75 }}>
          {display}
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
}: {
  data?: Record<string, unknown> | null;
}) {
  if (!data || Object.keys(data).length === 0)
    return (
      <LayerShell
        empty
        emptyLabel="Source integrity data not yet populated."
        emptyDetail="This layer will populate once your manuscript has been read and processed."
      />
    );

  const risk = String(data.source_integrity_risk ?? "").toLowerCase();
  const tone = risk === "high" ? "block" : risk === "medium" ? "warn" : "neutral";
  const extracted = data.extraction_integrity_status;
  const missingFlags = data.missing_text_flags as string[] | null;
  const truncFlags = data.truncation_flags as string[] | null;
  const chapterMap = data.chapter_scene_map;

  return (
    <LayerShell tone={tone}>
      <LayerTitle
        icon="🔒"
        title="Source Integrity"
        description={LAYER_DESCRIPTIONS.source_integrity_layer}
        badge={extracted ? String(extracted) : undefined}
        badgeTone={
          String(extracted ?? "").toLowerCase() === "verified" ? "green" : "warn"
        }
      />

      {risk === "high" && (
        <BlockerBanner reason="High source integrity risk — evaluation results may be unreliable until resolved." />
      )}
      {risk === "medium" && (
        <WarnBanner reason="Moderate integrity risk — some evidence spans may be misaligned." />
      )}

      <div>
        <FieldRow label="Word count" value={data.word_count} />
        <FieldRow label="Chapter count" value={data.chapter_count} />
        <FieldRow label="Evidence spans" value={data.evidence_span_count} />
        <FieldRow label="Manuscript version" value={data.manuscript_version} />
      </div>

      {missingFlags && missingFlags.length > 0 && (
        <>
          <SubHeading>Missing Text Flags</SubHeading>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {missingFlags.map((f, i) => (
              <Pill key={i} label={f} tone="oxblood" />
            ))}
          </div>
        </>
      )}

      {truncFlags && truncFlags.length > 0 && (
        <>
          <SubHeading>Truncation Flags</SubHeading>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 8 }}>
            {truncFlags.map((f, i) => (
              <Pill key={i} label={f} tone="warn" />
            ))}
          </div>
        </>
      )}

      {chapterMap && (
        <>
          <SubHeading>Chapter / Scene Map</SubHeading>
          <pre
            style={{
              margin: 0,
              fontSize: 12,
              color: C.textPrimary,
              background: C.surfaceAlt,
              borderRadius: 8,
              padding: "12px 16px",
              overflowX: "auto",
              border: `1px solid ${C.border}`,
              lineHeight: 1.6,
            }}
          >
            {typeof chapterMap === "string"
              ? chapterMap
              : JSON.stringify(chapterMap, null, 2)}
          </pre>
        </>
      )}

      <div
        style={{
          marginTop: 18,
          borderTop: `1px solid ${C.border}`,
          paddingTop: 12,
          display: "flex",
          gap: 8,
          flexWrap: "wrap",
        }}
      >
        <Pill
          label={`Risk: ${String(data.source_integrity_risk ?? "unknown")}`}
          tone={
            risk === "high" ? "oxblood" : risk === "medium" ? "warn" : "green"
          }
        />
        {data.evidence_span_count !== undefined && (
          <Pill label={`${data.evidence_span_count} evidence spans`} tone="blue" />
        )}
      </div>
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

  return (
    <LayerShell>
      <LayerTitle
        icon="🪪"
        title="Canonical Identity"
        description={LAYER_DESCRIPTIONS.canonical_identity_layer}
        badge={`${identities.length} ${identities.length === 1 ? "identity" : "identities"}`}
        badgeTone="gold"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
        {identities.map((id, i) => {
          const name = String(id.canonical_name ?? id.name ?? `Character ${i + 1}`);
          const aliases = id.aliases as string[] | null;
          const pronouns = id.pronouns;
          const role = id.role;
          const legalNames = id.legal_name_states;
          const captivityNames = id.captivity_name_states;
          const postResolutionNames = id.post_resolution_name_states;
          const anchors = id.evidence_anchors as string[] | null;

          return (
            <CharacterCard key={i}>
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
                {postResolutionNames && (
                  <FieldRow label="Post-resolution names" value={postResolutionNames} />
                )}
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
        })}
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
            const typeArr: string[] = Array.isArray(types)
              ? (types as string[])
              : types
                ? [String(types)]
                : [];
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
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {itemArray.map((item, i) => {
            const name = String(item.object_name ?? item.name ?? `Object ${i + 1}`);
            const holder = item.current_holder ? String(item.current_holder) : null;
            const attachedChars = Array.isArray(item.attached_characters)
              ? (item.attached_characters as unknown[])
                  .map((c) => String(c))
                  .filter((c) => c !== holder)
              : [];
            const transfers = Array.isArray(item.transfer_events)
              ? (item.transfer_events as unknown[])
              : [];
            const payoff = item.payoff_description ? String(item.payoff_description) : null;
            const critical = item.missed_if_absent_from_report === true;
            const narrativeFunction = functionByName[name] ?? null;

            return (
              <CharacterCard key={i}>
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
                  <p
                    style={{
                      margin: "8px 0 0",
                      fontSize: 14,
                      color: C.textMuted,
                      lineHeight: 1.65,
                    }}
                  >
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
          })}
        </div>
      )}
    </LayerShell>
  );
}

// ─── Layer 7 — Location · Timeline · World State ──────────────────────────────

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

  const locations =
    data.locations ?? data.location_list ?? data.location_entries;
  const locationArray: Record<string, unknown>[] = Array.isArray(locations)
    ? (locations as Record<string, unknown>[])
    : [];

  const continuityRisks = data.continuity_risks as string[] | null;
  const worldStateRules = data.world_state_rules;

  return (
    <LayerShell>
      <LayerTitle
        icon="🗺"
        title="Location · Timeline · World State"
        description={LAYER_DESCRIPTIONS.location_timeline_worldstate_layer}
        badge={
          locationArray.length > 0
            ? `${locationArray.length} locations`
            : undefined
        }
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
                    <p key={i} style={{ margin: i > 0 ? "8px 0 0" : 0 }}>
                      {r}
                    </p>
                  ))
                : JSON.stringify(worldStateRules, null, 2)}
          </div>
        </>
      )}

      {locationArray.length > 0 && (
        <>
          <SubHeading>Locations</SubHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {locationArray.map((loc, i) => {
              const name = String(
                loc.location_name ?? loc.name ?? `Location ${i + 1}`
              );
              const anchors = loc.evidence_anchors as string[] | null;
              const chars = loc.characters_present as string[] | null;

              return (
                <CharacterCard
                  key={i}
                  style={{ borderRadius: 10, padding: "14px 18px" }}
                >
                  <div
                    style={{
                      display: "flex",
                      justifyContent: "space-between",
                      flexWrap: "wrap",
                      gap: 8,
                      marginBottom: 10,
                    }}
                  >
                    <span
                      style={{
                        fontWeight: 700,
                        color: C.textPrimary,
                        fontSize: 15,
                      }}
                    >
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
                    {loc.first_appearance && (
                      <FieldRow
                        label="First appearance"
                        value={loc.first_appearance}
                      />
                    )}
                    {loc.movement_path && (
                      <FieldRow label="Movement path" value={loc.movement_path} />
                    )}
                    {loc.time_sequence && (
                      <FieldRow label="Time sequence" value={loc.time_sequence} />
                    )}
                    {loc.world_state_rules && (
                      <FieldRow
                        label="World state rules"
                        value={loc.world_state_rules}
                      />
                    )}
                  </div>
                  {loc.continuity_risks && (
                    <WarnBanner reason={String(loc.continuity_risks)} />
                  )}
                  {anchors && anchors.length > 0 && (
                    <div
                      style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}
                    >
                      {anchors.map((a, j) => (
                        <EvidenceTag key={j} id={a} />
                      ))}
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

      {Object.entries(data)
        .filter(
          ([k]) =>
            !["locations", "location_list", "location_entries", "world_state_rules", "continuity_risks"].includes(k)
        )
        .filter(
          ([, v]) =>
            v !== null && v !== undefined && !Array.isArray(v) && typeof v !== "object"
        )
        .map(([k, v]) => (
          <FieldRow key={k} label={k.replace(/_/g, " ")} value={v} />
        ))}
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
    ? (data.psychology_ledger as PsychologyEntry[])
    : [];
  const psychologyEntries = psychologyLedger.filter((entry) => {
    const mechs = entry.copingMechanisms;
    return Array.isArray(mechs) && mechs.length > 0;
  });

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
  const badgeLabel = `${antagonistCount} antagonist${antagonistCount === 1 ? "" : "s"}`;

  return (
    <LayerShell tone={hasAntagonists ? "neutral" : "block"}>
      <LayerTitle
        icon="⚔️"
        title="Threat · Antagonist · Ending"
        description={LAYER_DESCRIPTIONS.threat_antagonist_ending_layer}
        badge={badgeLabel}
        badgeTone={hasAntagonists ? "oxblood" : "neutral"}
      />

      <SubHeading>Antagonists</SubHeading>

      {hasAntagonists ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
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
                  <span
                    style={{
                      fontWeight: 700,
                      color: C.textPrimary,
                      fontSize: 16,
                    }}
                  >
                    {name}
                  </span>
                  {status && (
                    <Pill label={status.replace(/_/g, " ")} tone={tone} />
                  )}
                </div>
              </CharacterCard>
            );
          })}
        </div>
      ) : (
        <p style={{ color: C.textFaint, fontSize: 15, lineHeight: 1.75 }}>
          No antagonists identified in this chapter.
        </p>
      )}

      {psychologyEntries.length > 0 && (
        <>
          <Divider />
          <SubHeading>Character Pressure Profiles</SubHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
            {psychologyEntries.map((entry, i) => {
              const rawId =
                typeof entry.characterId === "string" ? entry.characterId : "";
              const name = rawId ? sentenceCaseId(rawId) : `Character ${i + 1}`;
              const mechanisms = (entry.copingMechanisms as CopingMechanism[]) ?? [];

              return (
                <CharacterCard key={i}>
                  <div
                    style={{
                      fontWeight: 700,
                      color: C.textPrimary,
                      fontSize: 16,
                      marginBottom: 10,
                    }}
                  >
                    {name}
                  </div>
                  <div
                    style={{
                      display: "flex",
                      flexDirection: "column",
                      gap: 10,
                    }}
                  >
                    {mechanisms.map((mech, j) => {
                      const prose =
                        typeof mech.description === "string" && mech.description
                          ? mech.description
                          : typeof mech.manifestsAs === "string"
                            ? mech.manifestsAs
                            : "";
                      const fn =
                        typeof mech.psychologicalFunction === "string"
                          ? mech.psychologicalFunction
                          : "";

                      return (
                        <div
                          key={j}
                          style={{
                            display: "flex",
                            flexDirection: "column",
                            gap: 6,
                          }}
                        >
                          {prose && (
                            <p
                              style={{
                                margin: 0,
                                fontSize: 14,
                                color: C.textMuted,
                                lineHeight: 1.75,
                              }}
                            >
                              {prose}
                            </p>
                          )}
                          {fn && (
                            <div>
                              <Pill
                                label={fn.replace(/_/g, " ")}
                                tone="neutral"
                              />
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </CharacterCard>
              );
            })}
          </div>
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

// ─── Master dispatcher ────────────────────────────────────────────────────────

/**
 * Dispatches the correct purpose-built layer renderer based on layer key.
 * Drop-in replacement for the old generic StoryLayerPanel.
 */
export function StoryLayerRenderer({
  layerKey,
  data,
}: {
  layerKey: string;
  data: Record<string, unknown> | undefined | null;
}) {
  switch (layerKey) {
    case "source_integrity_layer":
      return <SourceIntegrityLayer data={data} />;
    case "pov_structure_layer":
      return <PovStructureLayer data={data} />;
    case "canonical_identity_layer":
      return <CanonicalIdentityLayer data={data} />;
    case "cast_role_tier_layer":
      return <CastRoleTierLayer data={data} />;
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
