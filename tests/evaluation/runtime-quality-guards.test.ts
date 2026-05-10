import { describe, it, expect, jest, beforeEach, afterEach } from '@jest/globals';
import {
  classifyCompressionGovernance,
  emitCompressionGovernanceSignal,
} from '../../lib/evaluation/governance/runtimeQualityGuards';

describe('Phase 1 seed-band divergence-collapse governance', () => {
  describe('classifyCompressionGovernance — band assignment', () => {
    it('compression_pass_band: ratio >= 0.10 → pass', () => {
      const result = classifyCompressionGovernance({
        representation_compression_ratio: 0.15,
        packet_source: 'long_form_chunks_canonical',
      });
      expect(result.state).toBe('pass');
      expect(result.log_level).toBe('silent');
      expect(result.band_label).toContain('pass');
    });

    it('compression_pass_band: ratio = 0.10 (boundary) → pass', () => {
      const result = classifyCompressionGovernance({
        representation_compression_ratio: 0.1,
        packet_source: 'long_form_chunks_canonical',
      });
      expect(result.state).toBe('pass');
    });

    it('compression_warn_band: 0.05 <= ratio < 0.10 → warn', () => {
      const result = classifyCompressionGovernance({
        representation_compression_ratio: 0.07,
        packet_source: 'long_form_chunks_canonical',
      });
      expect(result.state).toBe('warn');
      expect(result.log_level).toBe('warn');
      expect(result.band_label).toContain('warn');
    });

    it('compression_warn_band: ratio = 0.05 (boundary) → warn', () => {
      const result = classifyCompressionGovernance({
        representation_compression_ratio: 0.05,
        packet_source: 'long_form_chunks_canonical',
      });
      expect(result.state).toBe('warn');
    });

    it('compression_observe_band: ratio < 0.05 → observe (NOT hard_fail in Phase 1)', () => {
      const result = classifyCompressionGovernance({
        representation_compression_ratio: 0.03,
        packet_source: 'long_form_chunks_canonical',
      });
      expect(result.state).toBe('observe');
      expect(result.log_level).toBe('observe');
      expect(result.band_label).toContain('observe');
      expect(['pass', 'warn', 'observe', null]).toContain(result.state);
    });
  });

  describe('phase_1_no_hard_fail_invariant', () => {
    it('no input produces hard_fail state across full ratio domain', () => {
      const ratios = [0, 0.001, 0.01, 0.04, 0.049, 0.05, 0.07, 0.099, 0.1, 0.5, 0.99, 1, 2];
      for (const ratio of ratios) {
        const result = classifyCompressionGovernance({
          representation_compression_ratio: ratio,
          packet_source: 'long_form_chunks_canonical',
        });
        expect(['pass', 'warn', 'observe', null]).toContain(result.state);
        // @ts-expect-error — proving hard_fail is not in the type union
        expect(result.state).not.toBe('hard_fail');
      }
    });
  });

  describe('short_form_compression_governance_unchanged', () => {
    it('short-form bypasses long-form bands → state null', () => {
      const result = classifyCompressionGovernance({
        representation_compression_ratio: 0.02,
        packet_source: 'short_form_initial_text',
      });
      expect(result.state).toBeNull();
      expect(result.log_level).toBe('silent');
    });

    it('short-form with high ratio still returns null', () => {
      const result = classifyCompressionGovernance({
        representation_compression_ratio: 0.5,
        packet_source: 'short_form_initial_text',
      });
      expect(result.state).toBeNull();
    });
  });

  describe('null and non-finite inputs', () => {
    it('null ratio → state null', () => {
      const result = classifyCompressionGovernance({
        representation_compression_ratio: null as any,
        packet_source: 'long_form_chunks_canonical',
      });
      expect(result.state).toBeNull();
    });

    it('undefined ratio → state null', () => {
      const result = classifyCompressionGovernance({
        representation_compression_ratio: undefined as any,
        packet_source: 'long_form_chunks_canonical',
      });
      expect(result.state).toBeNull();
    });

    it('non-finite ratio (Infinity) → state null', () => {
      const result = classifyCompressionGovernance({
        representation_compression_ratio: Infinity,
        packet_source: 'long_form_chunks_canonical',
      });
      expect(result.state).toBeNull();
    });

    it('non-finite ratio (NaN) → state null', () => {
      const result = classifyCompressionGovernance({
        representation_compression_ratio: NaN,
        packet_source: 'long_form_chunks_canonical',
      });
      expect(result.state).toBeNull();
    });
  });

  describe('emitCompressionGovernanceSignal — log behavior', () => {
    let warnSpy: ReturnType<typeof jest.spyOn>;
    let infoSpy: ReturnType<typeof jest.spyOn>;

    beforeEach(() => {
      warnSpy = jest.spyOn(console, 'warn').mockImplementation(() => {});
      infoSpy = jest.spyOn(console, 'info').mockImplementation(() => {});
    });

    afterEach(() => {
      warnSpy.mockRestore();
      infoSpy.mockRestore();
    });

    it('pass band: silent (no log)', () => {
      emitCompressionGovernanceSignal(
        {
          state: 'pass',
          ratio: 0.15,
          band_label: 'pass_band_>=0.10',
          log_level: 'silent',
        },
        { jobId: 'job-1', chunkCount: 4 },
      );
      expect(warnSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
    });

    it('warn band: console.warn with Pass3CompressionGuard:WARN tag', () => {
      emitCompressionGovernanceSignal(
        {
          state: 'warn',
          ratio: 0.07,
          band_label: 'warn_band_0.05-0.10',
          log_level: 'warn',
        },
        { jobId: 'job-2', chunkCount: 5 },
      );
      expect(warnSpy).toHaveBeenCalledWith(
        'Pass3CompressionGuard:WARN',
        expect.objectContaining({
          governance: 'Pass3CompressionGuard',
          state: 'warn',
          ratio: 0.07,
          job_id: 'job-2',
          chunk_count: 5,
          phase: 1,
        }),
      );
    });

    it('observe band: console.info with Pass3CompressionGuard:OBSERVE tag', () => {
      emitCompressionGovernanceSignal(
        {
          state: 'observe',
          ratio: 0.03,
          band_label: 'observe_band_<0.05',
          log_level: 'observe',
        },
        { jobId: 'job-3', chunkCount: 6 },
      );
      expect(infoSpy).toHaveBeenCalledWith(
        'Pass3CompressionGuard:OBSERVE',
        expect.objectContaining({
          governance: 'Pass3CompressionGuard',
          state: 'observe',
          ratio: 0.03,
          job_id: 'job-3',
          chunk_count: 6,
          phase: 1,
          note: expect.stringContaining('Phase 1 observation-only'),
        }),
      );
    });

    it('null state: silent', () => {
      emitCompressionGovernanceSignal(
        {
          state: null,
          ratio: null,
          band_label: 'short_form_or_null',
          log_level: 'silent',
        },
        { jobId: 'job-4', chunkCount: 0 },
      );
      expect(warnSpy).not.toHaveBeenCalled();
      expect(infoSpy).not.toHaveBeenCalled();
    });
  });
});
