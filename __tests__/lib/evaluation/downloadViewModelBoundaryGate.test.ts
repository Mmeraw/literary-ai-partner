/**
 * Download ViewModel Boundary Gate Tests
 *
 * Enforces that the download route (app/api/reports/[jobId]/download/route.ts)
 * obeys the VM-only architecture:
 *
 * 1. Creates exactly one VM from certified UED via normalizeEvaluationReportViewModel
 * 2. canonicalDocForRender is ephemeral render adapter ONLY (never persisted, never source-truth)
 * 3. TXT/PDF/DOCX builders consume canonicalDocForRender, not canonicalDoc for VM-owned fields
 * 4. Source-truth gates use canonicalDoc (never canonicalDocForRender)
 * 5. Static guard: download route must not call sanitization on VM-owned fields post-VM
 * 6. TEMPORARY_DREAM_RENDERER_EXCEPTION is visible technical debt
 *
 * Enforced by: __tests__/lib/evaluation/downloadViewModelBoundaryGate.test.ts
 */

import * as fs from 'fs';
import * as path from 'path';

const DOWNLOAD_ROUTE_PATH = path.resolve(
  __dirname,
  '../../../app/api/reports/[jobId]/download/route.ts',
);

const routeSource = fs.readFileSync(DOWNLOAD_ROUTE_PATH, 'utf-8');

// Strip comments for executable-code-only analysis
function stripComments(src: string): string {
  return src
    .replace(/\/\*[\s\S]*?\*\//g, '')
    .replace(/\/\/.*$/gm, '');
}

const executableSource = stripComments(routeSource);

describe('Download ViewModel Boundary Gate — Static Guards', () => {
  describe('VM creation and adapter wiring', () => {
    it('imports normalizeEvaluationReportViewModel', () => {
      expect(routeSource).toMatch(/import\s+\{[^}]*normalizeEvaluationReportViewModel[^}]*\}\s+from/);
    });

    it('creates VM from certified canonicalDoc', () => {
      expect(executableSource).toMatch(
        /const\s+vm\s*=\s*normalizeEvaluationReportViewModel\(\s*canonicalDoc\s*\)/,
      );
    });

    it('creates canonicalDocForRender from VM adapter', () => {
      expect(executableSource).toMatch(
        /const\s+canonicalDocForRender\s*=\s*applyViewModelToDocument\(\s*canonicalDoc\s*,\s*vm\s*\)/,
      );
    });
  });

  describe('Source-truth gates use certified canonicalDoc only', () => {
    it('runRevisionSurfaceOwnershipGate uses canonicalDoc (not canonicalDocForRender)', () => {
      expect(executableSource).toMatch(/runRevisionSurfaceOwnershipGate\(\s*canonicalDoc\s*\)/);
      expect(executableSource).not.toMatch(/runRevisionSurfaceOwnershipGate\(\s*canonicalDocForRender\s*\)/);
    });

    it('canonicalDocForRender is never passed to insert/upsert/update (non-persistence)', () => {
      const persistLines = executableSource
        .split('\n')
        .filter(line => /\b(insert|upsert|update)\s*\(/.test(line));
      for (const line of persistLines) {
        expect(line).not.toContain('canonicalDocForRender');
      }
    });
  });

  describe('TXT/PDF/DOCX builders use canonicalDocForRender', () => {
    // We check invocation sites only — filter out function declarations
    // (which have parameter names like `doc: UnifiedEvaluationDocument`).
    function getInvocations(fnName: string): string[] {
      const all = executableSource.match(new RegExp(`${fnName}\\([^)]+\\)`, 'g')) ?? [];
      // Exclude function signature lines (contain `: ` type annotations)
      return all.filter(call => !call.includes(': '));
    }

    it('buildCanonicalTemplateTxt invocations use canonicalDocForRender', () => {
      const calls = getInvocations('buildCanonicalTemplateTxt');
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call).toContain('canonicalDocForRender');
      }
    });

    it('renderCanonicalTemplateHtml invocations use canonicalDocForRender', () => {
      const calls = getInvocations('renderCanonicalTemplateHtml');
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call).toContain('canonicalDocForRender');
      }
    });

    it('buildCanonicalTemplateDocx invocations use canonicalDocForRender', () => {
      const calls = getInvocations('buildCanonicalTemplateDocx');
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call).toContain('canonicalDocForRender');
      }
    });
  });

  describe('Banned sanitization on VM-owned fields', () => {
    // THE REAL INVARIANT:
    // No renderer-side sanitizer on certified source fields.
    // Only VM-owned fields may enter the render adapter.
    //
    // PASS: cleanReportText(vm.oneParagraphPitch), applyViewModelToDocument(canonicalDoc, vm)
    // FAIL: cleanReportText(canonicalDoc.oneParagraphPitch), mistakeProofText(canonicalDoc...)
    //
    // The builders internally call cleanReportText on doc.* fields — that's the
    // transitional bridge pattern. The route-level orchestration code after VM
    // creation must NOT independently sanitize canonicalDoc fields.

    it('route handler does not call correctScopeLanguage on canonicalDoc.* after VM creation', () => {
      const lines = executableSource.split('\n');
      const vmLineIdx = lines.findIndex(l => /const\s+vm\s*=\s*normalizeEvaluationReportViewModel/.test(l));
      // Get route-handler-level code after VM creation (not inside builder functions)
      const afterVm = lines.slice(vmLineIdx);
      // Find the section that is route handler level (between VM creation and function definitions)
      for (const line of afterVm) {
        // Skip function definition bodies (builder internals are transitional — PR-2 scope)
        if (/^\s*function\s/.test(line) || /^\s*async\s+function/.test(line)) break;
        if (/correctScopeLanguage\s*\(\s*canonicalDoc\b/.test(line)) {
          fail(`Found banned correctScopeLanguage(canonicalDoc...) in route handler: ${line.trim()}`);
        }
        if (/mistakeProofText\s*\(\s*canonicalDoc\b/.test(line)) {
          fail(`Found banned mistakeProofText(canonicalDoc...) in route handler: ${line.trim()}`);
        }
        if (/cleanReportText\s*\(\s*canonicalDoc\b/.test(line)) {
          fail(`Found banned cleanReportText(canonicalDoc...) in route handler: ${line.trim()}`);
        }
      }
    });

    it('route handler does not call sanitizers on vm.* fields (VM already sanitized)', () => {
      const lines = executableSource.split('\n');
      const vmLineIdx = lines.findIndex(l => /const\s+vm\s*=\s*normalizeEvaluationReportViewModel/.test(l));
      const afterVm = lines.slice(vmLineIdx);
      for (const line of afterVm) {
        if (/^\s*function\s/.test(line) || /^\s*async\s+function/.test(line)) break;
        if (/correctScopeLanguage\s*\(\s*vm\b/.test(line)) {
          fail(`Found banned correctScopeLanguage(vm...) — VM already sanitized: ${line.trim()}`);
        }
        if (/mistakeProofText\s*\(\s*vm\b/.test(line)) {
          fail(`Found banned mistakeProofText(vm...) — VM already sanitized: ${line.trim()}`);
        }
        if (/cleanReportText\s*\(\s*vm\b/.test(line)) {
          fail(`Found banned cleanReportText(vm...) — VM already sanitized: ${line.trim()}`);
        }
      }
    });

    it('route does not call sanitizeAuthorFacingDisplayValue anywhere', () => {
      expect(executableSource).not.toMatch(/sanitizeAuthorFacingDisplayValue/);
    });

    it('does not expose vm.actionItems / vm.quickWins / vm.strategicRevisions', () => {
      expect(executableSource).not.toMatch(/vm\.(actionItems|quickWins|strategicRevisions)/);
    });

    it('does not read canonicalDocForRender.actionItems', () => {
      expect(executableSource).not.toMatch(/canonicalDocForRender\.(actionItems|quickWins|strategicRevisions)/);
    });
  });

  describe('TEMPORARY_DREAM_RENDERER_EXCEPTION policy', () => {
    // DREAM helper functions (getDisplayDream*, filterAuthorFacingTextList, etc.)
    // are allowed on dream.* objects only. They must NOT be called on vm.* fields.
    // This is visible technical debt until Phase 4b PR-2 migrates DREAM to VM.

    it('does not call getDisplayDream* on vm.* fields', () => {
      expect(executableSource).not.toMatch(/getDisplayDream\w*\(\s*vm\b/);
    });

    it('does not call filterAuthorFacingTextList on vm.* fields', () => {
      expect(executableSource).not.toMatch(/filterAuthorFacingTextList\(\s*vm\b/);
    });

    it('does not call getRenumberedAuthorFacingRevisionPlan on vm.* fields', () => {
      expect(executableSource).not.toMatch(/getRenumberedAuthorFacingRevisionPlan\(\s*vm\b/);
    });

    it('DREAM helpers on dream.* are allowed (TEMPORARY_DREAM_RENDERER_EXCEPTION)', () => {
      // This test documents that dream.* helper usage is intentional temporary debt.
      // The route currently passes `dream` to builders (e.g., buildCanonicalTemplateTxt(doc, dream, ...))
      // which is the DREAM enrichment path — acceptable until PR-2.
      const dreamParamCalls = executableSource.match(
        /buildCanonicalTemplateTxt\([^,]+,\s*dream\b|renderCanonicalTemplateHtml\([^,]+,\s*dream\b|buildCanonicalTemplateDocx\([^,]+,\s*dream\b/g,
      );
      expect(dreamParamCalls?.length).toBeGreaterThan(0);
    });
  });

  describe('Phase 4b PR-2 TODO presence', () => {
    it('contains TODO for Phase 4b PR-2 direct VM renderers', () => {
      expect(routeSource).toMatch(/TODO.*Phase 4b PR-2/i);
    });

    it('contains TRANSITIONAL CONTRACT documentation', () => {
      expect(routeSource).toMatch(/TRANSITIONAL CONTRACT/);
    });
  });

  describe('No shadow inventory in render adapter', () => {
    // applyViewModelToDocument must not expose forbidden inventory fields
    it('applyViewModelToDocument does not project actionItems/quickWins/strategicRevisions', () => {
      // Extract the adapter function body
      const adapterMatch = routeSource.match(
        /function applyViewModelToDocument[\s\S]*?^}/m,
      );
      expect(adapterMatch).not.toBeNull();
      const adapterBody = adapterMatch![0];
      expect(adapterBody).not.toMatch(/actionItems/);
      expect(adapterBody).not.toMatch(/quickWins/);
      expect(adapterBody).not.toMatch(/strategicRevisions/);
      expect(adapterBody).not.toMatch(/revisionPlan(?!:)/); // revisionPriorityPlan allowed
      expect(adapterBody).not.toMatch(/reviewGate/);
      expect(adapterBody).not.toMatch(/releasabilityAssessment/);
    });
  });
});
