**WAVE‑55‑L — Selective Compression Canon (Lost World Variant)**

**Wave ID:** WAVE‑55‑L
**Parent Wave:** WAVE‑55 — Global Compression & Kill‑Switch Authority
**Mode applicability:** literary\_dense (density‑based literary horror / psychological suspense)

**1. Purpose**

Standard WAVE‑55 compresses toward efficiency. For density‑based literary work, efficiency can destroy what makes the prose *work* — ritual cadence, sensory texture, symbolic repetition, mythic register. WAVE‑55‑L governs **what compression is allowed to touch** and **what it must leave alone** in literary\_dense manuscripts.

**2. Core doctrine**

Compression in literary\_dense mode **must**:

1. **Distinguish structural fat from load‑bearing texture.** Repetition that builds rhythm or ritual is not redundancy. Sensory layering that anchors the reader in place is not overwriting.
2. **Protect ritual chains.** Any recurring motif, phrase pattern, or cadence structure flagged as ritual by the author or the RITUAL‑EDITOR layer is compression‑exempt until explicitly released.
3. **Preserve mythic register.** Sentences operating in elevated, incantatory, or mythic register may not be flattened to conversational prose for efficiency. Register is structural, not decorative.

**3. Compression permissions (what 55‑L may cut)**

* **Dead connective tissue** — transitions that add no tension, texture, or information ("And then," "After a moment," "He realized that").
* **True redundancy** — identical information stated twice with no rhythmic or thematic purpose.
* **Stage directions** — unnecessary physical choreography (stood, turned, walked) that does not carry pressure or characterize.
* **Explanatory intrusion** — narrator explaining what the scene already shows.

**4. Compression prohibitions (what 55‑L must not touch)**

* **Ritual repetition** — recurring phrases, structural echoes, or motif callbacks that serve cadence or thematic architecture.
* **Sensory density** — layered sensory detail that builds place, atmosphere, or psychological state, even when individually "cuttable."
* **Mythic or elevated register** — prose deliberately operating above conversational baseline for tonal or thematic reasons.
* **Silence and negative space** — short sentences, fragments, or paragraph breaks that function as pacing instruments.
* **Symbolic objects or gestures** — recurring images (coins, hands, water, heat) that carry narrative weight beyond their literal content.

Any compression pass that removes items from the prohibited list is a **texture\_loss** violation and fails governance.

**5. Operational rules and ordering**

* **Prerequisite:** WAVE‑31‑LW must pass on all affected chapters before WAVE‑55‑L is eligible to run. Compression on a chapter with a pressure\_drop ending is forbidden.
* **Ritual check:** Before executing, WAVE‑55‑L must query the RITUAL‑EDITOR layer (when available) for the current ritual‑chain registry. Any flagged chains are locked.
* **Phase:** Runs in post-structure, post-pressure phase. Priority: MEDIUM. Must not run before WAVE‑31‑LW (HIGH) or WAVE‑33–40 pacing spine.
* **Routing:** Bind to Criterion 4 (ECONOMY) and Criterion 11 (PROSE STYLE) in Vol II‑A routing map.

**6. Governance hooks**

* **Forbidden:** Any pipeline that runs WAVE‑55 (standard compression) on a literary\_dense manuscript without first switching to WAVE‑55‑L mode. Standard WAVE‑55 is not authorized for density‑based literary work.
* **Required:** Post‑compression diff must be reviewed for texture\_loss. If any ritual chain, sensory cluster, or mythic‑register passage was altered, the run fails Binary Acceptance and reverts to pre‑compression state.
* **Audit:** Compression ratio for literary\_dense runs is expected to be materially lower than standard runs. A compression ratio matching standard WAVE‑55 output on literary‑dense input is a red flag and triggers manual review.
