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
  textFaint: "#5C5A56",
  goldLight: "rgba(169,142,74,0.12)",
  oxbloodLight: "rgba(122,30,30,0.12)",
  successLight: "rgba(52,168,83,0.12)",
  warnLight: "rgba(230,162,60,0.12)",
};

// ─── Shared primitives ───────────────────────────────────────────────────────

function SectionHeader({
  icon,
  title,
  subtitle,
  badge,
  badgeTone = "neutral",
}: {
  icon: string;
  title: string;
  subtitle?: string;
  badge?: string;
  badgeTone?: "neutral" | "gold" | "oxblood" | "green" | "warn";
}) {
  const badgeStyle: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "2px 10px",
    borderRadius: 99,
    fontSize: 11,
    fontWeight: 700,
    letterSpacing: "0.06em",
    textTransform: "uppercase" as const,
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
    <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", gap: 12, marginBottom: 20 }}>
      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
        <span style={{ fontSize: 18 }}>{icon}</span>
        <div>
          <h3 style={{ margin: 0, fontSize: 13, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textPrimary }}>
            {title}
          </h3>
          {subtitle && (
            <p style={{ margin: "2px 0 0", fontSize: 11, color: C.textMuted }}>{subtitle}</p>
          )}
        </div>
      </div>
      {badge && <span style={badgeStyle}>{badge}</span>}
    </div>
  );
}

function LayerShell({
  children,
  tone = "neutral",
  empty = false,
  emptyLabel,
}: {
  children?: React.ReactNode;
  tone?: "neutral" | "warn" | "block";
  empty?: boolean;
  emptyLabel?: string;
}) {
  const borderColor =
    tone === "block" ? C.oxblood : tone === "warn" ? "#6B5B00" : C.border;

  if (empty) {
    return (
      <div
        style={{
          border: `1px dashed ${C.border}`,
          borderRadius: 12,
          padding: 20,
          background: C.surface,
          color: C.textFaint,
          fontSize: 13,
          textAlign: "center",
        }}
      >
        {emptyLabel ?? "No data populated for this layer."}
      </div>
    );
  }

  return (
    <div
      style={{
        border: `1px solid ${borderColor}`,
        borderRadius: 12,
        padding: "20px 22px",
        background: C.surface,
        marginBottom: 4,
      }}
    >
      {children}
    </div>
  );
}

function FieldRow({ label, value, mono = false }: { label: string; value?: unknown; mono?: boolean }) {
  const display = (() => {
    if (value === null || value === undefined || value === "") return null;
    if (Array.isArray(value)) {
      if (value.length === 0) return null;
      return (value as unknown[]).map((v) => (typeof v === "string" ? v : JSON.stringify(v))).join(", ");
    }
    if (typeof value === "object") return JSON.stringify(value, null, 2);
    return String(value);
  })();

  if (!display) return null;

  return (
    <div style={{ display: "grid", gridTemplateColumns: "160px 1fr", gap: "4px 16px", padding: "7px 0", borderBottom: `1px solid ${C.border}`, alignItems: "start" }}>
      <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textMuted, paddingTop: 1 }}>
        {label}
      </span>
      {mono ? (
        <pre style={{ margin: 0, fontSize: 11, color: C.textPrimary, whiteSpace: "pre-wrap", fontFamily: "monospace" }}>
          {display}
        </pre>
      ) : (
        <span style={{ fontSize: 13, color: C.textPrimary, lineHeight: 1.5 }}>{display}</span>
      )}
    </div>
  );
}

function Pill({ label, tone = "neutral" }: { label: string; tone?: "neutral" | "gold" | "oxblood" | "green" | "warn" | "blue" }) {
  const styles: React.CSSProperties = {
    display: "inline-flex",
    alignItems: "center",
    padding: "3px 10px",
    borderRadius: 99,
    fontSize: 11,
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
    <span style={{ fontFamily: "monospace", fontSize: 10, color: C.gold, background: C.goldLight, padding: "2px 7px", borderRadius: 4 }}>
      {id}
    </span>
  );
}

function BlockerBanner({ reason }: { reason: string }) {
  return (
    <div style={{ background: C.oxbloodLight, border: `1px solid ${C.oxblood}55`, borderLeft: `3px solid ${C.oxblood}`, borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#C05050", marginBottom: 12 }}>
      ⛔ {reason}
    </div>
  );
}

function WarnBanner({ reason }: { reason: string }) {
  return (
    <div style={{ background: C.warnLight, border: "1px solid rgba(230,162,60,0.3)", borderLeft: "3px solid #E6A23C", borderRadius: 6, padding: "8px 12px", fontSize: 12, color: "#E6A23C", marginBottom: 12 }}>
      ⚠ {reason}
    </div>
  );
}

function Divider() {
  return <div style={{ borderBottom: `1px solid ${C.border}`, margin: "14px 0" }} />;
}

function SubHeading({ children }: { children: React.ReactNode }) {
  return (
    <p style={{ margin: "16px 0 8px", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.textMuted }}>
      {children}
    </p>
  );
}

// ─── Layer 1 — Source Integrity ──────────────────────────────────────────────

export function SourceIntegrityLayer({ data }: { data?: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0)
    return <LayerShell empty emptyLabel="Source integrity data not yet populated." />;

  const risk = String(data.source_integrity_risk ?? "").toLowerCase();
  const tone = risk === "high" ? "block" : risk === "medium" ? "warn" : "neutral";
  const extracted = data.extraction_integrity_status;
  const missingFlags = data.missing_text_flags as string[] | null;
  const truncFlags = data.truncation_flags as string[] | null;
  const chapterMap = data.chapter_scene_map;

  return (
    <LayerShell tone={tone}>
      <SectionHeader
        icon="🔒"
        title="Source Integrity"
        subtitle="Manuscript extraction health and evidence alignment"
        badge={extracted ? String(extracted) : undefined}
        badgeTone={String(extracted ?? "").toLowerCase() === "verified" ? "green" : "warn"}
      />

      {risk === "high" && <BlockerBanner reason="High source integrity risk — evaluation results may be unreliable until resolved." />}
      {risk === "medium" && <WarnBanner reason="Moderate integrity risk — some evidence spans may be misaligned." />}

      <div>
        <FieldRow label="Word count" value={data.word_count} />
        <FieldRow label="Chapter count" value={data.chapter_count} />
        <FieldRow label="Evidence spans" value={data.evidence_span_count} />
        <FieldRow label="Manuscript version" value={data.manuscript_version} />
      </div>

      {(missingFlags && missingFlags.length > 0) && (
        <>
          <SubHeading>Missing Text Flags</SubHeading>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {missingFlags.map((f, i) => <Pill key={i} label={f} tone="oxblood" />)}
          </div>
        </>
      )}

      {(truncFlags && truncFlags.length > 0) && (
        <>
          <SubHeading>Truncation Flags</SubHeading>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {truncFlags.map((f, i) => <Pill key={i} label={f} tone="warn" />)}
          </div>
        </>
      )}

      {chapterMap && (
        <>
          <SubHeading>Chapter / Scene Map</SubHeading>
          <pre style={{ margin: 0, fontSize: 11, color: C.textPrimary, background: C.surfaceAlt, borderRadius: 6, padding: "10px 12px", overflowX: "auto", border: `1px solid ${C.border}` }}>
            {typeof chapterMap === "string" ? chapterMap : JSON.stringify(chapterMap, null, 2)}
          </pre>
        </>
      )}

      <div style={{ marginTop: 14, borderTop: `1px solid ${C.border}`, paddingTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
        <Pill label={`Risk: ${String(data.source_integrity_risk ?? "unknown")}`} tone={risk === "high" ? "oxblood" : risk === "medium" ? "warn" : "green"} />
        {data.evidence_span_count !== undefined && <Pill label={`${data.evidence_span_count} evidence spans`} tone="blue" />}
      </div>
    </LayerShell>
  );
}

// ─── Layer 2 — POV Structure ─────────────────────────────────────────────────

export function PovStructureLayer({ data }: { data?: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0)
    return <LayerShell empty emptyLabel="POV structure not yet mapped." />;

  const owners = data.pov_owners as unknown[] | null;
  const transitions = data.pov_transition_map as unknown[] | null;
  const confusionRisks = data.pov_confusion_risks as string[] | null;

  return (
    <LayerShell>
      <SectionHeader
        icon="👁"
        title="POV Structure"
        subtitle="Narrative perspective owners, voice markers, and camera distance"
        badge={data.primary_pov ? `Primary: ${String(data.primary_pov)}` : undefined}
        badgeTone="gold"
      />

      <div>
        <FieldRow label="Primary POV" value={data.primary_pov} />
        <FieldRow label="Secondary POV" value={data.secondary_pov} />
        <FieldRow label="Camera distance" value={data.camera_distance} />
        <FieldRow label="Narrative share" value={data.narrative_share_estimate} />
      </div>

      {(owners && owners.length > 0) && (
        <>
          <SubHeading>POV Owners</SubHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {(owners as Record<string, unknown>[]).map((owner, i) => (
              <div key={i} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "center", flexWrap: "wrap", gap: 6 }}>
                  <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 14 }}>
                    {String(owner.name ?? owner.character ?? `Owner ${i + 1}`)}
                  </span>
                  <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {owner.pov_type && <Pill label={String(owner.pov_type)} tone="blue" />}
                    {owner.narrative_share && <Pill label={String(owner.narrative_share)} tone="neutral" />}
                  </div>
                </div>
                {owner.voice_markers && (
                  <p style={{ margin: "6px 0 0", fontSize: 12, color: C.textMuted }}>
                    Voice: {String(owner.voice_markers)}
                  </p>
                )}
                {owner.section_label && (
                  <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>
                    Sections: {String(owner.section_label)}
                  </p>
                )}
              </div>
            ))}
          </div>
        </>
      )}

      {data.voice_markers && (
        <>
          <SubHeading>Voice Markers</SubHeading>
          <p style={{ fontSize: 13, color: C.textPrimary, margin: 0 }}>{String(data.voice_markers)}</p>
        </>
      )}

      {(data.focalized_sections) && (
        <>
          <SubHeading>Focalized Sections</SubHeading>
          <FieldRow label="" value={data.focalized_sections} />
        </>
      )}

      {(transitions && transitions.length > 0) && (
        <>
          <SubHeading>POV Transition Map</SubHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
            {(transitions as Record<string, unknown>[]).map((t, i) => (
              <div key={i} style={{ display: "flex", gap: 10, fontSize: 12, color: C.textMuted, background: C.surfaceAlt, borderRadius: 6, padding: "7px 10px" }}>
                {t.chapter && <span style={{ color: C.gold, fontWeight: 600 }}>{String(t.chapter)}</span>}
                {t.from && t.to && <span>{String(t.from)} → {String(t.to)}</span>}
                {t.note && <span>{String(t.note)}</span>}
              </div>
            ))}
          </div>
        </>
      )}

      {(confusionRisks && confusionRisks.length > 0) && (
        <>
          <SubHeading>Confusion Risks</SubHeading>
          {confusionRisks.map((r, i) => <WarnBanner key={i} reason={r} />)}
        </>
      )}
    </LayerShell>
  );
}

// ─── Layer 3 — Canonical Identity ────────────────────────────────────────────

export function CanonicalIdentityLayer({ data }: { data?: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0)
    return <LayerShell empty emptyLabel="Canonical identity mapping not yet built." />;

  const groups = data.canonical_identity_group as unknown[] | null;
  const singleGroup = data.canonical_name ?? data.canonical_identity;

  // Support both array-of-groups and single-identity shapes
  const identities: Record<string, unknown>[] = groups
    ? (groups as Record<string, unknown>[])
    : singleGroup
      ? [data as Record<string, unknown>]
      : [];

  if (identities.length === 0) {
    return (
      <LayerShell>
        <SectionHeader icon="🪪" title="Canonical Identity" subtitle="Alias merge and name-state timeline" />
        <p style={{ color: C.textFaint, fontSize: 13 }}>No identity groups extracted yet.</p>
      </LayerShell>
    );
  }

  return (
    <LayerShell>
      <SectionHeader
        icon="🪪"
        title="Canonical Identity"
        subtitle="Alias merge, name-states, and role assignment"
        badge={`${identities.length} ${identities.length === 1 ? "identity" : "identities"}`}
        badgeTone="gold"
      />

      <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
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
            <div key={i} style={{ background: C.surfaceAlt, border: `1px solid ${C.borderStrong}`, borderRadius: 10, padding: "14px 16px" }}>
              <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, marginBottom: 10 }}>
                <h4 style={{ margin: 0, fontSize: 16, fontWeight: 700, color: C.textPrimary }}>{name}</h4>
                <div style={{ display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {role && <Pill label={String(role)} tone={String(role).includes("protagonist") ? "gold" : String(role).includes("antagonist") ? "oxblood" : "neutral"} />}
                  {pronouns && <Pill label={String(pronouns)} tone="blue" />}
                </div>
              </div>

              {aliases && aliases.length > 0 && (
                <div style={{ marginBottom: 10 }}>
                  <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textMuted }}>
                    Aliases
                  </p>
                  <div style={{ display: "flex", flexWrap: "wrap", gap: 5 }}>
                    {aliases.map((a, j) => <Pill key={j} label={a} tone="neutral" />)}
                  </div>
                </div>
              )}

              <div>
                {legalNames && <FieldRow label="Legal name states" value={legalNames} />}
                {captivityNames && <FieldRow label="Captivity name states" value={captivityNames} />}
                {postResolutionNames && <FieldRow label="Post-resolution names" value={postResolutionNames} />}
              </div>

              {anchors && anchors.length > 0 && (
                <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                  {anchors.map((a, j) => <EvidenceTag key={j} id={a} />)}
                </div>
              )}
            </div>
          );
        })}
      </div>
    </LayerShell>
  );
}

// ─── Layer 4 — Cast & Role Tier ───────────────────────────────────────────────

const ROLE_TIER_ORDER = [
  "protagonist",
  "secondary_pov",
  "co_protagonist",
  "complex_antagonist",
  "antagonist",
  "major_secondary",
  "supporting_cast",
  "functional_scene_character",
  "institutional_actor",
] as const;

const ROLE_DISPLAY: Record<string, string> = {
  protagonist: "Protagonist",
  secondary_pov: "Secondary POV",
  co_protagonist: "Co-Protagonist",
  complex_antagonist: "Complex Antagonist",
  antagonist: "Antagonist",
  major_secondary: "Major Secondary",
  supporting_cast: "Supporting Cast",
  functional_scene_character: "Functional / Scene",
  institutional_actor: "Institutional Actor",
};

const ROLE_TONE: Record<string, "gold" | "oxblood" | "blue" | "neutral"> = {
  protagonist: "gold",
  secondary_pov: "gold",
  co_protagonist: "gold",
  complex_antagonist: "oxblood",
  antagonist: "oxblood",
  major_secondary: "blue",
  supporting_cast: "neutral",
  functional_scene_character: "neutral",
  institutional_actor: "blue",
};

export function CastRoleTierLayer({ data }: { data?: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0)
    return <LayerShell empty emptyLabel="Cast and role tiers not yet extracted." />;

  const hasAntagonists =
    ((data.antagonist as unknown[]) ?? []).length > 0 ||
    ((data.complex_antagonist as unknown[]) ?? []).length > 0;

  const totalCast = ROLE_TIER_ORDER.reduce((sum, key) => {
    const val = data[key];
    if (Array.isArray(val)) return sum + val.length;
    if (val) return sum + 1;
    return sum;
  }, 0);

  return (
    <LayerShell tone={!hasAntagonists ? "warn" : "neutral"}>
      <SectionHeader
        icon="🎭"
        title="Cast & Role Tier"
        subtitle="Full cast ranked by structural function"
        badge={`${totalCast} characters`}
        badgeTone="gold"
      />

      {!hasAntagonists && (
        <WarnBanner reason="No antagonists detected. This blocks approval for threat-driven manuscripts." />
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
        {ROLE_TIER_ORDER.map((tier) => {
          const val = data[tier];
          if (!val) return null;

          const entries: string[] = Array.isArray(val)
            ? (val as string[]).filter(Boolean)
            : [String(val)];

          if (entries.length === 0) return null;

          return (
            <div key={tier}>
              <p style={{ margin: "0 0 6px", fontSize: 11, fontWeight: 700, letterSpacing: "0.07em", textTransform: "uppercase", color: C.textMuted }}>
                {ROLE_DISPLAY[tier] ?? tier}
              </p>
              <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
                {entries.map((name, i) => (
                  <Pill key={i} label={name} tone={ROLE_TONE[tier] ?? "neutral"} />
                ))}
              </div>
            </div>
          );
        })}
      </div>

      {/* Render any extra keys not in canonical tier list */}
      {Object.entries(data)
        .filter(([k]) => !ROLE_TIER_ORDER.includes(k as typeof ROLE_TIER_ORDER[number]) && !k.startsWith("_"))
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => (
          <FieldRow key={k} label={k.replace(/_/g, " ")} value={v} />
        ))}
    </LayerShell>
  );
}

// ─── Layer 5 — Relationship Network ──────────────────────────────────────────

export function RelationshipNetworkLayer({ data }: { data?: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0)
    return <LayerShell empty emptyLabel="Relationship network not yet mapped." />;

  const pairs = data.relationship_pairs ?? data.pairs ?? data.relationships;
  const pairArray: Record<string, unknown>[] = Array.isArray(pairs)
    ? (pairs as Record<string, unknown>[])
    : [];

  const count = pairArray.length;

  return (
    <LayerShell>
      <SectionHeader
        icon="🔗"
        title="Relationship Network"
        subtitle="Typed arcs with origin, pressure, transformation, and final state"
        badge={count > 0 ? `${count} pairs` : undefined}
        badgeTone="neutral"
      />

      {count === 0 ? (
        <p style={{ color: C.textFaint, fontSize: 13 }}>No relationship pairs extracted yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 14 }}>
          {pairArray.map((pair, i) => {
            const a = String(pair.character_a ?? pair.from ?? pair.a ?? "—");
            const b = String(pair.character_b ?? pair.to ?? pair.b ?? "—");
            const types = pair.relationship_type ?? pair.type;
            const typeArr: string[] = Array.isArray(types)
              ? types as string[]
              : types
                ? [String(types)]
                : [];
            const evidenceAnchors = pair.evidence_anchors as string[] | null;

            return (
              <div key={i} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 16px" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 10, flexWrap: "wrap", marginBottom: 10 }}>
                  <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 14 }}>{a}</span>
                  <span style={{ color: C.gold, fontSize: 14 }}>↔</span>
                  <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 14 }}>{b}</span>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {typeArr.map((t, j) => <Pill key={j} label={t.replace(/_/g, " ")} tone="blue" />)}
                  </div>
                </div>

                <div>
                  {pair.relationship_origin && <FieldRow label="Origin" value={pair.relationship_origin} />}
                  {pair.initial_dynamic && <FieldRow label="Initial dynamic" value={pair.initial_dynamic} />}
                  {pair.pressure_points && <FieldRow label="Pressure" value={pair.pressure_points} />}
                  {pair.rupture_or_separation && <FieldRow label="Rupture / separation" value={pair.rupture_or_separation} />}
                  {pair.transformation && <FieldRow label="Transformation" value={pair.transformation} />}
                  {pair.current_or_final_state && <FieldRow label="Current / final state" value={pair.current_or_final_state} />}
                </div>

                {evidenceAnchors && evidenceAnchors.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {evidenceAnchors.map((a, j) => <EvidenceTag key={j} id={a} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}
    </LayerShell>
  );
}

// ─── Layer 6 — Object / Symbol ────────────────────────────────────────────────

const OBJECT_TYPE_TONE: Record<string, "oxblood" | "warn" | "gold" | "blue" | "neutral"> = {
  weapon: "oxblood",
  surveillance: "oxblood",
  identity_token: "gold",
  totem: "gold",
  foreshadow: "warn",
  trauma_anchor: "oxblood",
  domestic_anchor: "neutral",
  environmental: "neutral",
  legal_document: "blue",
  technology: "blue",
};

export function ObjectSymbolLayer({ data }: { data?: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0)
    return <LayerShell empty emptyLabel="Object and symbol ledger not yet populated." />;

  const items = data.objects ?? data.symbols ?? data.items ?? data.object_list;
  const itemArray: Record<string, unknown>[] = Array.isArray(items)
    ? (items as Record<string, unknown>[])
    : [];

  return (
    <LayerShell>
      <SectionHeader
        icon="🗡"
        title="Objects & Symbols"
        subtitle="Lifecycle tracking: first appearance → transfer → payoff"
        badge={itemArray.length > 0 ? `${itemArray.length} objects` : undefined}
        badgeTone="gold"
      />

      {itemArray.length === 0 ? (
        <p style={{ color: C.textFaint, fontSize: 13 }}>No objects or symbols extracted yet.</p>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 12 }}>
          {itemArray.map((item, i) => {
            const name = String(item.object_name ?? item.name ?? `Object ${i + 1}`);
            const objectType = String(item.object_type ?? "");
            const tone = OBJECT_TYPE_TONE[objectType] ?? "neutral";
            const payoffStatus = String(item.payoff_or_unresolved_status ?? item.payoff_status ?? "");
            const anchors = item.evidence_anchors as string[] | null;

            return (
              <div key={i} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 10, padding: "12px 16px" }}>
                <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 8, marginBottom: 8 }}>
                  <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 14 }}>{name}</span>
                  <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                    {objectType && <Pill label={objectType.replace(/_/g, " ")} tone={tone} />}
                    {payoffStatus && (
                      <Pill
                        label={payoffStatus.replace(/_/g, " ")}
                        tone={payoffStatus.includes("unresolved") ? "warn" : payoffStatus.includes("paid") ? "green" : "neutral"}
                      />
                    )}
                  </div>
                </div>

                <div>
                  {item.owner_or_holder && <FieldRow label="Owner / holder" value={item.owner_or_holder} />}
                  {item.first_appearance && <FieldRow label="First appearance" value={item.first_appearance} />}
                  {item.function && <FieldRow label="Function" value={item.function} />}
                  {item.recurrence && <FieldRow label="Recurrence" value={item.recurrence} />}
                  {item.transformation && <FieldRow label="Transformation" value={item.transformation} />}
                </div>

                {anchors && anchors.length > 0 && (
                  <div style={{ marginTop: 10, display: "flex", gap: 6, flexWrap: "wrap" }}>
                    {anchors.map((a, j) => <EvidenceTag key={j} id={a} />)}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      {/* Render any non-array top-level fields */}
      {Object.entries(data)
        .filter(([k]) => !["objects", "symbols", "items", "object_list"].includes(k) && !Array.isArray(data[k]))
        .filter(([, v]) => v !== null && v !== undefined)
        .map(([k, v]) => <FieldRow key={k} label={k.replace(/_/g, " ")} value={v} />)}
    </LayerShell>
  );
}

// ─── Layer 7 — Location · Timeline · World State ──────────────────────────────

export function LocationTimelineWorldstateLayer({ data }: { data?: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0)
    return <LayerShell empty emptyLabel="Location and timeline map not yet built." />;

  const locations = data.locations ?? data.location_list ?? data.location_entries;
  const locationArray: Record<string, unknown>[] = Array.isArray(locations)
    ? (locations as Record<string, unknown>[])
    : [];

  const continuityRisks = data.continuity_risks as string[] | null;
  const worldStateRules = data.world_state_rules;

  return (
    <LayerShell>
      <SectionHeader
        icon="🗺"
        title="Location · Timeline · World State"
        subtitle="Movement paths, world-state rules, and continuity risks"
        badge={locationArray.length > 0 ? `${locationArray.length} locations` : undefined}
        badgeTone="neutral"
      />

      {worldStateRules && (
        <>
          <SubHeading>World State Rules</SubHeading>
          <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.textPrimary, border: `1px solid ${C.border}`, marginBottom: 14 }}>
            {typeof worldStateRules === "string"
              ? worldStateRules
              : Array.isArray(worldStateRules)
                ? (worldStateRules as string[]).map((r, i) => <p key={i} style={{ margin: i > 0 ? "4px 0 0" : 0 }}>{r}</p>)
                : JSON.stringify(worldStateRules, null, 2)}
          </div>
        </>
      )}

      {locationArray.length > 0 && (
        <>
          <SubHeading>Locations</SubHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
            {locationArray.map((loc, i) => {
              const name = String(loc.location_name ?? loc.name ?? `Location ${i + 1}`);
              const anchors = loc.evidence_anchors as string[] | null;
              const chars = loc.characters_present as string[] | null;

              return (
                <div key={i} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "11px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, marginBottom: 8 }}>
                    <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 13 }}>{name}</span>
                    {chars && chars.length > 0 && (
                      <div style={{ display: "flex", gap: 5, flexWrap: "wrap" }}>
                        {chars.map((c, j) => <Pill key={j} label={c} tone="neutral" />)}
                      </div>
                    )}
                  </div>
                  <div>
                    {loc.first_appearance && <FieldRow label="First appearance" value={loc.first_appearance} />}
                    {loc.movement_path && <FieldRow label="Movement path" value={loc.movement_path} />}
                    {loc.time_sequence && <FieldRow label="Time sequence" value={loc.time_sequence} />}
                    {loc.world_state_rules && <FieldRow label="World state rules" value={loc.world_state_rules} />}
                  </div>
                  {loc.continuity_risks && (
                    <WarnBanner reason={String(loc.continuity_risks)} />
                  )}
                  {anchors && anchors.length > 0 && (
                    <div style={{ marginTop: 8, display: "flex", gap: 5, flexWrap: "wrap" }}>
                      {anchors.map((a, j) => <EvidenceTag key={j} id={a} />)}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </>
      )}

      {(continuityRisks && continuityRisks.length > 0) && (
        <>
          <SubHeading>Global Continuity Risks</SubHeading>
          {continuityRisks.map((r, i) => <WarnBanner key={i} reason={r} />)}
        </>
      )}

      {/* Top-level scalar fields */}
      {Object.entries(data)
        .filter(([k]) => !["locations", "location_list", "location_entries", "world_state_rules", "continuity_risks"].includes(k))
        .filter(([, v]) => v !== null && v !== undefined && !Array.isArray(v) && typeof v !== "object")
        .map(([k, v]) => <FieldRow key={k} label={k.replace(/_/g, " ")} value={v} />)}
    </LayerShell>
  );
}

// ─── Layer 8 — Threat · Antagonist · Ending ───────────────────────────────────

const ENDING_STATUS_TONE: Record<string, "green" | "oxblood" | "warn" | "neutral"> = {
  resolved: "green",
  transformed: "green",
  intentionally_unresolved: "warn",
  accidentally_abandoned: "oxblood",
  fate_unknown: "warn",
  dead: "oxblood",
  survived: "green",
  escaped: "green",
  imprisoned: "oxblood",
  extracted: "neutral",
  missing: "warn",
};

export function ThreatAntagonistEndingLayer({ data }: { data?: Record<string, unknown> | null }) {
  if (!data || Object.keys(data).length === 0)
    return <LayerShell empty emptyLabel="Threat, antagonist, and ending data not yet populated." />;

  const pressureVectors = data.narrative_pressure_vectors as Record<string, unknown>[] | null;
  const namedAntagonists = data.named_antagonists as string[] | null;
  const institutionalForces = data.institutional_forces as string[] | null;
  const environmentalThreats = data.environmental_threats as string[] | null;
  const internalPressures = data.internal_psychological_pressures as string[] | null;
  const finalStates = data.final_state_by_major_character as Record<string, unknown>[] | null;
  const unresolvedPromises = data.unresolved_promises as string[] | null;
  const intentionallyUnresolved = data.intentionally_unresolved_items as string[] | null;
  const accidentallyAbandoned = data.accidentally_abandoned_items as string[] | null;
  const escalationPath = data.escalation_path;
  const victims = data.victims_or_targets as string[] | null;

  const hasAntagonists = (namedAntagonists?.length ?? 0) > 0 || (institutionalForces?.length ?? 0) > 0;
  const hasAbandoned = (accidentallyAbandoned?.length ?? 0) > 0;

  return (
    <LayerShell tone={!hasAntagonists ? "block" : hasAbandoned ? "warn" : "neutral"}>
      <SectionHeader
        icon="⚔️"
        title="Threat · Antagonist · Ending"
        subtitle="Pressure vectors, antagonist map, and final character accountability"
        badge={hasAntagonists ? "Antagonists mapped" : "No antagonists"}
        badgeTone={hasAntagonists ? "green" : "oxblood"}
      />

      {!hasAntagonists && (
        <BlockerBanner reason="No named antagonists or institutional forces detected. This is a blocking condition for threat-driven manuscripts." />
      )}
      {hasAbandoned && (
        <WarnBanner reason="Accidentally abandoned story items detected — these block clean approval." />
      )}

      {/* Antagonists */}
      {(namedAntagonists && namedAntagonists.length > 0) && (
        <>
          <SubHeading>Named Antagonists</SubHeading>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {namedAntagonists.map((a, i) => <Pill key={i} label={a} tone="oxblood" />)}
          </div>
        </>
      )}

      {(institutionalForces && institutionalForces.length > 0) && (
        <>
          <SubHeading>Institutional Forces</SubHeading>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {institutionalForces.map((f, i) => <Pill key={i} label={f} tone="blue" />)}
          </div>
        </>
      )}

      {(environmentalThreats && environmentalThreats.length > 0) && (
        <>
          <SubHeading>Environmental Threats</SubHeading>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {environmentalThreats.map((t, i) => <Pill key={i} label={t} tone="warn" />)}
          </div>
        </>
      )}

      {(internalPressures && internalPressures.length > 0) && (
        <>
          <SubHeading>Internal Psychological Pressures</SubHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {internalPressures.map((p, i) => (
              <div key={i} style={{ fontSize: 13, color: C.textMuted, padding: "5px 10px", borderLeft: `2px solid ${C.borderStrong}`, background: C.surfaceAlt, borderRadius: "0 6px 6px 0" }}>
                {p}
              </div>
            ))}
          </div>
        </>
      )}

      {(victims && victims.length > 0) && (
        <>
          <SubHeading>Victims / Targets</SubHeading>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {victims.map((v, i) => <Pill key={i} label={v} tone="neutral" />)}
          </div>
        </>
      )}

      {escalationPath && (
        <>
          <SubHeading>Escalation Path</SubHeading>
          <div style={{ background: C.surfaceAlt, borderRadius: 8, padding: "10px 14px", fontSize: 13, color: C.textPrimary, border: `1px solid ${C.border}`, whiteSpace: "pre-wrap" }}>
            {typeof escalationPath === "string" ? escalationPath : JSON.stringify(escalationPath, null, 2)}
          </div>
        </>
      )}

      {/* Pressure vectors */}
      {(pressureVectors && pressureVectors.length > 0) && (
        <>
          <SubHeading>Narrative Pressure Vectors</SubHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {pressureVectors.map((vec, i) => {
              const source = String(vec.vector_source ?? vec.source ?? `Vector ${i + 1}`);
              const impact = vec.structural_impact_score;
              const impactNum = typeof impact === "number" ? impact : null;

              return (
                <div key={i} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px" }}>
                  <div style={{ display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 6, marginBottom: 6 }}>
                    <Pill label={source.replace(/_/g, " ")} tone="oxblood" />
                    {impactNum !== null && (
                      <span style={{ fontSize: 11, color: C.gold, fontWeight: 700 }}>
                        Impact {impactNum}/5 {"★".repeat(impactNum)}{"☆".repeat(5 - impactNum)}
                      </span>
                    )}
                  </div>
                  {vec.evidence_summary && (
                    <p style={{ margin: 0, fontSize: 12, color: C.textMuted, lineHeight: 1.5 }}>
                      {String(vec.evidence_summary)}
                    </p>
                  )}
                  {vec.character && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textFaint }}>Character: {String(vec.character)}</p>}
                </div>
              );
            })}
          </div>
        </>
      )}

      <Divider />

      {/* Ending Accountability */}
      <SubHeading>Ending Accountability</SubHeading>

      {(finalStates && finalStates.length > 0) ? (
        <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
          {finalStates.map((fs, i) => {
            const name = String(fs.character ?? fs.name ?? `Character ${i + 1}`);
            const status = String(fs.ending_status ?? fs.status ?? fs.final_state ?? "");
            const tone = ENDING_STATUS_TONE[status.toLowerCase()] ?? "neutral";
            const lastEvidence = fs.last_evidence_reference ?? fs.last_evidence;
            const outcome = fs.one_line_outcome ?? fs.outcome ?? fs.note;

            return (
              <div key={i} style={{ background: C.surfaceAlt, border: `1px solid ${C.border}`, borderRadius: 8, padding: "10px 14px", display: "flex", justifyContent: "space-between", flexWrap: "wrap", gap: 8, alignItems: "flex-start" }}>
                <div>
                  <span style={{ fontWeight: 700, color: C.textPrimary, fontSize: 13 }}>{name}</span>
                  {outcome && <p style={{ margin: "4px 0 0", fontSize: 12, color: C.textMuted }}>{String(outcome)}</p>}
                  {lastEvidence && (
                    <div style={{ marginTop: 6 }}>
                      <EvidenceTag id={String(lastEvidence)} />
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4 }}>
                  {status && <Pill label={status.replace(/_/g, " ")} tone={tone} />}
                  {status === "accidentally_abandoned" && (
                    <span style={{ fontSize: 10, color: "#C05050" }}>⛔ Blocks approval</span>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      ) : (
        <p style={{ color: C.textFaint, fontSize: 13 }}>No final character states extracted yet.</p>
      )}

      {/* Unresolved promises */}
      {(unresolvedPromises && unresolvedPromises.length > 0) && (
        <>
          <SubHeading>Unresolved Promises</SubHeading>
          <div style={{ display: "flex", flexDirection: "column", gap: 4 }}>
            {unresolvedPromises.map((p, i) => (
              <div key={i} style={{ fontSize: 12, color: C.textMuted, padding: "5px 10px", borderLeft: "2px solid #6B5B00", background: C.surfaceAlt, borderRadius: "0 6px 6px 0" }}>
                {p}
              </div>
            ))}
          </div>
        </>
      )}

      {(intentionallyUnresolved && intentionallyUnresolved.length > 0) && (
        <>
          <SubHeading>Intentionally Unresolved</SubHeading>
          <div style={{ display: "flex", flexWrap: "wrap", gap: 6 }}>
            {intentionallyUnresolved.map((item, i) => <Pill key={i} label={item} tone="warn" />)}
          </div>
        </>
      )}

      {(accidentallyAbandoned && accidentallyAbandoned.length > 0) && (
        <>
          <SubHeading>Accidentally Abandoned</SubHeading>
          {accidentallyAbandoned.map((item, i) => <BlockerBanner key={i} reason={item} />)}
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

  const pct = Math.round((summary.populated_layers / summary.total_layers) * 100);
  const hasEmpty = (summary.empty_layers?.length ?? 0) > 0;
  const hasDegraded = (summary.degraded_layers?.length ?? 0) > 0;

  return (
    <div style={{ background: C.surface, border: `1px solid ${C.border}`, borderRadius: 10, padding: "14px 18px", marginBottom: 20, display: "flex", alignItems: "center", gap: 16, flexWrap: "wrap" }}>
      <div style={{ flex: 1, minWidth: 180 }}>
        <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 6 }}>
          <span style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textMuted }}>
            Layer Completion
          </span>
          <span style={{ fontSize: 11, fontWeight: 700, color: pct === 100 ? "#5CB85C" : pct >= 50 ? C.gold : "#C05050" }}>
            {summary.populated_layers}/{summary.total_layers} ({pct}%)
          </span>
        </div>
        <div style={{ height: 6, background: C.surfaceAlt, borderRadius: 99, overflow: "hidden" }}>
          <div style={{ height: "100%", width: `${pct}%`, background: pct === 100 ? "#34A853" : pct >= 50 ? C.gold : C.oxblood, borderRadius: 99, transition: "width 0.3s" }} />
        </div>
      </div>

      <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
        {hasEmpty && (
          <Pill label={`${summary.empty_layers!.length} empty`} tone="warn" />
        )}
        {hasDegraded && (
          <Pill label={`${summary.degraded_layers!.length} degraded`} tone="oxblood" />
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
      // Fallback for any unknown layer key
      if (!data || Object.keys(data).length === 0) {
        return (
          <div style={{ border: `1px dashed ${C.border}`, borderRadius: 12, padding: 20, background: C.surface, color: C.textFaint, fontSize: 13 }}>
            No data for layer: {layerKey}
          </div>
        );
      }
      return (
        <div style={{ border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, background: C.surface }}>
          <p style={{ fontSize: 11, fontWeight: 700, letterSpacing: "0.06em", textTransform: "uppercase", color: C.textMuted, marginBottom: 12 }}>
            {layerKey.replace(/_/g, " ")}
          </p>
          <dl style={{ display: "flex", flexDirection: "column", gap: 8 }}>
            {Object.entries(data).filter(([k]) => !k.startsWith("_")).map(([k, v]) => (
              <FieldRow key={k} label={k.replace(/_/g, " ")} value={v} />
            ))}
          </dl>
        </div>
      );
  }
}
