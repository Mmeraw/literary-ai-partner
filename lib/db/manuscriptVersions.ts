import { getSupabaseAdminClient } from "@/lib/supabase";

export type ManuscriptVersionRow = {
  id: string;
  manuscript_id: number;
  version_number: number;
  source_version_id: string | null;
  raw_text: string;
  word_count: number;
  created_by: string | null;
  created_at: string;
};

type InsertManuscriptVersionInput = {
  manuscript_id: number;
  version_number: number;
  source_version_id?: string | null;
  raw_text: string;
  word_count: number;
  created_by?: string | null;
};

let _supabase: ReturnType<typeof getSupabaseAdminClient> | undefined;

function getSupabase() {
  if (_supabase === undefined) {
    _supabase = getSupabaseAdminClient();
  }
  return _supabase;
}

const supabase = new Proxy({} as NonNullable<ReturnType<typeof getSupabaseAdminClient>>, {
  get(_target, prop) {
    const client = getSupabase();
    if (!client) {
      throw new Error(
        `[MANUSCRIPT-VERSIONS-DB] Supabase unavailable - cannot access .${String(prop)}`,
      );
    }
    return client[prop as keyof typeof client];
  },
});

const VERSION_SELECT =
  "id, manuscript_id, version_number, source_version_id, raw_text, word_count, created_by, created_at";

export async function getVersionById(id: string): Promise<ManuscriptVersionRow | null> {
  const { data, error } = await supabase
    .from("manuscript_versions")
    .select(VERSION_SELECT)
    .eq("id", id)
    .maybeSingle();

  if (error) {
    throw new Error(`Failed to fetch manuscript version ${id}: ${error.message}`);
  }

  return (data as ManuscriptVersionRow | null) ?? null;
}

export async function getVersionByNumber(
  manuscriptId: number,
  versionNumber: number,
): Promise<ManuscriptVersionRow | null> {
  const { data, error } = await supabase
    .from("manuscript_versions")
    .select(VERSION_SELECT)
    .eq("manuscript_id", manuscriptId)
    .eq("version_number", versionNumber)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to fetch manuscript version number ${versionNumber} for manuscript ${manuscriptId}: ${error.message}`,
    );
  }

  return (data as ManuscriptVersionRow | null) ?? null;
}

export async function listVersionsForManuscript(
  manuscriptId: number,
): Promise<ManuscriptVersionRow[]> {
  const { data, error } = await supabase
    .from("manuscript_versions")
    .select(VERSION_SELECT)
    .eq("manuscript_id", manuscriptId)
    .order("version_number", { ascending: true });

  if (error) {
    throw new Error(`Failed to list manuscript versions for ${manuscriptId}: ${error.message}`);
  }

  return (data as ManuscriptVersionRow[]) ?? [];
}

export async function getLatestVersionForManuscript(
  manuscriptId: number,
): Promise<ManuscriptVersionRow | null> {
  const { data, error } = await supabase
    .from("manuscript_versions")
    .select(VERSION_SELECT)
    .eq("manuscript_id", manuscriptId)
    .order("version_number", { ascending: false })
    .limit(1)
    .maybeSingle();

  if (error) {
    throw new Error(
      `Failed to fetch latest manuscript version for manuscript ${manuscriptId}: ${error.message}`,
    );
  }

  return (data as ManuscriptVersionRow | null) ?? null;
}

export async function insertManuscriptVersion(
  input: InsertManuscriptVersionInput,
): Promise<ManuscriptVersionRow> {
  const payload = {
    manuscript_id: input.manuscript_id,
    version_number: input.version_number,
    source_version_id: input.source_version_id ?? null,
    raw_text: input.raw_text,
    word_count: input.word_count,
    created_by: input.created_by ?? null,
  };

  const { data, error } = await supabase
    .from("manuscript_versions")
    .insert(payload)
    .select(VERSION_SELECT)
    .single();

  if (error) {
    throw new Error(`Failed to insert manuscript version: ${error.message}`);
  }

  return data as ManuscriptVersionRow;
}
