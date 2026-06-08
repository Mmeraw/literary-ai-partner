import { runVoiceGate } from '../../../lib/revision/voiceGate';

describe('voiceGate', () => {
  it('passes neutral candidate prose', () => {
    expect(runVoiceGate({ candidateText: 'I kept my hand on the door and listened.' }).passed).toBe(true);
  });

  it('flags obvious POV drift for first-person context', () => {
    const result = runVoiceGate({ candidateText: 'He kept his hand on the door and listened.', pov: 'first' });
    expect(result.passed).toBe(false);
    expect(result.reasons).toContain('VOICE_DRIFT_POV');
  });
});
