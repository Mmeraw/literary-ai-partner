/**
 * Character Arc Ledger — Public exports
 *
 * Types: PR-578
 * Extraction worker: PR-579 (this PR)
 * Gate enforcement: PR-581
 */
export type {
  NarrativeWeightBand,
  ArcMovement,
  ArcEndingStatus,
  ReportAcknowledgementStatus,
  CharacterArcEntry,
  RelationalEngine,
  ArcGateVerdict,
  HardFailReason,
  SoftFailReason,
  CharacterArcLedger,
  CharacterArcLedgerArtifactContent,
} from './types';

export { runCharacterArcExtraction } from './runCharacterArcExtraction';
export type { ArcExtractionInput, ArcExtractionResult } from './runCharacterArcExtraction';
