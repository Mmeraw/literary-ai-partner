import {
  getActiveEvaluationModes,
  getEvaluationContract,
  getEvaluationTemplateContractMetadata,
  getSupportedEvaluationModes,
  isActiveEvaluationMode,
  isContractComplete,
  getRequiredOpportunityFields,
  getSeverityTiers,
  type EvaluationMode,
} from '@/lib/evaluation/contracts/evaluationContractRegistry';
import { EVALUATION_TEMPLATE_CONTRACTS } from '@/lib/evaluation/unifiedEvaluationDocument';

describe('Evaluation Contract Registry', () => {
  describe('getEvaluationContract', () => {
    it('returns a contract for each supported mode', () => {
      for (const mode of getSupportedEvaluationModes()) {
        const contract = getEvaluationContract(mode);
        expect(contract.mode).toBe(mode);
        expect(contract.authorityLevel).toBe('executable_contract');
        expect(contract.templatePath).toContain('docs/templates/evaluation/');
      }
    });

    it('short_form_evaluation has complete implementation status', () => {
      const contract = getEvaluationContract('short_form_evaluation');
      expect(contract.implementationStatus).toBe('complete');
      expect(contract.missingExecutableRules).toHaveLength(0);
    });

    it('long_form_evaluation is complete but historical-compatibility only', () => {
      const contract = getEvaluationContract('long_form_evaluation');
      expect(contract.implementationStatus).toBe('complete');
      expect(contract.missingExecutableRules).toHaveLength(0);
      expect(contract.productLifecycle).toBe('historical_compatibility');
      expect(contract.outputMode).toBe('legacy_long_form');
    });

    it('long_form_multi_layer_evaluation has complete implementation status', () => {
      const contract = getEvaluationContract('long_form_multi_layer_evaluation');
      expect(contract.implementationStatus).toBe('complete');
      expect(contract.missingExecutableRules).toHaveLength(0);
      expect(contract.productLifecycle).toBe('active');
    });

    it('throws for unknown mode', () => {
      expect(() => getEvaluationContract('invalid_mode' as EvaluationMode)).toThrow();
    });
  });

  describe('short-form contract completeness', () => {
    const contract = getEvaluationContract('short_form_evaluation');

    it('has 14 required sections in correct order', () => {
      const allSections = [...contract.requiredSections, ...contract.optionalSections];
      expect(allSections.length).toBe(14);
      const orders = contract.requiredSections.map(s => s.order);
      for (let i = 1; i < orders.length; i++) {
        expect(orders[i]).toBeGreaterThan(orders[i - 1]);
      }
    });

    it('defines forbidden headings', () => {
      expect(contract.forbiddenHeadings.length).toBeGreaterThan(0);
      expect(contract.forbiddenHeadings).toContain('Action Items');
      expect(contract.forbiddenHeadings).toContain('Strategic Revisions');
    });

    it('defines revision surface rules', () => {
      expect(contract.revisionSurfaceRules.length).toBeGreaterThan(0);
      const criterionRationales = contract.revisionSurfaceRules.find(
        r => r.sectionTitle === 'Criterion Rationales & Surfaced Opportunities'
      );
      expect(criterionRationales).toBeDefined();
      expect(criterionRationales!.ownsOpportunities).toBe(true);
      expect(criterionRationales!.mustTraceToCanonicaLedger).toBe(true);
    });

    it('defines renderer visibility requiring all surfaces match', () => {
      expect(contract.rendererVisibility.allSurfacesMustMatch).toBe(true);
      expect(contract.rendererVisibility.surfaces).toEqual(['web', 'pdf', 'docx', 'txt']);
    });

    it('includes authority chain metadata tracing to Golden Record', () => {
      expect(contract.authorityChain.goldenRecordPath).toBe(
        'docs/templates/evaluation/short-form-evaluation-template.md'
      );
      expect(contract.authorityChain.governanceDocPath).toBe(
        'docs/governance/AUTHORITY_CHAIN.md'
      );
    });
  });

  describe('long-form contracts have required heading sequences', () => {
    it('long-form includes Manuscript-Scale Continuity Findings', () => {
      const contract = getEvaluationContract('long_form_evaluation');
      const titles = contract.requiredSections.map(s => s.title);
      expect(titles).toContain('Manuscript-Scale Continuity Findings');
      expect(titles).toContain('Revision Priority Plan');
    });

    it('multi-layer includes Cross-Layer Synthesis and Layer-Aware Revision Sequencing', () => {
      const contract = getEvaluationContract('long_form_multi_layer_evaluation');
      const titles = contract.requiredSections.map(s => s.title);
      const optionalTitles = contract.optionalSections.map(s => s.title);
      expect(optionalTitles).toContain('Cross-Layer Integration');
      expect(titles).toContain('Layer-Aware Revision Sequencing');
      expect(titles).toContain('Readiness / Releasability Posture');
      expect(titles).toContain('Narrative Synthesis');
      expect(titles).toContain('Market Shelf');
      expect(titles).toContain('Author-Facing Disclaimer');
    });
  });

  describe('Phase 5B authority chain', () => {
    it('derives UED template metadata from the executable contract registry', () => {
      expect(EVALUATION_TEMPLATE_CONTRACTS).toEqual(getEvaluationTemplateContractMetadata());
    });

    it('marks only current product modes active for new submissions', () => {
      expect(getActiveEvaluationModes()).toEqual([
        'short_form_evaluation',
        'long_form_multi_layer_evaluation',
      ]);
      expect(isActiveEvaluationMode('short_form_evaluation')).toBe(true);
      expect(isActiveEvaluationMode('long_form_evaluation')).toBe(false);
      expect(isActiveEvaluationMode('long_form_multi_layer_evaluation')).toBe(true);
    });

    it('locks doctrine → executable contract → UED certification → ViewModel/render parity metadata', () => {
      const expectedContractPaths: Record<EvaluationMode, string> = {
        short_form_evaluation: 'lib/evaluation/contracts/shortFormContract.ts',
        long_form_evaluation: 'lib/evaluation/contracts/longFormContract.ts',
        long_form_multi_layer_evaluation: 'lib/evaluation/contracts/longFormMultiLayerContract.ts',
      };

      for (const mode of getSupportedEvaluationModes()) {
        const contract = getEvaluationContract(mode);
        expect(contract.certificationChain.templateDoctrinePath).toBe(contract.templatePath);
        expect(contract.certificationChain.executableContractPath).toBe(expectedContractPaths[mode]);
        expect(contract.certificationChain.unifiedEvaluationDocumentBuilder).toBe('lib/evaluation/unifiedEvaluationDocument.ts');
        expect(contract.certificationChain.uedCertificationArtifact).toBe('author_exposure_certification_v1');
        expect(contract.certificationChain.viewModelArtifact).toBe('evaluation_report_view_model_v1');
        expect(contract.certificationChain.renderParityGate).toBe('PHASE5_RENDER_PARITY_FAIL');
      }
    });

    it('forbids executable product contracts from creating non-ledger opportunities', () => {
      for (const mode of getSupportedEvaluationModes()) {
        const contract = getEvaluationContract(mode);
        const sections = [...contract.requiredSections, ...contract.optionalSections];
        expect(sections.every((section) => section.mayCreateNewOpportunities === false)).toBe(true);

        for (const rule of contract.revisionSurfaceRules) {
          expect(rule.mayCreateNewOpportunities).toBe(false);
          if (rule.ownsOpportunities || rule.ownsRecommendationText) {
            expect(rule.mustTraceToCanonicalLedger).toBe(true);
          }
        }
      }
    });
  });

  describe('shared rules across all modes', () => {
    it('all modes require the same 9 opportunity fields', () => {
      const fields = getRequiredOpportunityFields();
      expect(fields).toContain('opportunity_id');
      expect(fields).toContain('criterion');
      expect(fields).toContain('severity');
      expect(fields).toContain('evidence');
      expect(fields).toContain('fix_direction');
      expect(fields).toContain('reader_effect');
      expect(fields).toContain('mistake_proofing');
      expect(fields).toHaveLength(9);
    });

    it('all modes use Recommended/Optional/Consider severity tiers', () => {
      const tiers = getSeverityTiers();
      expect(tiers.map(t => t.label)).toEqual(['Recommended', 'Optional', 'Consider']);
    });

    it('all modes forbid the same severity aliases', () => {
      for (const mode of getSupportedEvaluationModes()) {
        const contract = getEvaluationContract(mode);
        expect(contract.forbiddenSeverityAliases).toContain('Critical');
        expect(contract.forbiddenSeverityAliases).toContain('Must Fix');
      }
    });

    it('all modes require canonical ledger traceability for opportunity sections', () => {
      for (const mode of getSupportedEvaluationModes()) {
        const contract = getEvaluationContract(mode);
        const opportunitySections = contract.revisionSurfaceRules.filter(r => r.ownsOpportunities);
        for (const section of opportunitySections) {
          expect(section.mustTraceToCanonicaLedger).toBe(true);
        }
      }
    });
  });

  describe('isContractComplete', () => {
    it('returns true for short_form_evaluation', () => {
      expect(isContractComplete('short_form_evaluation')).toBe(true);
    });

    it('returns true for long_form_evaluation historical compatibility contract', () => {
      expect(isContractComplete('long_form_evaluation')).toBe(true);
    });

    it('returns true for long_form_multi_layer_evaluation', () => {
      expect(isContractComplete('long_form_multi_layer_evaluation')).toBe(true);
    });
  });
});
