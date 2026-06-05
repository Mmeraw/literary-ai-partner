export const SLAE_GROUNDING_STATUSES = [
  'supported',
  'supported_after_relook',
  'uncertain_after_relook_reportable',
  'uncertain_after_relook_blocked',
  'unsupported_blocked',
] as const;

export type SlaeGroundingStatus = typeof SLAE_GROUNDING_STATUSES[number];

export type SlaeGroundingDecision = {
  status: SlaeGroundingStatus;
  note: string | null;
};

export function isSlaeGroundingStatus(value: unknown): value is SlaeGroundingStatus {
  return typeof value === 'string' && (SLAE_GROUNDING_STATUSES as readonly string[]).includes(value);
}
