# WAVE SYSTEM EXECUTION LAYER MAP

**Canon ID:** CTRL-WAVE-EXEC-LAYER-MAP-V10
**Status:** ACTIVE
**Authority:** Mike Meraw
**Last Updated:** 2026-03-23
**Source:** Wave-System-Execution-System-HOW-to-revise-23-Mar-2026

---

## Purpose

This document maps the distinction between the WAVE Revision System (HOW to revise) and the Pipeline Evaluation System (WHEN/WHY to revise). This separation is critical for architectural clarity.

---

## Layer Separation

| Layer | Source | Role | Type | Focus | Input | Output |
|-------|--------|------|------|-------|-------|--------|
| WAVE System (Volume I) | Canon rules / waves | Defines WAVE system | Canon rules (waves) | HOW to revise | Manuscript (qualified) | Corrections |
| Pipeline Step (Volume III) | Evaluation Pipeline | Triggers WAVE system | Pipeline stage | WHEN to revise | Pass 3 truth | Revised manuscript |

---

## What the WAVE System Defines (Volume I)

- 62 Waves
- Tsunami structure
- Diagnostic passes
- Line-level and scene-level correction logic

---

## What the Pipeline Defines (Volume III)

- Where WAVE sits in pipeline
- What inputs it uses (Pass 3 output)
- What it produces (revision actions)

---

## Key Distinction

The WAVE system is the **execution engine** (HOW).
The Pipeline is the **governance layer** (WHEN/WHY).

Volume I defines the tool.
Volume III triggers the tool.
Volume V enforces the tool.

---

## System Integration

```
Volume I–III: what the system knows (craft, tools)
Volume IV: what the system is allowed to do (governance, rules)
Volume V: how the system enforces it in reality (enforcement)
Volume VI: full execution architecture (pipeline, gates, UI, audit, lifecycle)
```
