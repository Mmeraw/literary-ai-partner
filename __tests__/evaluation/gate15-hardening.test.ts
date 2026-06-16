/**
 * Gate 15 Hardening & Mistake-Proofing Tests
 *
 * Corrective action for incident: Job fcb1e541 ("Cartel Babies", 109K words)
 * blocked by Gate 15 scanning MANUSCRIPT text during evaluation pipeline.
 *
 * Root cause: Gate 15's canon role is Revise-phase (Wave 15→16 transition),
 * not evaluation-phase blocking. It was incorrectly made blocking during
 * evaluation, causing any long-form fiction with normal dialogue density to
 * fail evaluation.
 *
 * These tests enforce:
 * 1. Gate 15 is ALWAYS advisory-only during evaluation (never blocks)
 * 2. No manuscript-scanning gate can call markFailed in the processor
 * 3. Architectural invariants prevent re-introduction of blocking behavior
 * 4. Gate 15 correctly identifies dialogue-heavy text but doesn't block
 */

import * as fs from "fs";
import * as path from "path";

const repoRoot = path.resolve(__dirname, "../..");

describe("Gate 15 Hardening — Corrective Action & Mistake-Proofing", () => {
  // ── 1. CORRECTIVE ACTION: Gate 15 must be advisory-only during evaluation ──

  describe("Corrective Action: Gate 15 advisory-only during evaluation", () => {
    test("processor Gate 15 section must NOT contain markFailed", () => {
      const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
      const code = fs.readFileSync(processorPath, "utf8");

      // Extract the Gate 15 section
      const startMarker = "Gate 15 Pre-Finalization Advisory";
      const endMarker = "declarePersistenceLock('persistence/after-template-completeness')";
      const startIdx = code.indexOf(startMarker);
      const endIdx = code.indexOf(endMarker, startIdx);
      expect(startIdx).toBeGreaterThan(-1);
      expect(endIdx).toBeGreaterThan(startIdx);

      const gate15Section = code.substring(startIdx, endIdx);

      // MUST NOT contain blocking patterns
      expect(gate15Section).not.toContain("markFailed(");
      expect(gate15Section).not.toContain("return {\n          success: false");
      expect(gate15Section).not.toContain("success: false");
      expect(gate15Section).not.toContain("GATE 15 BLOCKED");
    });

    test("processor Gate 15 section MUST contain advisory_only flag", () => {
      const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
      const code = fs.readFileSync(processorPath, "utf8");

      const startIdx = code.indexOf("Gate 15 Pre-Finalization Advisory");
      const endIdx = code.indexOf("declarePersistenceLock('persistence/after-template-completeness')", startIdx);
      const gate15Section = code.substring(startIdx, endIdx);

      expect(gate15Section).toContain("advisory_only: true");
      expect(gate15Section).toContain("ADVISORY");
      expect(gate15Section).toContain("non-blocking");
    });

    test("Gate 15 comment header explicitly states advisory-only purpose", () => {
      const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
      const code = fs.readFileSync(processorPath, "utf8");

      const startIdx = code.indexOf("Gate 15 Pre-Finalization Advisory");
      const endIdx = code.indexOf("declarePersistenceLock('persistence/after-template-completeness')", startIdx);
      const gate15Section = code.substring(startIdx, endIdx);

      // Comment must explain WHY it's advisory
      expect(gate15Section).toContain("ADVISORY-ONLY");
      expect(gate15Section).toContain("Revise phase");
      expect(gate15Section).toContain("NEVER block evaluation completion");
    });
  });

  // ── 2. MISTAKE-PROOFING: Prevent re-introduction of blocking behavior ──

  describe("Mistake-Proofing: Cannot re-introduce Gate 15 blocking", () => {
    test("GATE15_MECHANICAL_PURITY_FAILED must NOT exist in processor.ts", () => {
      const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
      const code = fs.readFileSync(processorPath, "utf8");

      // This error code was used when Gate 15 was blocking. It must never
      // appear in the processor again.
      expect(code).not.toContain("GATE15_MECHANICAL_PURITY_FAILED");
    });

    test("no gate scanning manuscriptText may call markFailed in pre-persistence section", () => {
      const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
      const code = fs.readFileSync(processorPath, "utf8");

      // Find all sections between Gate 15 and persistEvaluationResultV2
      // that reference manuscriptText — none should call markFailed
      const gate15Start = code.indexOf("Gate 15 Pre-Finalization Advisory");
      const persistRpc = code.indexOf("await persistEvaluationResultV2(", gate15Start);
      expect(gate15Start).toBeGreaterThan(-1);
      expect(persistRpc).toBeGreaterThan(gate15Start);

      const betweenSection = code.substring(gate15Start, persistRpc);

      // If any code references manuscriptText AND markFailed in this section,
      // it's a re-introduction of the blocking bug
      const hasManuscriptScan = betweenSection.includes("manuscriptText");
      const hasMarkFailed = betweenSection.includes("markFailed(");

      if (hasManuscriptScan) {
        // Manuscript-scanning code between Gate 15 and persist RPC
        // must NEVER call markFailed
        expect(hasMarkFailed).toBe(false);
      }
    });

    test("no 'blocking: true' or 'blocking' field set in Gate 15 section of processor", () => {
      const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
      const code = fs.readFileSync(processorPath, "utf8");

      const startIdx = code.indexOf("Gate 15 Pre-Finalization Advisory");
      const endIdx = code.indexOf("declarePersistenceLock('persistence/after-template-completeness')", startIdx);
      const gate15Section = code.substring(startIdx, endIdx);

      // Must not set blocking behavior
      expect(gate15Section).not.toMatch(/blocking:\s*true/);
      expect(gate15Section).not.toMatch(/\.blocking\s*=/);
    });
  });

  // ── 3. HARDENING: Gate 15 validator correctness ──

  describe("Hardening: Gate 15 validator correctly identifies but never blocks fiction", () => {
    test("Gate 15.1 correctly identifies dialogue-heavy fiction (but does not block evaluation)", () => {
      const { runGate15_1 } = require("@/lib/evaluation/gate15/gate15_1_validator");

      // Simulate a dialogue-heavy novel excerpt (like Cartel Babies)
      // 30K words with realistic fiction dialogue density
      const dialogueHeavyText = generateDialogueHeavyManuscript(30000);
      const result = runGate15_1(dialogueHeavyText);

      // Gate 15.1 should detect the density issues
      expect(result.overallStatus).toBe("FAIL");
      // But this is EXPECTED for fiction — the evaluation pipeline treats this as advisory
      expect(result.wordCount).toBeGreaterThan(25000);
      expect(result.layer1).toBeDefined();
    });

    test("Gate 15.1 skips short-form manuscripts", () => {
      const { runGate15_1 } = require("@/lib/evaluation/gate15/gate15_1_validator");

      const shortText = "He said hello. She replied warmly. ".repeat(500);
      const result = runGate15_1(shortText);

      expect(result.overallStatus).toBe("SKIPPED");
      expect(result.blocking).toBe(false);
    });

    test("Gate 15 orchestrator produces valid artifact regardless of pass/fail", () => {
      const { runGate15Audit } = require("@/lib/evaluation/gate15");

      const dialogueText = generateDialogueHeavyManuscript(30000);
      const result = runGate15Audit(dialogueText, "test-job-id", "test-manuscript-id");

      // Must produce a valid artifact structure
      expect(result.version).toBe("gate_15_audit_v1");
      expect(result.jobId).toBe("test-job-id");
      expect(result.manuscriptId).toBe("test-manuscript-id");
      expect(result.overallStatus).toBeDefined();
      expect(result.gate15_1).toBeDefined();
      expect(result.gate15_2).toBeDefined();
      expect(result.summaryFindings).toBeInstanceOf(Array);
    });
  });

  // ── 4. ARCHITECTURAL GUARD: Evaluation pipeline must never block on manuscript content ──

  describe("Architectural Guard: Evaluation must never refuse to complete based on manuscript content", () => {
    test("processor has no path where manuscriptText content causes markFailed before persistence", () => {
      const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
      const code = fs.readFileSync(processorPath, "utf8");

      // Find the finalization section (from template completeness to persistEvaluationResultV2)
      const templateGate = code.indexOf("Artifact Consistency Gate v1");
      const persistRpc = code.indexOf("await persistEvaluationResultV2(");
      expect(templateGate).toBeGreaterThan(-1);
      expect(persistRpc).toBeGreaterThan(templateGate);

      const finalizationSection = code.substring(templateGate, persistRpc);

      // Find all markFailed calls in this section
      const markFailedMatches = [...finalizationSection.matchAll(/markFailed\(/g)];

      // Any markFailed in this section must NOT be gated by manuscriptText content analysis.
      // The only allowed markFailed here is from artifact consistency gate (which checks
      // artifact structure, not manuscript content).
      for (const match of markFailedMatches) {
        const contextBefore = finalizationSection.substring(
          Math.max(0, match.index! - 200),
          match.index!
        );
        // Must not be preceded by any Gate 15 / mechanical purity / dialogue analysis
        expect(contextBefore).not.toContain("gate15");
        expect(contextBefore).not.toContain("Gate 15");
        expect(contextBefore).not.toContain("mechanicalPurity");
        expect(contextBefore).not.toContain("dialogueCanon");
        expect(contextBefore).not.toContain("attributionDensity");
        expect(contextBefore).not.toContain("softTag");
        expect(contextBefore).not.toContain("thoughtVerb");
        expect(contextBefore).not.toContain("physiologicalFiller");
      }
    });

    test("failure_code vocabulary does not include any manuscript-content-based codes in processor", () => {
      const processorPath = path.join(repoRoot, "lib/evaluation/processor.ts");
      const code = fs.readFileSync(processorPath, "utf8");

      // These failure codes should never appear as markFailed arguments in processor
      // because they represent manuscript CONTENT issues, not pipeline/system failures
      const manuscriptContentFailureCodes = [
        "GATE15_MECHANICAL_PURITY_FAILED",
        "MANUSCRIPT_DIALOGUE_DENSITY_EXCEEDED",
        "MANUSCRIPT_ATTRIBUTION_EXCEEDED",
        "MANUSCRIPT_THOUGHT_VERB_EXCEEDED",
        "MANUSCRIPT_PHYSIOLOGICAL_FILLER_EXCEEDED",
      ];

      for (const code_val of manuscriptContentFailureCodes) {
        expect(code).not.toContain(code_val);
      }
    });
  });
});

// ── Test Helpers ──────────────────────────────────────────────────────────

/**
 * Generate a realistic dialogue-heavy manuscript for testing.
 * Mimics the density patterns of "Cartel Babies" (fiction with ~7 attributions/1000 words,
 * ~2.8 soft-tags/chapter, ~12.7 thought-verbs/chapter, ~20.3 physiological-fillers/chapter).
 */
function generateDialogueHeavyManuscript(targetWordCount: number): string {
  const paragraphs: string[] = [];
  let currentWords = 0;

  const dialogueLines = [
    '"Get out of here," he said, turning toward the door.',
    '"I thought you were dead," she whispered, barely audible.',
    'He nodded. "We all thought that."',
    '"No sirve," he muttered. It doesn\'t work.',
    'She exhaled slowly, feeling the tension leave her shoulders.',
    '"Ven, mi\'jo," she murmured, reaching for his arm.',
    'He swallowed hard and clenched his fists.',
    '"You don\'t understand," she breathed. "None of you do."',
    'The guard shifted, his hand on the holster. He knew what was coming.',
    '"Mierda," he hissed, slamming the door.',
    'She hesitated, then nodded. The decision was made.',
    '"We thought he had money," Diego said, shrugging.',
    'He felt the cold metal against his neck. Someone whispered behind him.',
    '"Don\'t stare," Raúl murmured. He understood the rules.',
    'She sighed and straightened her collar. "Let\'s go."',
    'He remembered the smell of the camp. The dogs whined in the heat.',
    '"Ya llegamos," someone muttered. We\'re here.',
    'She trembled but said nothing. Her lips were pressed tight.',
    'He paused, considered his options, then replied calmly.',
    '"I knew you\'d come back," she said. He believed her.',
  ];

  while (currentWords < targetWordCount) {
    const para = dialogueLines[paragraphs.length % dialogueLines.length];
    paragraphs.push(para);
    currentWords += para.split(/\s+/).length;
  }

  return paragraphs.join("\n\n");
}
