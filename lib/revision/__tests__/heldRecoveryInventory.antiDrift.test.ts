import { describe, it, expect } from '@jest/globals';
import {
  HELD_REASON_INVENTORY,
  getHeldReasonInfo,
  normalizeHeldReasonCode,
} from '@/lib/revision/heldRecoveryReasons';
import { VOICE_GATE_REASON_CODES } from '@/lib/revision/voiceGate';
import { CANON_GATE_REASON_CODES } from '@/lib/revision/canonGate';
import {
  ADMISSION_CANDIDATE_QUALITY_REASON_CODES,
  LEDGER_CANDIDATE_QUALITY_REASON_CODES,
  LEDGER_CARD_QUALITY_FAILED,
} from '@/lib/revision/candidateQuality';
import {
  COPY_PASTE_ADMISSION_REASON_CODES,
  STRATEGY_ADMISSION_REASON_CODES,
  ADMISSION_REASON,
} from '@/lib/revision/reviseAdmissionGate';
import {
  BASE_DECISION_LOCAL_REASON_CODES,
  BASE_DECISION_REASON,
} from '@/lib/revision/recommendationExecutability';
import { INTEGRITY_VIOLATION_CODES } from '@/lib/evaluation/pipeline/recommendationIntegrityGate';
import {
  LEDGER_CANDIDATE_COMPLIANCE_REASON_CODES,
  LEDGER_DIAGNOSTIC_REASON_CODES,
  LEDGER_HYDRATION_REASON_CODES,
  LEDGER_PREFLIGHT_REASON_CODES,
  LEDGER_TELEMETRY_REASON_CODES,
} from '@/lib/revision/opportunityLedger';

function normalize(code: string): string {
  return normalizeHeldReasonCode(code);
}

function* allProducerCodes(): Generator<string> {
  for (const code of VOICE_GATE_REASON_CODES) yield normalize(code);
  for (const code of CANON_GATE_REASON_CODES) yield normalize(code);
  for (const code of ADMISSION_CANDIDATE_QUALITY_REASON_CODES) yield normalize(code);
  for (const code of LEDGER_CANDIDATE_QUALITY_REASON_CODES) yield normalize(code);
  yield normalize(LEDGER_CARD_QUALITY_FAILED);
  for (const code of COPY_PASTE_ADMISSION_REASON_CODES) yield normalize(code);
  for (const code of STRATEGY_ADMISSION_REASON_CODES) yield normalize(code);
  for (const code of BASE_DECISION_LOCAL_REASON_CODES) yield normalize(code);
  for (const code of INTEGRITY_VIOLATION_CODES) {
    yield `integrity_${normalize(code)}`;
  }
  yield normalize(ADMISSION_REASON.INTEGRITY_BELOW_PASS_STRONG);
  for (const code of LEDGER_CANDIDATE_COMPLIANCE_REASON_CODES) yield normalize(code);
  for (const code of LEDGER_DIAGNOSTIC_REASON_CODES) yield normalize(code);
  for (const code of LEDGER_PREFLIGHT_REASON_CODES) yield normalize(code);
  for (const code of LEDGER_HYDRATION_REASON_CODES) yield normalize(code);
  for (const code of LEDGER_TELEMETRY_REASON_CODES) yield normalize(code);
  // Base-decision passthrough reasons can also appear from admission arrays.
  yield normalize(BASE_DECISION_REASON.COPY_PASTE_ADMISSION_FAILED);
  yield normalize(BASE_DECISION_REASON.STRATEGY_ADMISSION_FAILED);
}

describe('HELD_REASON_INVENTORY anti-drift invariant', () => {
  it('has a registry entry for every structured canonical production reason', () => {
    const missing: string[] = [];
    for (const code of new Set(allProducerCodes())) {
      const info = getHeldReasonInfo(code);
      if (info.isUnknown) {
        missing.push(code);
      }
    }
    expect(missing).toEqual([]);
  });

  it('only marks a reason currently_emitted when a producer emits it', () => {
    const emitted = new Set(allProducerCodes());
    const falselyEmitted: string[] = [];
    for (const [code, info] of Object.entries(HELD_REASON_INVENTORY)) {
      if (info.status === 'currently_emitted' && !emitted.has(code)) {
        falselyEmitted.push(code);
      }
    }
    expect(falselyEmitted).toEqual([]);
  });
});
