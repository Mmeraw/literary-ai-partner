# Benchmark Charter: Three Truth Cases

**Status:** FROZEN  
**Authority:** Mike Meraw  
**Frozen Date:** 2026-05-28  
**Purpose:** Define the three locked benchmark cases that determine whether the revision system behaves correctly before any further expansion is permitted.  

---

## Governing Principle

"Done" means benchmark-correct behavior, not just a compiling repo. No new features, modes, UI, Supabase integration, dashboards, or doctrine families may be added until all three benchmark cases PASS.

## Benchmark Case 1: Ritual Protection

**Canon Under Test:** RITUAL-EDITOR-1  
**What It Proves:** The system correctly distinguishes ritual repetition from mechanical repetition.

### Locked Input
A passage containing both ritual repetition (escalating fragment chains, sensory recurrence with variation) and mechanical repetition (flat restating, comfort-repeats with no change).

### Expected Behavior
- Ritual lines that add new image, sensation, or escalation: PRESERVED
- Mechanical lines that restate without change: CUT or REDUCED
- No ritual cadence chains broken
- No sensory recurrence stripped

### Pass/Fail Gate
- **PASS:** All ritual lines preserved, all mechanical lines flagged for cut/reduce, zero false positives on ritual classification
- **FAIL:** Any ritual line cut, any mechanical line preserved, or ritual cadence chain broken

---

## Benchmark Case 2: Authority Compression

**Canon Under Test:** WAVE-55-L  
**What It Proves:** The system compresses only authority-weakening echoes, not texture/ritual/myth lines.

### Locked Input
A dense literary horror passage containing post-impact reinforcement lines (valid compression targets) alongside sensory layering, ritual fragment chains, and symbolic objects (protected elements).

### Expected Behavior
- Post-impact echo sentences: FLAGGED for compression
- Sensory layering: PRESERVED
- Ritual fragment chains: PRESERVED
- Symbolic objects in active use: PRESERVED
- Anchor lines: UNTOUCHED

### Pass/Fail Gate
- **PASS:** Only authority-weakening echoes targeted, all protected elements untouched
- **FAIL:** Any protected element targeted for compression, or any authority-weakening echo missed

---

## Benchmark Case 3: Chapter-Ending Pressure

**Canon Under Test:** WAVE-31-LW  
**What It Proves:** The system preserves chapter-ending pressure in literary-dense mode rather than adding resolution or smoothing jagged endings.

### Locked Input
A chapter ending with deliberate unresolved pressure: lingering sensory image, incomplete ritual fragment, environmental threat signal, and no explanatory wrap-up.

### Expected Behavior
- Final sensory image: PRESERVED
- Ritual fragment closer: PRESERVED  
- Environmental pressure signal: PRESERVED
- No explanatory closure added
- No smoothing of jagged ending

### Pass/Fail Gate
- **PASS:** Chapter ending maintains or increases carried pressure, no resolution added, no atmosphere flattened
- **FAIL:** Any pressure-carrying element removed, any explanatory closure added, or ending smoothed

---

## Execution Requirements

1. Fixture files with locked input text must be created in `tests/fixtures/benchmarks/`
2. Expected outputs must be locked and version-controlled
3. Pass/fail reporting must be clear, per-case, with diff notes on any failures
4. All three cases must PASS before any scope expansion is permitted

## DO NOT until all three PASS:
- Add Supabase integration
- Add UI components
- Add dashboards
- Add new doctrine families
- Broaden modes

## Fixture Locations (to be created)

```
tests/fixtures/benchmarks/
  case-1-ritual-protection.input.md
  case-1-ritual-protection.expected.md
  case-2-authority-compression.input.md
  case-2-authority-compression.expected.md
  case-3-chapter-ending-pressure.input.md
  case-3-chapter-ending-pressure.expected.md
```
