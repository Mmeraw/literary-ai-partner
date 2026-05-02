**REVISIONGRADE\_REPO\_AUTHORITY\_RULES.md**

# RevisionGrade — Repository Authority Rules

## Purpose

Define how all files in the repository are classified, placed, and maintained.

This prevents:
- authority confusion
- duplication
- drift between canon and implementation
- root-level noise

---

# Core Principle

> Every file must have a clearly defined role.

If its role is unclear, it does not belong at the top level.

---

# Authority Model (5 Zones)

All repository content must belong to exactly one of these:

---

## 1. Canon (Truth Layer)

\*\*Location:\*\*
```
/docs/canon/
```

\*\*Purpose:\*\*
Defines what is true in the system.

\*\*Includes:\*\*
- Volume I–V
- Doctrine Registry
- Canon Addenda (e.g., Lost World Lessons)
- Governing laws (VOICE-LAW, ANCHOR-LAW, etc.)

\*\*Rules:\*\*
- Canon is authoritative
- Canon is version-controlled but not casually edited
- No duplicate canon files allowed

---

## 2. Active Implementation (Execution Layer)

\*\*Location:\*\*
```
/app/
/lib/
/workers/
/supabase/
/schemas/
```

\*\*Purpose:\*\*
Code that runs the system.

\*\*Includes:\*\*
- wave execution modules
- orchestrator
- validators
- database schema
- RPC functions

\*\*Rules:\*\*
- Must reflect canon behavior
- Must be testable
- No “spec-only” files in this layer

---

## 3. Operational / Evidence (Runtime Output)

\*\*Location:\*\*
```
/evidence/
/runs/
```

\*\*Purpose:\*\*
Proves what the system did.

\*\*Includes:\*\*
- run outputs
- audit logs
- evaluation artifacts
- test chapter results

\*\*Rules:\*\*
- Generated, not authored
- Never treated as canon
- Must be reproducible from code

---

## 4. Support / Working Docs (Active Guidance)

\*\*Location:\*\*
```
/docs/
 /architecture/
 /implementation/
 /runbooks/
 /roadmaps/
```

\*\*Purpose:\*\*
Help engineers and operators build and run the system.

\*\*Includes:\*\*
- gate specs (PR1–PR6)
- architecture diagrams
- implementation guides
- deployment/run instructions

\*\*Rules:\*\*
- Must align with canon
- May evolve as implementation evolves
- Cannot contradict canon

---

## 5. Archive (Historical Record)

\*\*Location:\*\*
```
/archive/
```

\*\*Purpose:\*\*
Preserve history without polluting active authority.

\*\*Includes:\*\*
- closure reports
- sprint summaries
- proof packs
- deprecated specs
- old docx files

\*\*Rules:\*\*
- Read-only reference
- Not used for decision-making
- Not surfaced in root

---

# Root Directory Rules

The root must remain minimal.

\*\*Allowed:\*\*
- README.md
- package.json / config files
- app/ and core code folders
- .github/
- environment examples

\*\*Not allowed:\*\*
- phase summaries
- closure documents
- duplicate system descriptions
- outdated specs

---

# ⚖️ Placement Rules

When adding a file, ask:

1. Does it define truth? → `/docs/canon/`
2. Does it run code? → implementation directories
3. Does it prove a run? → `/evidence/` or `/runs/`
4. Does it guide current work? → `/docs/...`
5. Is it historical? → `/archive/`

If none apply:
→ the file should not be added

---

# Duplication Policy

- Only one canonical version per concept
- Older or alternate versions → archive
- No parallel “final” documents at root

---

# Anti-Patterns

Do not allow:

- “FINAL\_v3\_REAL\_FINAL.md”
- multiple summaries of the same system
- mixing canon with working notes
- embedding legacy material into active docs

---

# Enforcement

A PR should be blocked if:

- file placement violates authority zones
- canon is duplicated or contradicted
- root-level clutter increases
- historical material is presented as current

---

# Done Definition

The repo is clean when:

- root is minimal and readable
- canon is isolated and authoritative
- implementation is easy to locate
- evidence is clearly separated
- archive contains all historical noise

---

# Final Rule

> Structure is not cosmetic — it is part of system integrity.

A clean repository ensures:
- correct implementation
- faster onboarding
- stronger investor confidence
