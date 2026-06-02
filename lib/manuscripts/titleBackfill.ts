import { createAdminClient } from "@/lib/supabase/admin";
import { getManuscriptText } from "@/lib/manuscripts/chunks";
import { deriveManuscriptTitleFromText } from "@/lib/manuscripts/title";

/**
 * Attempt to backfill a missing manuscript title by deriving it from the
 * manuscript text content.  Returns the derived title on success or null
 * when derivation is not possible.  On success the `manuscripts` row is
 * updated in-place so subsequent loads see the corrected title.
 */
export async function backfillManuscriptTitleIfMissing(
  manuscriptId: number,
): Promise<string | null> {
  if (!Number.isFinite(manuscriptId) || manuscriptId <= 0) return null;

  try {
    const text = await getManuscriptText(manuscriptId);
    if (!text || text.trim().length === 0) return null;

    const derived = deriveManuscriptTitleFromText(text);
    if (!derived || derived === "Imported Manuscript") return null;

    const supabase = createAdminClient();
    const { error } = await supabase
      .from("manuscripts")
      .update({ title: derived })
      .eq("id", manuscriptId)
      .is("title", null);

    if (error) {
      console.warn(
        `[backfillManuscriptTitleIfMissing] Failed to update manuscript ${manuscriptId}:`,
        error.message,
      );
    }

    return derived;
  } catch (err) {
    console.warn(
      `[backfillManuscriptTitleIfMissing] Error for manuscript ${manuscriptId}:`,
      err,
    );
    return null;
  }
}
