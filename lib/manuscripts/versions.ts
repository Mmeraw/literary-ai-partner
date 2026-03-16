import {
  getLatestVersionForManuscript,
  getVersionById as getVersionByIdFromDb,
  getVersionByNumber,
  insertManuscriptVersion,
  listVersionsForManuscript as listVersionsForManuscriptFromDb,
  type ManuscriptVersionRow,
} from "@/lib/db/manuscriptVersions";
import {
  type CreateDerivedManuscriptVersionInput,
  type CreateInitialManuscriptVersionInput,
  validateCreateDerivedVersionInput,
  validateCreateInitialVersionInput,
} from "@/schemas/manuscript-version";

function normalizeWordCount(rawText: string, providedWordCount?: number): number {
  if (typeof providedWordCount === "number") return providedWordCount;

  const trimmed = rawText.trim();
  if (!trimmed) return 0;

  return trimmed.split(/\s+/).length;
}

/**
 * Create (or return) the initial immutable manuscript version (version_number = 1).
 * Idempotent behavior: if v1 already exists, return it instead of creating a duplicate.
 */
export async function createInitialVersion(
  input: CreateInitialManuscriptVersionInput,
): Promise<ManuscriptVersionRow> {
  const validation = validateCreateInitialVersionInput(input);
  if (!validation.valid) {
    throw new Error(`Invalid createInitialVersion input: ${validation.errors.join("; ")}`);
  }

  const existingV1 = await getVersionByNumber(input.manuscript_id, 1);
  if (existingV1) return existingV1;

  return insertManuscriptVersion({
    manuscript_id: input.manuscript_id,
    version_number: 1,
    source_version_id: null,
    raw_text: input.raw_text,
    word_count: normalizeWordCount(input.raw_text, input.word_count),
    created_by: input.created_by ?? null,
  });
}

/**
 * Create a derived immutable manuscript version from an existing source version.
 */
export async function createDerivedVersion(
  input: CreateDerivedManuscriptVersionInput,
): Promise<ManuscriptVersionRow> {
  const validation = validateCreateDerivedVersionInput(input);
  if (!validation.valid) {
    throw new Error(`Invalid createDerivedVersion input: ${validation.errors.join("; ")}`);
  }

  const sourceVersion = await getVersionByIdFromDb(input.source_version_id);
  if (!sourceVersion) {
    throw new Error(`Source version not found: ${input.source_version_id}`);
  }

  if (sourceVersion.manuscript_id !== input.manuscript_id) {
    throw new Error(
      `Source version ${sourceVersion.id} does not belong to manuscript ${input.manuscript_id}`,
    );
  }

  const latest = await getLatestVersionForManuscript(input.manuscript_id);
  const nextVersionNumber = (latest?.version_number ?? 0) + 1;

  return insertManuscriptVersion({
    manuscript_id: input.manuscript_id,
    version_number: nextVersionNumber,
    source_version_id: sourceVersion.id,
    raw_text: input.raw_text,
    word_count: normalizeWordCount(input.raw_text, input.word_count),
    created_by: input.created_by ?? null,
  });
}

export async function getVersionById(id: string): Promise<ManuscriptVersionRow | null> {
  return getVersionByIdFromDb(id);
}

export async function listVersionsForManuscript(
  manuscriptId: number,
): Promise<ManuscriptVersionRow[]> {
  return listVersionsForManuscriptFromDb(manuscriptId);
}
