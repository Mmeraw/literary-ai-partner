#!/usr/bin/env bash
# PR #502 follow-up patch — restore canonical "ending" label and
# raise Perplexity request timeout for long-form adjudication.
#
# Branch: fix/pass4-longform-evidence-packet
# Base HEAD expected: bf6dcb71d3982d9553aa7d2be67003edf4ec006a (or newer)
#
# What this script does, surgically:
#   1. Renames the internal Pass 4 window label "final" -> "ending"
#      across pass4EvidencePacket.ts. The visible window header was
#      already "ENDING" via a display-label remap; this collapses the
#      indirection so internal label, visible header, and telemetry
#      flag (pass4_includes_ending) all use the same word.
#   2. Updates the unit tests to assert selectedWindows.toContain("ending")
#      instead of "final".
#   3. Raises the Perplexity request timeout in perplexityCrossCheck.ts
#      from a hardcoded 60_000ms to an env-configurable default of
#      180_000ms (PERPLEXITY_REQUEST_TIMEOUT_MS). This is the actual
#      blocker behind the live "Pass 4 timed out after 60000ms" you
#      observed on the chapter-1 dry run; sonar-reasoning-pro on a
#      20k-char prompt with reasoning enabled commonly takes 60-120s.
#
# What this script does NOT do:
#   - Touch runPipeline.ts
#   - Touch Supabase / job lifecycle
#   - Change PASS4_WEAK_AGREEMENT governance
#   - Flip EVAL_EXTERNAL_ADJUDICATION_MODE
#   - Touch the canonical-criteria fix (already shipped)
#   - Touch the pipeline-e2e 15_000 Jest timeout patch already on branch
#   - Commit or push (you review `git diff` then decide)
#
# Run from the repo root, on the existing PR #502 branch:
#   cd /workspaces/literary-ai-partner
#   git fetch origin
#   git checkout fix/pass4-longform-evidence-packet
#   git pull --ff-only origin fix/pass4-longform-evidence-packet
#   bash /path/to/apply-pr502-ending-label-and-timeout.sh
#
set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

CURRENT_BRANCH="$(git rev-parse --abbrev-ref HEAD)"
EXPECTED_BRANCH="fix/pass4-longform-evidence-packet"

if [[ "$CURRENT_BRANCH" != "$EXPECTED_BRANCH" ]]; then
  echo "ERROR: must run from branch '$EXPECTED_BRANCH'." >&2
  echo "       Currently on: $CURRENT_BRANCH" >&2
  exit 1
fi

if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: worktree is dirty. Commit or stash before running." >&2
  exit 1
fi

PACKET="lib/evaluation/pipeline/pass4EvidencePacket.ts"
PACKET_TEST="tests/evaluation/pipeline/pass4EvidencePacket.test.ts"
CROSS="lib/evaluation/pipeline/perplexityCrossCheck.ts"

for f in "$PACKET" "$PACKET_TEST" "$CROSS"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: expected file missing: $f" >&2
    exit 1
  fi
done

# --- Patch pass4EvidencePacket.ts ------------------------------------------
# This is a precise, label-only rename: "final" -> "ending" wherever
# "final" appears as a window-label string literal or union-member. We
# do NOT touch the word "final" in comments where it has prose meaning
# (e.g. "the final hard-cap enforcement"). All targeted sites are
# string literals or identifiers inside the Pass4WindowLabel surface.

python3 - <<'PY_EOF'
import re
from pathlib import Path

p = Path("lib/evaluation/pipeline/pass4EvidencePacket.ts")
src = p.read_text()

# 1. Pass4WindowLabel union: replace the `| "final"` arm with `| "ending"`.
old_union = '''export type Pass4WindowLabel =
  | "full"
  | "opening"
  | "early"
  | "middle"
  | "late"
  | "final";'''
new_union = '''export type Pass4WindowLabel =
  | "full"
  | "opening"
  | "early"
  | "middle"
  | "late"
  | "ending";'''
assert src.count(old_union) == 1, "Patch A1: window union anchor not unique or missing"
src = src.replace(old_union, new_union, 1)

# 2. WINDOW_ORDER array: replace "final" with "ending".
old_order = '''const WINDOW_ORDER: Exclude<Pass4WindowLabel, "full">[] = [
  "opening",
  "early",
  "middle",
  "late",
  "final",
];'''
new_order = '''const WINDOW_ORDER: Exclude<Pass4WindowLabel, "full">[] = [
  "opening",
  "early",
  "middle",
  "late",
  "ending",
];'''
assert src.count(old_order) == 1, "Patch A2: WINDOW_ORDER anchor not unique or missing"
src = src.replace(old_order, new_order, 1)

# 3. WINDOW_DISPLAY_LABELS: change the key from `final` to `ending`.
old_labels = '''const WINDOW_DISPLAY_LABELS: Record<Pass4WindowLabel, string> = {
  full: "FULL",
  opening: "OPENING",
  early: "EARLY",
  middle: "MIDDLE",
  late: "LATE",
  final: "ENDING",
};'''
new_labels = '''const WINDOW_DISPLAY_LABELS: Record<Pass4WindowLabel, string> = {
  full: "FULL",
  opening: "OPENING",
  early: "EARLY",
  middle: "MIDDLE",
  late: "LATE",
  ending: "ENDING",
};'''
assert src.count(old_labels) == 1, "Patch A3: WINDOW_DISPLAY_LABELS anchor not unique or missing"
src = src.replace(old_labels, new_labels, 1)

# 4. Replace every remaining label-string literal `"final"` that
#    refers to the Pass4WindowLabel. These are all of the form:
#      buildWindowSection("final", ...)
#      slices.push({ label: "final", ... })
#      selectedWindows.push("final")
#      s.label === "final"
#      s.label !== "final"
#      rawSections.find((s) => s.label === "final")
#    A whole-string-literal replace is safe because the file has no
#    other "final" string literals outside this label surface (we
#    confirmed via grep before generating this script).
#
#    To be defensive, we count expected occurrences first.
expected_label_literals = src.count('"final"')
if expected_label_literals == 0:
    raise AssertionError("Patch A4: no remaining \"final\" literals to rename — patch may already be applied")
src = src.replace('"final"', '"ending"')
print(f"[apply-pr502-ending] Replaced {expected_label_literals} '\"final\"' label literals with '\"ending\"'.")

# 5. The label is also used as a record key in two places where it's
#    not a string literal:
#      LONG_FORM_WINDOW_SIZES has `final: 7_000,`
#      sized initializer has `final: Math.floor(...)` and reads it as
#         `LONG_FORM_WINDOW_SIZES.final` / `sized.final`.
#    Rename those keys + accesses, anchored on their full lines so we
#    don't accidentally hit the word "final" in unrelated comments.
old_size_key = '''  opening: 5_000,
  early: 5_500,
  middle: 6_000,
  late: 5_500,
  final: 7_000,
};'''
new_size_key = '''  opening: 5_000,
  early: 5_500,
  middle: 6_000,
  late: 5_500,
  ending: 7_000,
};'''
assert src.count(old_size_key) == 1, "Patch A5: LONG_FORM_WINDOW_SIZES anchor not unique or missing"
src = src.replace(old_size_key, new_size_key, 1)

old_sized_init = '''    opening: Math.floor(LONG_FORM_WINDOW_SIZES.opening * scale),
    early: Math.floor(LONG_FORM_WINDOW_SIZES.early * scale),
    middle: Math.floor(LONG_FORM_WINDOW_SIZES.middle * scale),
    late: Math.floor(LONG_FORM_WINDOW_SIZES.late * scale),
    final: Math.floor(LONG_FORM_WINDOW_SIZES.final * scale),
  };'''
new_sized_init = '''    opening: Math.floor(LONG_FORM_WINDOW_SIZES.opening * scale),
    early: Math.floor(LONG_FORM_WINDOW_SIZES.early * scale),
    middle: Math.floor(LONG_FORM_WINDOW_SIZES.middle * scale),
    late: Math.floor(LONG_FORM_WINDOW_SIZES.late * scale),
    ending: Math.floor(LONG_FORM_WINDOW_SIZES.ending * scale),
  };'''
assert src.count(old_sized_init) == 1, "Patch A6: sized initializer anchor not unique or missing"
src = src.replace(old_sized_init, new_sized_init, 1)

old_ending_read = 'const rawEndingStart = Math.max(0, sourceChars - sized.final);'
new_ending_read = 'const rawEndingStart = Math.max(0, sourceChars - sized.ending);'
assert src.count(old_ending_read) == 1, "Patch A7: sized.final read anchor not unique or missing"
src = src.replace(old_ending_read, new_ending_read, 1)
print("[apply-pr502-ending] Renamed LONG_FORM_WINDOW_SIZES.final / sized.final → .ending")

p.write_text(src)
print("[apply-pr502-ending] pass4EvidencePacket.ts patched cleanly.")
PY_EOF

# --- Patch pass4EvidencePacket.test.ts -------------------------------------

python3 - <<'PY_EOF'
from pathlib import Path

p = Path("tests/evaluation/pipeline/pass4EvidencePacket.test.ts")
src = p.read_text()

# Test assertions that check selectedWindows.toContain("final"). All
# such literals should match "ending" now. The visible-header asserts
# (toMatch(/--- WINDOW: ENDING/)) are already correct and stay.
expected = src.count('.toContain("final")')
if expected == 0:
    # Could already be patched; not fatal.
    print("[apply-pr502-ending] WARN: no .toContain(\"final\") assertions found (already patched?)")
else:
    src = src.replace('.toContain("final")', '.toContain("ending")')
    print(f"[apply-pr502-ending] Updated {expected} test assertion(s) from 'final' to 'ending'.")

p.write_text(src)
print("[apply-pr502-ending] pass4EvidencePacket.test.ts patched cleanly.")
PY_EOF

# --- Patch perplexityCrossCheck.ts: timeout env-configurable ---------------

python3 - <<'PY_EOF'
from pathlib import Path

p = Path("lib/evaluation/pipeline/perplexityCrossCheck.ts")
src = p.read_text()

# Replace the hardcoded 60000ms timeout with an env-configurable
# constant defaulting to 180000ms (180s). Reasoning:
#   - sonar-reasoning-pro on a 20k-char prompt with reasoning enabled
#     routinely takes 60-120s in production.
#   - Live log on chapter 1 showed elapsed_ms_attempt: 60003 (right
#     at the ceiling).
#   - 180s gives comfortable headroom for novel-length packets (~30k
#     chars) without making short-form runs feel slow (short-form
#     usually returns in 15-40s and is unaffected by the ceiling).
#   - Env-configurable so production can raise/lower without a code
#     change if needed.
old_timeout = 'const PERPLEXITY_REQUEST_TIMEOUT_MS = 60000;'
new_timeout = '''export const DEFAULT_PERPLEXITY_REQUEST_TIMEOUT_MS = 180_000;
export const MIN_PERPLEXITY_REQUEST_TIMEOUT_MS = 60_000;

/**
 * Resolve the Perplexity request timeout from the environment.
 *
 * Defaults to 180_000ms (180s). Sonar-reasoning-pro on full-novel
 * packets (~30k chars) routinely takes 90-150s; 60s was the prior
 * hardcoded ceiling and proved too tight for novel-length runs. The
 * env var lets production raise/lower without a code change.
 *
 * Policy (not just parsing):
 *   - undefined / empty / whitespace  -> default
 *   - non-numeric / NaN               -> default
 *   - value < MIN (60_000ms)          -> default
 *   - valid value >= MIN              -> use it (no upper clamp)
 *
 * Exported for direct unit testing. PERPLEXITY_REQUEST_TIMEOUT_MS is
 * a module-level constant captured at import time; tests should call
 * the resolver directly rather than mutating process.env after import.
 */
export function resolvePerplexityRequestTimeoutMs(
  raw: string | undefined = process.env.PERPLEXITY_REQUEST_TIMEOUT_MS,
): number {
  if (raw === undefined || raw.trim() === "") {
    return DEFAULT_PERPLEXITY_REQUEST_TIMEOUT_MS;
  }

  const parsed = Number.parseInt(raw, 10);

  if (!Number.isFinite(parsed) || parsed < MIN_PERPLEXITY_REQUEST_TIMEOUT_MS) {
    return DEFAULT_PERPLEXITY_REQUEST_TIMEOUT_MS;
  }

  return parsed;
}

const PERPLEXITY_REQUEST_TIMEOUT_MS = resolvePerplexityRequestTimeoutMs();'''
assert src.count(old_timeout) == 1, "Patch B1: PERPLEXITY_REQUEST_TIMEOUT_MS anchor not unique or missing"
src = src.replace(old_timeout, new_timeout, 1)

p.write_text(src)
print("[apply-pr502-ending] perplexityCrossCheck.ts timeout raised to 180000ms (env-configurable, validated).")
PY_EOF

# --- Create new timeout-env parsing test file ------------------------------
# Per ChatGPT review: timeout parsing is config behavior, not adjudication
# behavior, so it lives in its own file rather than appended to the main
# perplexityCrossCheck.test.ts. This avoids polluting the adjudication
# suite with config-resolver unit tests.

python3 - <<'PY_EOF'
from pathlib import Path

p = Path("tests/evaluation/pipeline/perplexityCrossCheck.timeout.test.ts")

contents = '''import {
  DEFAULT_PERPLEXITY_REQUEST_TIMEOUT_MS,
  MIN_PERPLEXITY_REQUEST_TIMEOUT_MS,
  resolvePerplexityRequestTimeoutMs,
} from "@/lib/evaluation/pipeline/perplexityCrossCheck";

describe("resolvePerplexityRequestTimeoutMs", () => {
  it("defaults to 180000 when unset or blank", () => {
    expect(resolvePerplexityRequestTimeoutMs(undefined)).toBe(180000);
    expect(resolvePerplexityRequestTimeoutMs("")).toBe(180000);
    expect(resolvePerplexityRequestTimeoutMs("   ")).toBe(180000);
  });

  it("uses a valid explicit timeout", () => {
    expect(resolvePerplexityRequestTimeoutMs("240000")).toBe(240000);
    expect(resolvePerplexityRequestTimeoutMs("300000")).toBe(300000);
  });

  it("falls back for invalid values", () => {
    expect(resolvePerplexityRequestTimeoutMs("abc")).toBe(180000);
    expect(resolvePerplexityRequestTimeoutMs("NaN")).toBe(180000);
  });

  it("falls back for non-positive or too-low values", () => {
    expect(resolvePerplexityRequestTimeoutMs("0")).toBe(180000);
    expect(resolvePerplexityRequestTimeoutMs("-1")).toBe(180000);
    expect(resolvePerplexityRequestTimeoutMs("1000")).toBe(180000);
    expect(
      resolvePerplexityRequestTimeoutMs(
        String(MIN_PERPLEXITY_REQUEST_TIMEOUT_MS - 1),
      ),
    ).toBe(180000);
  });

  it("accepts the minimum floor exactly", () => {
    expect(
      resolvePerplexityRequestTimeoutMs(
        String(MIN_PERPLEXITY_REQUEST_TIMEOUT_MS),
      ),
    ).toBe(MIN_PERPLEXITY_REQUEST_TIMEOUT_MS);
  });

  it("exports the expected default", () => {
    expect(DEFAULT_PERPLEXITY_REQUEST_TIMEOUT_MS).toBe(180000);
  });
});
'''

if p.exists():
    print("[apply-pr502-ending] timeout test file already present — skipping create.")
else:
    p.write_text(contents)
    print("[apply-pr502-ending] Created perplexityCrossCheck.timeout.test.ts with 5 resolver tests.")
PY_EOF

# --- Grep guards -----------------------------------------------------------

echo ""
echo "=== Grep guard: no stale \"final\" window-label literals in helper ==="
if grep -n '"final"' "$PACKET"; then
  echo "ERROR: stale \"final\" label string still in $PACKET" >&2
  exit 1
else
  echo "OK: no \"final\" literals remain in $PACKET"
fi

echo ""
echo "=== Grep guard: no stale .final property access on window-size record ==="
if grep -nE 'sized\.final|LONG_FORM_WINDOW_SIZES\.final|^\s+final:' "$PACKET"; then
  echo "ERROR: stale .final property access still in $PACKET" >&2
  exit 1
else
  echo "OK: no .final property access remains in $PACKET"
fi

echo ""
echo "=== Grep guard: no stale .toContain(\"final\") in packet test ==="
if grep -n '.toContain("final")' "$PACKET_TEST"; then
  echo "ERROR: stale assertion still in $PACKET_TEST" >&2
  exit 1
else
  echo "OK: test assertions updated"
fi

echo ""
echo "=== Grep guard: \"ending\" label present in helper ==="
grep -c '"ending"' "$PACKET" || { echo "ERROR: \"ending\" not present in helper" >&2; exit 1; }

echo ""
echo "=== Grep guard: visible header \"ENDING\" still present ==="
grep -n '"ENDING"' "$PACKET" || { echo "ERROR: ENDING display label missing" >&2; exit 1; }

echo ""
echo "=== Grep guard: timeout is now env-configurable ==="
grep -n 'PERPLEXITY_REQUEST_TIMEOUT_MS' "$CROSS" | head -5
grep -q 'process.env.PERPLEXITY_REQUEST_TIMEOUT_MS' "$CROSS" || {
  echo "ERROR: timeout env wiring missing" >&2
  exit 1
}

echo ""
echo "=== git diff --stat ==="
git diff --stat

# --- Run tests -------------------------------------------------------------

echo ""
echo "=== Running packet test suite ==="
npm test -- tests/evaluation/pipeline/pass4EvidencePacket.test.ts

echo ""
echo "=== Running new timeout-resolver test file ==="
npm test -- tests/evaluation/pipeline/perplexityCrossCheck.timeout.test.ts

echo ""
echo "=== Running existing Pass 4 cross-check suites ==="
npm test -- tests/evaluation/pipeline/perplexityCrossCheck.test.ts
npm test -- tests/evaluation/pipeline/perplexityCrossCheck.observability.test.ts

echo ""
echo "============================================================"
echo "Patch applied. Nothing committed."
echo ""
echo "Verification expectations:"
echo "  - All packet tests pass (18/18 or current count)."
echo "  - perplexityCrossCheck unit suites pass unchanged."
echo "  - Log telemetry now emits:"
echo "      pass4_selected_windows: [\"opening\",\"ending\"]    (short-form)"
echo "      pass4_selected_windows: [\"opening\",\"early\",\"middle\",\"late\",\"ending\"]  (long-form)"
echo "  - Visible header in the packet text remains: --- WINDOW: ENDING ---"
echo "  - pass4_includes_ending: true (unchanged)"
echo ""
echo "Next steps:"
echo "  1. Review:  git diff"
echo "  2. Run the FULL local Froggin scenario (not chapter 1):"
echo "       export EVAL_OPENAI_MODEL=gpt-5.1"
echo "       export PERPLEXITY_REQUEST_TIMEOUT_MS=240000"
echo "       export EVAL_EXTERNAL_ADJUDICATION_MODE=required"
echo "       unset SUPABASE_URL SUPABASE_STRESS_URL"
echo "       TIER2_SCENARIO_ID=Q-froggin-noggin-full-local \\"
echo "         npm run pipeline:stress:tier2 2>&1 | tee /tmp/pr502-full-novel-live.log"
echo "  3. Confirm in the log:"
echo "       pass4_source_words: ~105000"
echo "       pass4_packet_chars: 25000-30000"
echo "       pass4_selected_windows: [\"opening\",\"early\",\"middle\",\"late\",\"ending\"]"
echo "       pass4_packet_compression_ratio: 0.04-0.05"
echo "       pass4_includes_ending: true"
echo "  4. If Pass 4 still times out at 180s, raise PERPLEXITY_REQUEST_TIMEOUT_MS"
echo "     in the env (no code change needed)."
echo "  5. Commit and push:"
echo "       git add lib/evaluation/pipeline/pass4EvidencePacket.ts \\"
echo "               tests/evaluation/pipeline/pass4EvidencePacket.test.ts \\"
echo "               lib/evaluation/pipeline/perplexityCrossCheck.ts"
echo "       git commit -m 'fix(pass4): restore canonical \"ending\" label and raise Perplexity timeout to 180s'"
echo "       git push origin fix/pass4-longform-evidence-packet"
echo "============================================================"
