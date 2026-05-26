# Threat Force Extraction Lessons — Threat / Pressure / Ending

**Status:** Canon addendum / training fixture doctrine  
**Scope:** Phase 1A Story Ledger extraction, especially the user-facing **Threat / Pressure / Ending** layer  
**Origin case:** `river_remembers_blood_ch3_threat_force_failure`  
**Purpose:** Prevent future evaluations from treating threat as only a named-character antagonist.

---

## UI layer-order note

In the current Story Ledger UI, **Threat / Pressure / Ending** is the seventh displayed story layer, and **Source Integrity** is displayed after it.

Older internal code/docs may list `source_integrity_layer` first and `threat_antagonist_ending_layer` later because of artifact object ordering. Product-facing doctrine should refer to this surface by name:

> **Threat / Pressure / Ending**

Avoid calling it “Layer 8” in user-facing or product-facing language.

This doctrine does **not** create a new layer. It broadens what the existing Threat / Pressure / Ending layer must be able to capture.

---

## 1. Core lesson

A Story Ledger threat is not limited to a named antagonist.

A threat force is any person, animal, institution, environment, belief system, social pressure, mystery, deadline, psychological state, symbolic force, or unresolved consequence that creates:

- danger
- stakes
- dread
- escalation
- narrative pressure
- consequence
- mystery
- forward motion
- ending instability

The evaluation process must detect **what applies pressure**, not merely **who is the antagonist**.

---

## 2. Failure pattern

The failed extraction pattern is:

```ts
named character with role_signal === "antagonist"
```

That pattern is insufficient because many literary, memoir, eco-thriller, speculative, historical, and place-based narratives use non-character pressure systems.

Examples:

- a river that judges or remembers
- a mountain, storm, disease, fire, famine, or landscape
- a police system, court, cartel, mine, school, government, or hospital
- industrial intrusion or cultural encroachment
- grief, shame, paranoia, addiction, trauma
- a missing person or unresolved disappearance
- social exclusion or non-belonging
- animal/predator logic
- spiritual or belief-based pressure
- an ending where danger remains active

If Phase 1A only extracts named antagonists, it will under-read threat-driven manuscripts.

---

## 3. Threat / Pressure / Ending canon

`threat_antagonist_ending_layer` must include both:

1. `named_antagonists`
2. `threat_forces`

This does **not** create a new Story Ledger layer.

Threat forces are a required substructure of the existing Threat / Pressure / Ending layer.

Recommended shape:

```ts
threat_antagonist_ending_layer: {
  schema_version: "threat_antagonist_ending_layer_v2";

  named_antagonists: Array<NamedAntagonist>;
  threat_forces: Array<ThreatForceLedgerEntry>;

  pressure_map: {
    primary_pressure: string | null;
    secondary_pressures: string[];
    false_leads: string[];
    mirror_threats: string[];
  };

  ending_accountability: {
    ending_state: "resolved" | "unresolved" | "escalated" | "ambiguous";
    unresolved_threats: string[];
    final_pressure_image: string | null;
  };

  extraction_quality: {
    threat_force_count: number;
    non_character_threat_count: number;
    named_antagonist_count: number;
    warnings: string[];
  };
}
```

---

## 4. Threat force type contract

```ts
export type ThreatForceType =
  | "named_character_antagonist"
  | "environmental_force"
  | "animal_predator_force"
  | "institutional_force"
  | "cultural_encroachment"
  | "industrial_pressure"
  | "supernatural_or_belief_force"
  | "psychological_threat"
  | "social_pressure"
  | "time_deadline"
  | "moral_spiritual_judgment"
  | "unresolved_mystery"
  | "existential_pressure";

export type ThreatSignalType =
  | "direct_threat_statement"
  | "missing_person_or_disappearance"
  | "environmental_anomaly"
  | "animal_behavior_warning"
  | "institutional_absence"
  | "trespass_or_violation"
  | "historical_precedent"
  | "ending_threat_signal"
  | "psychological_trigger"
  | "social_or_cultural_pressure";

export interface ThreatForceLedgerEntry {
  threat_id: string;
  display_name: string;
  threat_type: ThreatForceType;
  character_id: string | null;
  object_id?: string | null;
  location_id?: string | null;
  pressure_function: string;
  target_scope: "individual" | "family" | "community" | "land" | "culture" | "manuscript_global";
  targets: string[];
  first_detected_chunk: number;
  last_detected_chunk: number;
  escalation_state: "introduced" | "active" | "escalated" | "partially_resolved" | "resolved" | "unresolved";
  evidence_anchors: Array<{
    chunk_index: number;
    excerpt: string;
    signal_type: ThreatSignalType;
    confidence: "explicit" | "strong_inference" | "weak_inference";
  }>;
  antagonist_function: "primary" | "secondary" | "mirror" | "false_lead" | "background_pressure" | "inciting_pressure";
  ending_relevance: string;
  extraction_confidence: "high" | "moderate" | "low";
}
```

---

## 5. Prompt doctrine

Phase 1A must be instructed:

```text
Extract threat forces, not only antagonists.

A threat force is anything that creates pressure, danger, stakes, dread, escalation,
consequence, mystery, or forward motion.

Threat forces may be named characters, unnamed groups, animals, landscapes,
institutions, belief systems, psychological pressure, disappearances, scarcity,
pursuit, unresolved mysteries, or ending danger signals.

Do not require character_id.

If the threat is not a character, emit character_id: null when the artifact shape supports it.
When the artifact shape is character-led, represent non-character threats as symbolic_force or collective_force candidates.
```

---

## 6. River Remembers Blood — golden lesson

The chapter-level failure case proved the need for this broadened extraction scope.

Minimum acceptable extraction:

```json
{
  "case_id": "river_remembers_blood_ch3_threat_force_failure",
  "expected_minimum_threat_forces": [
    {
      "threat_id": "river_judgment_force",
      "display_name": "The river",
      "threat_type": "environmental_force",
      "character_id": null,
      "antagonist_function": "primary",
      "required": true
    },
    {
      "threat_id": "trespass_imbalance",
      "display_name": "Trespass / imbalance",
      "threat_type": "moral_spiritual_judgment",
      "character_id": null,
      "antagonist_function": "secondary",
      "required": true
    },
    {
      "threat_id": "missing_man_white_truck",
      "display_name": "Missing man / vanished truck",
      "threat_type": "unresolved_mystery",
      "character_id": null,
      "antagonist_function": "inciting_pressure",
      "required": true
    }
  ],
  "should_detect": [
    "cultural_industrial_encroachment",
    "pv115_shadow",
    "predator_balance_logic",
    "belonging_non_belonging",
    "unresolved_ending_pressure"
  ]
}
```

Pass condition for this fixture:

```text
If Phase 1A extracts zero threats, it fails.

If Phase 1A extracts only named or animal antagonists and misses the river,
it fails.

If Phase 1A extracts the river + trespass/imbalance + missing man/truck,
it passes.

If it also extracts cultural/industrial encroachment, predator mirror logic,
PV115 as false lead, and unresolved ending pressure, it passes strongly.
```

---

## 7. Failure codes

Use these codes in validators, quality reports, or CI fixtures.

| Code | Severity | Meaning |
|---|---:|---|
| `THREAT_FORCE_UNDEREXTRACTED` | hard fail | No threat forces were captured where pressure signals exist. |
| `NON_CHARACTER_PRIMARY_THREAT_MISSING` | hard fail | The primary threat is non-character, but no non-character threat force was emitted. |
| `CHARACTER_ONLY_ANTAGONIST_BIAS` | hard fail | The Threat / Pressure / Ending layer only contains named antagonists even though environmental/institutional/thematic pressure is present. |
| `THEMATIC_INSTITUTIONAL_PRESSURE_MISSING` | warning | Cultural, institutional, industrial, or social pressure was likely missed. |
| `FALSE_LEAD_NOT_CLASSIFIED` | warning | A psychological or prior-threat residue was treated as absent or primary rather than false lead. |
| `MIRROR_THREAT_MISCLASSIFIED` | warning | Animal/predator/ecological logic was not classified as mirror threat. |
| `ENDING_PRESSURE_MISSING` | warning | Final unresolved danger or pressure image was not captured. |

---

## 8. Learning loop

Do not treat this as fine-tuning first.

The RevisionGrade learning loop is:

1. Find an extraction miss.
2. Name the failure.
3. Write a golden fixture.
4. Add a validator.
5. Add a regression test or CI script.
6. Update prompt doctrine only where extraction behavior needs guidance.
7. Rerun the same chapter.
8. Require proof that the same mistake cannot silently pass again.

The system learns because the failure becomes non-repeatable.

---

## 9. Non-goals

This doctrine does not require:

- a new Story Ledger layer
- UI changes
- scoring changes
- database migrations
- model fine-tuning
- rendering hacks
- report-only patches

This is a Phase 1A / Story Ledger extraction-contract improvement.

---

## 10. Acceptance criteria

A future evaluation satisfies this broadened scope when:

- The Threat / Pressure / Ending layer can represent non-character threat forces.
- At least one non-character threat can be represented with `character_id: null` where the artifact shape supports it.
- Character-led bridge artifacts can represent non-character threats as `symbolic_force` or `collective_force` candidates.
- Environmental, institutional, thematic, psychological, animal/predator, and unresolved-mystery threats have valid threat classifications.
- Named antagonists still work as before.
- The River Remembers Blood fixture detects `river_judgment_force`.
- Empty threat lists are blocked or warned when pressure signals are present.
