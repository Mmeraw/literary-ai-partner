/**
 * Manuscript Version Schema (Stage 2 foundation)
 *
 * A manuscript is a container; each saved text state is an immutable version.
 */

export type ManuscriptVersion = {
  id: string; // uuid
  manuscript_id: number; // manuscripts.id (bigint)
  version_number: number; // 1..n
  source_version_id: string | null; // uuid self-reference
  raw_text: string;
  word_count: number;
  created_by: string | null;
  created_at: string; // ISO timestamp
};

export type CreateInitialManuscriptVersionInput = {
  manuscript_id: number;
  raw_text: string;
  word_count?: number;
  created_by?: string | null;
};

export type CreateDerivedManuscriptVersionInput = {
  manuscript_id: number;
  source_version_id: string;
  raw_text: string;
  word_count?: number;
  created_by?: string | null;
};

export function isManuscriptVersion(obj: unknown): obj is ManuscriptVersion {
  if (!obj || typeof obj !== "object") return false;

  const value = obj as Partial<ManuscriptVersion>;
  return (
    typeof value.id === "string" &&
    typeof value.manuscript_id === "number" &&
    typeof value.version_number === "number" &&
    (typeof value.source_version_id === "string" || value.source_version_id === null) &&
    typeof value.raw_text === "string" &&
    typeof value.word_count === "number" &&
    (typeof value.created_by === "string" || value.created_by === null || value.created_by === undefined) &&
    typeof value.created_at === "string"
  );
}

export function validateCreateInitialVersionInput(
  input: CreateInitialManuscriptVersionInput,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Number.isInteger(input.manuscript_id) || input.manuscript_id <= 0) {
    errors.push("manuscript_id must be a positive integer");
  }

  if (typeof input.raw_text !== "string") {
    errors.push("raw_text must be a string");
  }

  if (typeof input.raw_text === "string" && input.raw_text.trim().length === 0) {
    errors.push("raw_text must be non-empty for new manuscript versions");
  }

  if (
    input.word_count !== undefined &&
    (!Number.isInteger(input.word_count) || input.word_count < 0)
  ) {
    errors.push("word_count must be a non-negative integer when provided");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}

export function validateCreateDerivedVersionInput(
  input: CreateDerivedManuscriptVersionInput,
): { valid: boolean; errors: string[] } {
  const errors: string[] = [];

  if (!Number.isInteger(input.manuscript_id) || input.manuscript_id <= 0) {
    errors.push("manuscript_id must be a positive integer");
  }

  if (typeof input.source_version_id !== "string" || input.source_version_id.trim().length === 0) {
    errors.push("source_version_id must be a non-empty uuid string");
  }

  if (typeof input.raw_text !== "string") {
    errors.push("raw_text must be a string");
  }

  if (typeof input.raw_text === "string" && input.raw_text.trim().length === 0) {
    errors.push("raw_text must be non-empty for new manuscript versions");
  }

  if (
    input.word_count !== undefined &&
    (!Number.isInteger(input.word_count) || input.word_count < 0)
  ) {
    errors.push("word_count must be a non-negative integer when provided");
  }

  return {
    valid: errors.length === 0,
    errors,
  };
}
