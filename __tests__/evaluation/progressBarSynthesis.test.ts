import { __testing__ } from '../../components/evaluation-poller-display';

const { getProgressDisplay } = __testing__;

describe('Progress bar — synthesis-aware display', () => {
  describe('short-form jobs (< 25k words)', () => {
    it('returns 100% green when complete', () => {
      const pd = getProgressDisplay({
        status: 'complete',
        manuscript_word_count: 10000,
      });
      expect(pd).not.toBeNull();
      expect(pd!.percentage).toBe(100);
      expect(pd!.color).toBe('green');
      expect(pd!.label).toBe('Evaluation complete!');
    });

    it('returns 100% green when complete with no word count', () => {
      const pd = getProgressDisplay({ status: 'complete' });
      expect(pd).not.toBeNull();
      expect(pd!.percentage).toBe(100);
      expect(pd!.color).toBe('green');
    });
  });

  describe('long-form jobs (≥ 25k words)', () => {
    it('returns 92% blue when complete but synthesis NOT done', () => {
      const pd = getProgressDisplay({
        status: 'complete',
        manuscript_word_count: 50000,
        pass3_completed_at: null,
      });
      expect(pd).not.toBeNull();
      expect(pd!.percentage).toBe(92);
      expect(pd!.color).toBe('blue');
      expect(pd!.label).toContain('Finalizing your report in progress');
      expect(pd!.helperText).toContain('13-criteria diagnostic report is ready');
      expect(pd!.helperText).toContain('Finalizing your report');
    });

    it('returns 92% blue when complete and pass3_completed_at is absent', () => {
      const pd = getProgressDisplay({
        status: 'complete',
        manuscript_word_count: 30000,
      });
      expect(pd).not.toBeNull();
      expect(pd!.percentage).toBe(92);
      expect(pd!.color).toBe('blue');
    });

    it('returns 100% green when complete AND synthesis IS done', () => {
      const pd = getProgressDisplay({
        status: 'complete',
        manuscript_word_count: 50000,
        pass3_completed_at: '2026-01-01T00:00:00Z',
      });
      expect(pd).not.toBeNull();
      expect(pd!.percentage).toBe(100);
      expect(pd!.color).toBe('green');
      expect(pd!.label).toContain('full report ready');
    });

    it('treats exactly 25000 words as long-form', () => {
      const pd = getProgressDisplay({
        status: 'complete',
        manuscript_word_count: 25000,
        pass3_completed_at: null,
      });
      expect(pd).not.toBeNull();
      expect(pd!.percentage).toBe(92);
      expect(pd!.color).toBe('blue');
    });

    it('treats 24999 words as short-form', () => {
      const pd = getProgressDisplay({
        status: 'complete',
        manuscript_word_count: 24999,
      });
      expect(pd).not.toBeNull();
      expect(pd!.percentage).toBe(100);
      expect(pd!.color).toBe('green');
    });
  });

  describe('non-complete statuses are unchanged', () => {
    it('returns null for failed', () => {
      expect(getProgressDisplay({ status: 'failed' })).toBeNull();
    });

    it('returns queued state for queued', () => {
      const pd = getProgressDisplay({ status: 'queued' });
      expect(pd).not.toBeNull();
      expect(pd!.label).toBe('Starting your evaluation...');
      expect(pd!.percentage).toBe(2);
    });

    it('returns running phase_1a state correctly', () => {
      const pd = getProgressDisplay({
        status: 'running',
        phase: 'phase_1a',
        phase_status: 'running',
        phase_unit_fraction: 0.3,
      });
      expect(pd).not.toBeNull();
      expect(pd!.percentage).toBeGreaterThanOrEqual(15);
      expect(pd!.percentage).toBeLessThanOrEqual(34);
      expect(pd!.color).toBe('blue');
    });

    it('returns review_gate state correctly', () => {
      const pd = getProgressDisplay({
        status: 'running',
        phase: 'review_gate',
      });
      expect(pd).not.toBeNull();
      expect(pd!.percentage).toBe(50);
      expect(pd!.hardStop).toBe(true);
    });

    it('returns review_gate with hard_fail as red', () => {
      const pd = getProgressDisplay({
        status: 'running',
        phase: 'review_gate',
        hard_fail_present: true,
      });
      expect(pd).not.toBeNull();
      expect(pd!.color).toBe('red');
      expect(pd!.label).toContain('Blocked');
    });
  });

  describe('hardStop flag', () => {
    it('is false for interim-complete (synthesis pending)', () => {
      const pd = getProgressDisplay({
        status: 'complete',
        manuscript_word_count: 50000,
        pass3_completed_at: null,
      });
      expect(pd!.hardStop).toBe(false);
    });

    it('is false for final complete', () => {
      const pd = getProgressDisplay({
        status: 'complete',
        manuscript_word_count: 50000,
        pass3_completed_at: '2026-01-01T00:00:00Z',
      });
      expect(pd!.hardStop).toBe(false);
    });
  });
});
