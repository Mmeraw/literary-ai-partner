**Doctrine Registry Sketch — WAVE‑31‑LW, WAVE‑55‑L, RITUAL‑EDITOR‑1**

Here's how these three entries would appear as rows in your Doctrine Registry table (Volume I or wherever you keep the master index):

| **Field** | **WAVE‑31‑LW** | **WAVE‑55‑L** | **RITUAL‑EDITOR‑1** |
| --- | --- | --- | --- |

| **Field** | **WAVE‑31‑LW** | **WAVE‑55‑L** | **RITUAL‑EDITOR‑1** |
| --- | --- | --- | --- |
| **Canon ID** | WAVE‑31‑LW | WAVE‑55‑L | RITUAL‑EDITOR‑1 |
| **Parent** | WAVE‑31 | WAVE‑55 | *(new, no parent)* |
| **Volume** | Vol I (Canon) | Vol I (Canon) | Vol I (Canon) |
| **Section** | Wave Registry — Pressure | Wave Registry — Compression | Wave Registry — Ritual/Texture |
| **Mode Flag** | literary\_dense | literary\_dense | literary\_dense |
| **Phase** | post-structure | post-structure, post-pressure | pre-compression |
| **Priority** | HIGH | MEDIUM | HIGH |
| **Vol II‑A Criteria Binding** | Criterion 2 (MOMENTUM), Criterion 9 (PACING) | Criterion 4 (ECONOMY), Criterion 11 (PROSE STYLE) | Criterion 11 (PROSE STYLE), Criterion 12 (ORIGINALITY) |
| **Prerequisite Waves** | None | WAVE‑31‑LW must pass | None |
| **Dependent Waves** | WAVE‑33–40 (feeds pacing spine) | Requires RITUAL‑EDITOR‑1 query | WAVE‑55‑L (consumes ritual registry) |
| **Governance Gate** | Binary Acceptance — pressure\_drop at chapter ending = fail | Binary Acceptance — texture\_loss on prohibited list = fail | Advisory — flags ritual chains; does not independently fail BA but WAVE‑55‑L enforces its output |
| **Forbidden Config** | Compression before pressure gate satisfied | Standard WAVE‑55 on literary\_dense input | Running WAVE‑55‑L without querying ritual registry |
| **Origin** | Lost World Lessons (Ch. 49–50 revision cycle) | Lost World Lessons (Ch. 49–50 revision cycle) | Lost World Lessons (Ch. 49–50 revision cycle) |

**Wiring notes**

1. **Execution order for literary\_dense:** RITUAL‑EDITOR‑1 (build ritual registry) → WAVE‑31‑LW (validate pressure endings) → WAVE‑33–40 (pacing spine) → WAVE‑55‑L (selective compression with ritual locks).
2. **Mode switching:** When a manuscript is tagged literary\_dense, the pipeline must swap WAVE‑55 → WAVE‑55‑L automatically. Standard WAVE‑55 never fires in this mode.
3. **RITUAL‑EDITOR‑1** needs its own one‑pager next — it defines how ritual chains are identified, registered, and locked. It's the data layer that WAVE‑55‑L depends on. That's your logical next draft.
