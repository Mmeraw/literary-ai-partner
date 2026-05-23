import {
  canonicalLayerKeys,
  checkSupportArtifactFreshness,
  forbidLayer9,
  forbidPhase2WithoutAcceptedLedger,
  requireAcceptedLedger,
  requireOverrideRole,
  requireQualityReport,
  requireStoryLayer,
  requireUserFeedback,
  type ArtifactSet,
} from '../../lib/evaluation/stage-machine/hardStopGuards';

const artifact = (id: string) => ({ artifact_id: id, source_hash: `hash:${id}` });

describe('stage machine hard-stop guards', () => {
  it('requires story layer and quality report before review gate', () => {
    expect(requireStoryLayer({ pass1a_story_layer_v1: artifact('pass1a') })).toEqual({ ok: true });
    expect(requireStoryLayer({})).toMatchObject({ ok: false });

    expect(requireQualityReport({ ledger_quality_report_v1: artifact('quality') })).toEqual({ ok: true });
    expect(requireQualityReport({})).toMatchObject({ ok: false });
  });

  it('requires user feedback even when the review disposition is accepted_without_changes', () => {
    expect(requireUserFeedback({ ledger_user_feedback_v1: artifact('feedback') })).toEqual({ ok: true });
    expect(requireUserFeedback({})).toMatchObject({
      ok: false,
      reason: expect.stringContaining('accepted_without_changes'),
    });
  });

  it('requires accepted ledger before Phase 2 and rejects raw ledger-only handoff', () => {
    const rawOnly: ArtifactSet = {
      pass1a_story_layer_v1: artifact('pass1a'),
      ledger_user_feedback_v1: artifact('feedback'),
    };

    expect(requireAcceptedLedger({ accepted_story_ledger_v1: artifact('accepted') })).toEqual({ ok: true });
    expect(requireAcceptedLedger(rawOnly)).toMatchObject({ ok: false });
    expect(forbidPhase2WithoutAcceptedLedger(rawOnly)).toMatchObject({
      ok: false,
      reason: expect.stringContaining('raw pass1a_story_layer_v1'),
    });
  });

  it('allows override only for admin or operator roles', () => {
    expect(requireOverrideRole('admin')).toEqual({ ok: true });
    expect(requireOverrideRole('operator')).toEqual({ ok: true });
    expect(requireOverrideRole('author')).toMatchObject({ ok: false });
  });

  it('flags stale support artifacts relative to accepted_story_ledger_v1', () => {
    expect(checkSupportArtifactFreshness({
      accepted_story_ledger_v1: artifact('accepted'),
      story_shape_signal_map_v1: { accepted_story_ledger_source_hash: 'hash:accepted' },
      manuscript_signal_appendix_v1: { accepted_story_ledger_source_hash: 'hash:accepted' },
    })).toEqual({ ok: true });

    expect(checkSupportArtifactFreshness({
      accepted_story_ledger_v1: artifact('accepted'),
      story_shape_signal_map_v1: { accepted_story_ledger_source_hash: 'stale-hash' },
    })).toMatchObject({
      ok: false,
      reason: expect.stringContaining('stale'),
    });
  });

  it('rejects any ninth or non-canonical Story Layer key', () => {
    expect(forbidLayer9(canonicalLayerKeys())).toEqual({ ok: true });

    expect(forbidLayer9([
      ...canonicalLayerKeys(),
      'structural_beat_layer',
    ])).toMatchObject({
      ok: false,
      reason: expect.stringContaining('non-canonical'),
    });
  });

  it('rejects missing or duplicate canonical layer keys', () => {
    expect(forbidLayer9(canonicalLayerKeys().slice(0, 7))).toMatchObject({ ok: false });

    expect(forbidLayer9([
      ...canonicalLayerKeys().slice(0, 7),
      canonicalLayerKeys()[0],
    ])).toMatchObject({ ok: false });
  });
});
