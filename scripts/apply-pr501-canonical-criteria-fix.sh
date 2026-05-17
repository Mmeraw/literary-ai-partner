#!/usr/bin/env bash
# Surgical fix for PR #501 — Pass 4 canonical-criteria alignment
#
# Apply on the PR #501 branch (fix/eval-timeout-pass4-chunkunit-clean) at
# or after HEAD 1e931b1a. Reads three files, rewrites them in place using
# Python (so the substitutions are exact and don't depend on sed flag
# quirks), then runs the test commands.
#
# Run from the repo root in your Codespace:
#   cd /workspaces/literary-ai-partner
#   git checkout fix/eval-timeout-pass4-chunkunit-clean
#   git pull --ff-only origin fix/eval-timeout-pass4-chunkunit-clean
#   bash /path/to/apply-pr501-canonical-criteria-fix.sh
#
# Nothing is committed or pushed by this script. You review `git diff` and
# `git status` before deciding to commit.

set -euo pipefail

REPO_ROOT="$(git rev-parse --show-toplevel)"
cd "$REPO_ROOT"

# Refuse to run on the wrong branch
BRANCH="$(git rev-parse --abbrev-ref HEAD)"
if [[ "$BRANCH" != "fix/eval-timeout-pass4-chunkunit-clean" ]]; then
  echo "ERROR: expected branch fix/eval-timeout-pass4-chunkunit-clean, got $BRANCH" >&2
  exit 1
fi

# Refuse to run on a dirty worktree
if ! git diff --quiet || ! git diff --cached --quiet; then
  echo "ERROR: worktree is dirty. Commit or stash before running." >&2
  exit 1
fi

CROSS="lib/evaluation/pipeline/perplexityCrossCheck.ts"
TEST="tests/evaluation/pipeline/perplexityCrossCheck.test.ts"
OBS="tests/evaluation/pipeline/perplexityCrossCheck.observability.test.ts"

for f in "$CROSS" "$TEST" "$OBS"; do
  if [[ ! -f "$f" ]]; then
    echo "ERROR: expected file missing: $f" >&2
    exit 1
  fi
done

# ─────────────────────────────────────────────────────────────────────
# Patch 1: perplexityCrossCheck.ts
#   - Add canonical import
#   - Replace local CriterionKey union with re-export from canonical
#   - Replace local CRITERION_KEYS array with comment + canonical re-export
#   - Replace 4 iteration sites: CRITERION_KEYS  →  CRITERIA_KEYS
#   - Replace mock-shape comment: emotionalResonance  →  narrativeClosure
# ─────────────────────────────────────────────────────────────────────

python3 <<'PY'
import re, pathlib

p = pathlib.Path("lib/evaluation/pipeline/perplexityCrossCheck.ts")
src = p.read_text()

# (1a) Add canonical import — insert immediately after the jsonParseBoundary
#      import block. Idempotent: skip if already present.
canonical_import = 'import { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";\n'
if "@/schemas/criteria-keys" not in src:
    marker = 'from "./jsonParseBoundary";\n'
    assert marker in src, "anchor 'from \"./jsonParseBoundary\";' not found"
    src = src.replace(marker, marker + canonical_import, 1)

# (1b) Replace the local CriterionKey union (lines 33-46 on HEAD 1e931b1a).
old_union = '''export type CriterionKey =
  | "concept"
  | "narrativeDrive"
  | "character"
  | "voice"
  | "sceneConstruction"
  | "dialogue"
  | "theme"
  | "worldbuilding"
  | "pacing"
  | "proseControl"
  | "tone"
  | "emotionalResonance"
  | "marketability";'''
new_union = '''// CriterionKey is re-exported below from the canonical registry. The local
// union was removed to eliminate criterion-authority drift between Pass 4 and
// the rest of the pipeline (Pass 1/2/3, QualityGate). Do NOT reintroduce.'''
assert old_union in src, "local CriterionKey union not found verbatim — file may have drifted"
src = src.replace(old_union, new_union, 1)

# Re-export so external consumers (and the test files) keep working.
# Place the re-export right after the replaced comment block.
reexport = '\nexport { CRITERIA_KEYS, type CriterionKey } from "@/schemas/criteria-keys";\n'
src = src.replace(new_union, new_union + reexport, 1)

# (1c) Replace the local CRITERION_KEYS array with a comment.
old_arr = '''const CRITERION_KEYS: CriterionKey[] = [
  "concept",
  "narrativeDrive",
  "character",
  "voice",
  "sceneConstruction",
  "dialogue",
  "theme",
  "worldbuilding",
  "pacing",
  "proseControl",
  "tone",
  "emotionalResonance",
  "marketability",
];'''
new_arr = '''// Pass 4 iterates the canonical criterion registry. Single source of truth:
// schemas/criteria-keys.ts. Do NOT reintroduce a local CRITERION_KEYS array.'''
assert old_arr in src, "local CRITERION_KEYS array not found verbatim — file may have drifted"
src = src.replace(old_arr, new_arr, 1)

# (1d) Replace remaining iteration sites: CRITERION_KEYS → CRITERIA_KEYS.
# On HEAD 1e931b1a the file has 6 occurrences of CRITERION_KEYS total:
#   - 1 in the local-array declaration (deleted above)
#   - 1 inside the local-array body identifier (deleted above)
# leaving 4 iteration/build sites at the original lines 300, 538, 606, 944,
# 1053 — but two of those are now adjacent post-deletion. Count flexibly:
# accept anywhere from 4 to 6 remaining sites and fail loudly otherwise.
before_count = len(re.findall(r"\bCRITERION_KEYS\b", src))
src_after = re.sub(r"\bCRITERION_KEYS\b", "CRITERIA_KEYS", src)
after_count = len(re.findall(r"\bCRITERION_KEYS\b", src_after))
n_changed = before_count - after_count
assert after_count == 0, f"CRITERION_KEYS still present {after_count} times after rewrite"
assert 3 <= n_changed <= 8, f"unexpected substitution count {n_changed}; aborting"
src = src_after
print(f"  - CRITERION_KEYS → CRITERIA_KEYS at {n_changed} site(s)")

# (1e) Replace the mock-shape comment line that lists emotionalResonance.
old_mock = '    "emotionalResonance": { ...same shape... },'
new_mock = '    "narrativeClosure": { ...same shape... },'
assert old_mock in src, "mock-shape emotionalResonance line not found"
src = src.replace(old_mock, new_mock, 1)

p.write_text(src)
print("patched: lib/evaluation/pipeline/perplexityCrossCheck.ts")
PY

# ─────────────────────────────────────────────────────────────────────
# Patch 2: perplexityCrossCheck.test.ts
#   - PASS4_KEYS slot 12: emotionalResonance → narrativeClosure
#   - All test-body references: emotionalResonance → narrativeClosure
# ─────────────────────────────────────────────────────────────────────

python3 <<'PY'
import re, pathlib
p = pathlib.Path("tests/evaluation/pipeline/perplexityCrossCheck.test.ts")
src = p.read_text()

before = src.count("emotionalResonance")
# Whole-word replace, all sites.
src = re.sub(r"\bemotionalResonance\b", "narrativeClosure", src)
after = src.count("emotionalResonance")
assert after == 0, f"emotionalResonance still present {after} times after rewrite"
print(f"patched: tests/evaluation/pipeline/perplexityCrossCheck.test.ts ({before} sites)")
p.write_text(src)
PY

# ─────────────────────────────────────────────────────────────────────
# Patch 3: perplexityCrossCheck.observability.test.ts
#   - PASS4_KEYS slot 12: emotionalResonance → narrativeClosure
# ─────────────────────────────────────────────────────────────────────

python3 <<'PY'
import re, pathlib
p = pathlib.Path("tests/evaluation/pipeline/perplexityCrossCheck.observability.test.ts")
src = p.read_text()
before = src.count("emotionalResonance")
src = re.sub(r"\bemotionalResonance\b", "narrativeClosure", src)
after = src.count("emotionalResonance")
assert after == 0
print(f"patched: tests/evaluation/pipeline/perplexityCrossCheck.observability.test.ts ({before} sites)")
p.write_text(src)
PY

# ─────────────────────────────────────────────────────────────────────
# Patch 4: append one regression test to perplexityCrossCheck.test.ts
#   Proves Pass 4 iterates exactly canonical CRITERIA_KEYS, in order, and
#   that emotionalResonance is not a key on the cross-check output.
# ─────────────────────────────────────────────────────────────────────

python3 <<'PY'
import pathlib
p = pathlib.Path("tests/evaluation/pipeline/perplexityCrossCheck.test.ts")
src = p.read_text()

# Idempotency guard
if "Pass 4 canonical-criteria alignment" in src:
    print("regression test already present, skipping append")
else:
    # The canonical import needs to be added at the top of the test file.
    if "from \"@/schemas/criteria-keys\"" not in src:
        # Insert after the existing perplexityCrossCheck import block.
        marker = 'from "@/lib/evaluation/pipeline/perplexityCrossCheck";\n'
        assert marker in src, "could not find existing perplexityCrossCheck import"
        src = src.replace(
            marker,
            marker + 'import { CRITERIA_KEYS } from "@/schemas/criteria-keys";\n',
            1,
        )

    regression = '''

describe("Pass 4 canonical-criteria alignment (regression)", () => {
  it("PASS4_KEYS equals canonical CRITERIA_KEYS in order", () => {
    expect(PASS4_KEYS).toEqual([...CRITERIA_KEYS]);
  });

  it("includes narrativeClosure and does not require emotionalResonance", () => {
    expect(CRITERIA_KEYS).toContain("narrativeClosure");
    expect(CRITERIA_KEYS as readonly string[]).not.toContain("emotionalResonance");
  });

  it("runPerplexityCrossCheck output.criteria keyed on canonical registry", async () => {
    const payload = makePerplexityPayload();
    const fetchMock = jest.fn<typeof fetch>().mockResolvedValue(
      makeFetchResponse(JSON.stringify(payload)) as unknown as Response,
    );
    global.fetch = fetchMock;

    const result = await runPerplexityCrossCheck({
      openaiCriteria: makeOpenAICriteria(),
      openaiSynthesis: "Primary evaluator synthesis.",
      manuscriptExcerpt: "The river moved slowly through the valley.",
      workType: "literary_fiction",
      title: "The Valley",
      perplexityApiKey: "pplx-test",
    });

    const keys = Object.keys(result.criteria).sort();
    const expected = [...CRITERIA_KEYS].sort();
    expect(keys).toEqual(expected);
    expect(keys).toContain("narrativeClosure");
    expect(keys).not.toContain("emotionalResonance");
  });
});
'''
    # Append at end of file.
    if not src.endswith("\n"):
        src += "\n"
    src += regression
    p.write_text(src)
    print("appended regression suite to perplexityCrossCheck.test.ts")
PY

# ─────────────────────────────────────────────────────────────────────
# Grep guard: no stray emotionalResonance anywhere in the three files.
# ─────────────────────────────────────────────────────────────────────

echo
echo "─── grep guard ───"
if grep -rn "emotionalResonance" \
    lib/evaluation/pipeline/perplexityCrossCheck.ts \
    tests/evaluation/pipeline/perplexityCrossCheck.test.ts \
    tests/evaluation/pipeline/perplexityCrossCheck.observability.test.ts \
    tests/evaluation/pipeline/pipeline-e2e.test.ts \
    2>/dev/null
then
    echo "WARNING: emotionalResonance still present in one of the Pass 4 files above."
    echo "If it's only inside a comment documenting the historical drift, that's fine."
else
    echo "OK: no emotionalResonance remains in Pass 4 cross-check code/tests."
fi

echo
echo "─── diff summary ───"
git diff --stat

echo
echo "─── next steps (run manually, do not auto-run) ───"
cat <<'NEXT'
1. Review the diff:
     git diff lib/evaluation/pipeline/perplexityCrossCheck.ts
     git diff tests/evaluation/pipeline/perplexityCrossCheck.test.ts
     git diff tests/evaluation/pipeline/perplexityCrossCheck.observability.test.ts

2. Run the tests:
     npm test -- tests/evaluation/pipeline/perplexityCrossCheck.test.ts
     npm test -- tests/evaluation/pipeline/perplexityCrossCheck.observability.test.ts
     npm test -- tests/evaluation/pipeline/pipeline-e2e.test.ts -t "crosscheck"

3. If green:
     git add lib/evaluation/pipeline/perplexityCrossCheck.ts \
             tests/evaluation/pipeline/perplexityCrossCheck.test.ts \
             tests/evaluation/pipeline/perplexityCrossCheck.observability.test.ts
     git commit -m "fix(pass4): align Perplexity cross-check criteria with canonical registry"
     git push origin fix/eval-timeout-pass4-chunkunit-clean

4. PR #501 stays draft. Do not flip ready.
   Live Tier 2 chapter run still blocked by the OpenAI $50 spend gate.
NEXT
