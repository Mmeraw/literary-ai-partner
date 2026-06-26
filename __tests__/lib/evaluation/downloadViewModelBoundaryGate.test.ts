/**
 * Download ViewModel Boundary Gate Tests
 *
 * Enforces that the download route (app/api/reports/[jobId]/download/route.ts)
 * obeys the VM-only architecture:
 *
 * 1. Creates exactly one VM from certified UED via normalizeEvaluationReportViewModel
 * 2. Does not recreate a UED-shaped render adapter after VM creation
 * 3. TXT/PDF/DOCX builders consume the ViewModel directly
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
  describe('VM creation and direct renderer wiring', () => {
    it('imports normalizeEvaluationReportViewModel', () => {
      expect(routeSource).toMatch(/import\s+\{[^}]*normalizeEvaluationReportViewModel[^}]*\}\s+from/);
    });

    it('creates VM from certified canonicalDoc via named envelope', () => {
      // VM is built from the certified UED (canonicalDoc) through the named
      // input envelope. DREAM is passed in as an upstream artifact for the VM
      // to project — renderers never see it directly.
      expect(executableSource).toMatch(
        /const\s+vm\s*=\s*normalizeEvaluationReportViewModel\(\s*\{[^}]*ued:\s*canonicalDoc/,
      );
    });

    it('does not create a UED-shaped render adapter after VM creation', () => {
      expect(executableSource).not.toMatch(/canonicalDocForRender/);
      expect(executableSource).not.toMatch(/applyViewModelToDocument/);
    });
  });

  describe('Source-truth gates use certified canonicalDoc only', () => {
    it('runRevisionSurfaceOwnershipGate uses canonicalDoc (not canonicalDocForRender)', () => {
      expect(executableSource).toMatch(/runRevisionSurfaceOwnershipGate\(\s*canonicalDoc\s*\)/);
      expect(executableSource).not.toMatch(/runRevisionSurfaceOwnershipGate\(\s*canonicalDocForRender\s*\)/);
    });

    it('VM render output is never passed to insert/upsert/update (non-persistence)', () => {
      const persistLines = executableSource
        .split('\n')
        .filter(line => /\b(insert|upsert|update)\s*\(/.test(line));
      for (const line of persistLines) {
        expect(line).not.toMatch(/render(Txt|Html|Docx)FromViewModel/);
      }
    });
  });

  describe('TXT/PDF/DOCX builders consume VM directly', () => {
    // We check invocation sites only — filter out function declarations
    // (which have parameter names like `doc: UnifiedEvaluationDocument`).
    function getInvocations(fnName: string): string[] {
      const all = executableSource.match(new RegExp(`${fnName}\\([^)]+\\)`, 'g')) ?? [];
      // Exclude function signature lines (contain `: ` type annotations)
      return all.filter(call => !call.includes(': '));
    }

    it('renderTxtFromViewModel invocations use vm', () => {
      const calls = getInvocations('renderTxtFromViewModel');
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call).toMatch(/renderTxtFromViewModel\(\s*vm\b/);
      }
    });

    it('renderHtmlFromViewModel invocations use vm', () => {
      const calls = getInvocations('renderHtmlFromViewModel');
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call).toMatch(/renderHtmlFromViewModel\(\s*vm\b/);
      }
    });

    it('renderDocxFromViewModel invocations use vm', () => {
      const calls = getInvocations('renderDocxFromViewModel');
      expect(calls.length).toBeGreaterThan(0);
      for (const call of calls) {
        expect(call).toMatch(/renderDocxFromViewModel\(\s*vm\b/);
      }
    });
  });

  describe('Banned sanitization on VM-owned fields', () => {
    // THE REAL INVARIANT:
    // No renderer-side sanitizer on certified source fields.
    // Only VM-owned fields may enter the render adapter.
    //
    // PASS: renderTxtFromViewModel(vm), renderHtmlFromViewModel(vm)
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

    it('does not read shadow inventories from any render adapter', () => {
      expect(executableSource).not.toMatch(/\b(actionItems|quickWins|strategicRevisions)\b/);
    });
  });

  describe('Long-Form Multi-Layer rendering flows through the VM only', () => {
    // Migration complete: DREAM is now projected into
    // vm.longFormMultiLayerEvaluation at the VM boundary. Renderers must never
    // receive raw `dream` or call DREAM helpers on any field.

    it('does not call getDisplayDream* on vm.* fields', () => {
      expect(executableSource).not.toMatch(/getDisplayDream\w*\(\s*vm\b/);
    });

    it('does not call filterAuthorFacingTextList on vm.* fields', () => {
      expect(executableSource).not.toMatch(/filterAuthorFacingTextList\(\s*vm\b/);
    });

    it('does not call getRenumberedAuthorFacingRevisionPlan on vm.* fields', () => {
      expect(executableSource).not.toMatch(/getRenumberedAuthorFacingRevisionPlan\(\s*vm\b/);
    });

    it('active renderers receive only vm — no raw dream argument', () => {
      // Migration complete: the `dream` param was removed from the active
      // renderers. DREAM reaches output exclusively via
      // vm.longFormMultiLayerEvaluation, projected once at the VM boundary.
      const dreamParamCalls = executableSource.match(
        /renderTxtFromViewModel\([^,)]+,\s*dream\b|renderHtmlFromViewModel\([^,)]+,\s*dream\b|renderDocxFromViewModel\([^,)]+,\s*dream\b/g,
      );
      expect(dreamParamCalls).toBeNull();
    });
  });

  describe('Legacy bridge removal', () => {
    it('does not contain old UED bridge or canonical template renderers', () => {
      expect(routeSource).not.toMatch(/function\s+applyViewModelToDocument/);
      expect(routeSource).not.toMatch(/function\s+buildCanonicalTemplateTxt/);
      expect(routeSource).not.toMatch(/function\s+renderCanonicalTemplateHtml/);
      expect(routeSource).not.toMatch(/function\s+buildCanonicalTemplateDocx/);
    });
  });
});
