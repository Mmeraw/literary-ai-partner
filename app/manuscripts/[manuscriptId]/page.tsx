import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { normalizeFinalReviewText } from "@/lib/revision/finalReviewSourceText";
import RepairSourceSnapshotButton from "@/components/manuscripts/RepairSourceSnapshotButton";

export const dynamic = "force-dynamic";

type PageProps = {
  params: Promise<{ manuscriptId: string }>;
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

function scalar(value: string | string[] | undefined): string | undefined {
  return Array.isArray(value) ? value[0] : value;
}

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleString("en-US", { month: "short", day: "numeric", year: "numeric", hour: "numeric", minute: "2-digit" });
}

function formatWords(value: number | null | undefined): string {
  return Number(value || 0).toLocaleString();
}

function decodeDataText(fileUrl: string | null | undefined): string {
  if (!fileUrl?.startsWith("data:")) return "";
  const comma = fileUrl.indexOf(",");
  if (comma === -1) return "";
  try {
    return normalizeFinalReviewText(decodeURIComponent(fileUrl.slice(comma + 1)));
  } catch {
    return "";
  }
}

export default async function ManuscriptSourcePage({ params, searchParams }: PageProps) {
  const user = await getAuthenticatedUser();
  if (!user?.id) redirect("/signin");

  const { manuscriptId: manuscriptIdRaw } = await params;
  const manuscriptId = Number(manuscriptIdRaw);
  if (!Number.isInteger(manuscriptId) || manuscriptId <= 0) notFound();

  const requestedVersionId = scalar((await searchParams)?.versionId);
  const supabase = createAdminClient();
  const { data: manuscript, error } = await supabase
    .from("manuscripts")
    .select("id,title,user_id,word_count,source,file_size,file_url,created_at,updated_at")
    .eq("id", manuscriptId)
    .eq("user_id", user.id)
    .maybeSingle();

  if (error || !manuscript) notFound();

  const { data: versions } = await supabase
    .from("manuscript_versions")
    .select("id,version_number,word_count,created_at,source_version_id,raw_text")
    .eq("manuscript_id", manuscriptId)
    .order("version_number", { ascending: true });

  const versionRows = Array.isArray(versions) ? versions : [];
  const selectedVersion = requestedVersionId
    ? versionRows.find((version: any) => version.id === requestedVersionId) ?? null
    : versionRows.at(-1) ?? null;
  const hasSourceSnapshot = versionRows.length > 0;
  const selectedVersionText = normalizeFinalReviewText(String(selectedVersion?.raw_text ?? ""));
  const previewText = (selectedVersionText || decodeDataText((manuscript as { file_url?: string | null }).file_url)).slice(0, 8000);
  const previewLabel = selectedVersion
    ? `Version ${selectedVersion.version_number}`
    : "Original upload";

  return (
    <main className="min-h-screen bg-[#0D0A05] px-4 py-8 text-[#F5EFE4] md:px-6">
      <section className="mx-auto max-w-6xl rounded-3xl border border-[#3A3022] bg-[#1C160E] p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-start lg:justify-between">
          <div>
            <p className="font-rg-mono text-xs uppercase tracking-[0.22em] text-[#C8A96E]">Manuscript source</p>
            <h1 className="mt-3 font-rg-serif text-4xl leading-tight text-[#F8F1E6] md:text-5xl">{manuscript.title || "Untitled Manuscript"}</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#CBBDA4]">
              {hasSourceSnapshot
                ? "This is the saved manuscript RevisionGrade uses for evaluations, Revise, Final Review, and revised-manuscript generation."
                : "Source snapshot missing. Please repair before evaluating."}
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/manuscripts" className="rounded border border-[#5D4C31] px-3 py-2 text-[#E8D8BA] hover:border-[#C8A96E]">All manuscripts</Link>
            {hasSourceSnapshot ? (
              <Link href={`/evaluate?manuscriptId=${manuscript.id}`} className="rounded border border-[#C8A96E] bg-[#C8A96E] px-3 py-2 font-semibold text-[#1A140C] hover:bg-[#D8BB7B]">Evaluate this manuscript</Link>
            ) : null}
          </div>
        </div>

        {!hasSourceSnapshot ? (
          <div className="mt-6 rounded-xl border border-[#6D332D] bg-[#2A130F] p-4">
            <p className="text-sm font-semibold text-[#FFD8CC]">Source snapshot missing. Please repair before evaluating.</p>
            <p className="mt-1 text-xs text-[#F4C6B9]">This manuscript has no immutable Version 1 source snapshot yet. Evaluation is blocked until repaired.</p>
            <RepairSourceSnapshotButton manuscriptId={manuscriptId} />
          </div>
        ) : null}

        {requestedVersionId && !selectedVersion ? (
          <div className="mt-6 rounded-xl border border-amber-400/40 bg-amber-500/10 p-4 text-amber-100">
            <p className="text-sm font-semibold">The requested revised version was not found for this manuscript.</p>
            <p className="mt-1 text-xs text-amber-100/80">Showing the original manuscript preview instead.</p>
          </div>
        ) : null}

        <div className="mt-8 grid gap-3 md:grid-cols-4">
          <div className="rounded-xl border border-[#2D2519] bg-[#120E08] p-4"><p className="text-xs uppercase tracking-[0.14em] text-[#C8A96E]">Words</p><p className="mt-2 text-2xl font-semibold">{formatWords(selectedVersion?.word_count ?? manuscript.word_count)}</p></div>
          <div className="rounded-xl border border-[#2D2519] bg-[#120E08] p-4"><p className="text-xs uppercase tracking-[0.14em] text-[#C8A96E]">Source</p><p className="mt-2 text-2xl font-semibold">{manuscript.source || "saved"}</p></div>
          <div className="rounded-xl border border-[#2D2519] bg-[#120E08] p-4"><p className="text-xs uppercase tracking-[0.14em] text-[#C8A96E]">Versions</p><p className="mt-2 text-2xl font-semibold">{versionRows.length}</p></div>
          <div className="rounded-xl border border-[#2D2519] bg-[#120E08] p-4"><p className="text-xs uppercase tracking-[0.14em] text-[#C8A96E]">Viewing</p><p className="mt-2 text-sm font-semibold">{previewLabel}</p></div>
        </div>

        <div className="mt-8 grid gap-5 lg:grid-cols-[1fr_320px]">
          <article className="rounded-2xl border border-[#2D2519] bg-[#120E08] p-5">
            <h2 className="font-rg-serif text-2xl text-[#F8F1E6]">{previewLabel} preview</h2>
            <p className="mt-1 text-sm text-[#A9987D]">Preview only. The complete saved version remains immutable.</p>
            <div className="mt-4 max-h-[520px] overflow-auto rounded-xl border border-[#2E261A] bg-[#0D0A05] px-6 py-5 font-rg-serif text-base leading-[2] text-[#E9DCC4] whitespace-pre-wrap">
              {previewText || "No preview text is available for this manuscript version."}
            </div>
          </article>

          <aside className="rounded-2xl border border-[#2D2519] bg-[#120E08] p-5">
            <h2 className="font-rg-serif text-2xl text-[#F8F1E6]">Version lineage</h2>
            <p className="mt-1 text-sm leading-6 text-[#A9987D]">Version 1 is the original upload. Later versions are revised outputs.</p>
            <div className="mt-4 space-y-3">
              {versionRows.length > 0 ? versionRows.map((version: any) => {
                const isSelected = selectedVersion?.id === version.id;
                return (
                  <Link
                    key={version.id}
                    href={`/manuscripts/${manuscriptId}?versionId=${encodeURIComponent(version.id)}`}
                    aria-current={isSelected ? "page" : undefined}
                    className="block rounded-xl border bg-[#0D0A05] p-3 hover:border-[#C8A96E]"
                    style={{ borderColor: isSelected ? "#C8A96E" : "#2E261A" }}
                  >
                    <div className="flex items-center justify-between gap-3">
                      <strong className="text-[#F8F1E6]">Version {version.version_number}</strong>
                      <span className="text-xs text-[#C8A96E]">{formatWords(version.word_count)} words</span>
                    </div>
                    <p className="mt-1 text-xs text-[#8F806A]">{formatDate(version.created_at)}</p>
                    {version.source_version_id && <p className="mt-1 text-xs text-[#A9987D]">Derived from prior source</p>}
                    {isSelected && <p className="mt-2 text-[10px] font-semibold uppercase tracking-[0.14em] text-[#C8A96E]">Currently viewing</p>}
                  </Link>
                );
              }) : (
                <p className="rounded-xl border border-dashed border-[#3A3022] p-4 text-sm text-[#A9987D]">Source snapshot missing. Please repair before evaluating.</p>
              )}
            </div>
          </aside>
        </div>
      </section>
    </main>
  );
}
