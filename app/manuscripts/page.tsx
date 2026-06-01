import Link from "next/link";
import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

export const dynamic = "force-dynamic";

type ManuscriptRow = {
  id: number;
  title: string | null;
  word_count: number | null;
  source: string | null;
  file_size: number | null;
  created_at?: string | null;
  updated_at?: string | null;
};

function formatDate(value: string | null | undefined): string {
  if (!value) return "—";
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return "—";
  return date.toLocaleDateString("en-US", { month: "short", day: "numeric", year: "numeric" });
}

function formatWords(value: number | null | undefined): string {
  return Number(value || 0).toLocaleString();
}

export default async function ManuscriptLibraryPage() {
  const user = await getAuthenticatedUser();
  if (!user?.id) redirect("/signin");

  const supabase = createAdminClient();
  const { data, error } = await supabase
    .from("manuscripts")
    .select("id,title,word_count,source,file_size,created_at,updated_at")
    .eq("user_id", user.id)
    .order("updated_at", { ascending: false })
    .limit(100);

  const manuscripts = (data ?? []) as ManuscriptRow[];

  return (
    <main className="min-h-screen bg-[#0D0A05] px-4 py-8 text-[#F5EFE4] md:px-6">
      <section className="mx-auto max-w-6xl rounded-3xl border border-[#3A3022] bg-[#1C160E] p-6 md:p-8">
        <div className="flex flex-col gap-5 lg:flex-row lg:items-end lg:justify-between">
          <div>
            <p className="font-rg-mono text-xs uppercase tracking-[0.22em] text-[#C8A96E]">Workspace · manuscript library</p>
            <h1 className="mt-3 font-rg-serif text-4xl leading-tight text-[#F8F1E6] md:text-5xl">Your uploaded manuscripts.</h1>
            <p className="mt-3 max-w-3xl text-sm leading-6 text-[#CBBDA4]">
              This is the source library for Evaluation, Revise, Final Review, and revised-manuscript export. Each evaluation should point back to one saved source manuscript and its immutable source snapshot.
            </p>
          </div>
          <div className="flex flex-wrap gap-2 text-xs">
            <Link href="/evaluate" className="rounded border border-[#C8A96E] bg-[#C8A96E] px-3 py-2 font-semibold text-[#1A140C] hover:bg-[#D8BB7B]">Upload / evaluate</Link>
            <Link href="/dashboard" className="rounded border border-[#5D4C31] px-3 py-2 text-[#E8D8BA] hover:border-[#C8A96E]">Dashboard</Link>
          </div>
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">
            Could not load manuscripts: {error.message}
          </div>
        )}

        <div className="mt-8 overflow-hidden rounded-2xl border border-[#2D2519]">
          <table className="w-full min-w-[820px] border-collapse text-left text-sm">
            <thead className="bg-[#120E08] text-xs uppercase tracking-[0.16em] text-[#C8A96E]">
              <tr>
                <th className="px-4 py-3">Manuscript</th>
                <th className="px-4 py-3">Words</th>
                <th className="px-4 py-3">Source</th>
                <th className="px-4 py-3">Updated</th>
                <th className="px-4 py-3 text-right">Actions</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-[#2D2519]">
              {manuscripts.length === 0 ? (
                <tr>
                  <td colSpan={5} className="px-4 py-8 text-center text-[#A9987D]">
                    No saved manuscripts yet. Upload a DOCX/TXT or paste text from the Evaluate page.
                  </td>
                </tr>
              ) : (
                manuscripts.map((manuscript) => (
                  <tr key={manuscript.id} className="bg-[#171109] text-[#F3E3C3]">
                    <td className="px-4 py-4">
                      <Link href={`/manuscripts/${manuscript.id}`} className="font-semibold text-[#F8F1E6] hover:text-[#C8A96E]">
                        {manuscript.title || "Untitled Manuscript"}
                      </Link>
                      <div className="mt-1 text-xs text-[#8F806A]">ID {manuscript.id}</div>
                    </td>
                    <td className="px-4 py-4 text-[#E8D8BA]">{formatWords(manuscript.word_count)}</td>
                    <td className="px-4 py-4 text-[#CBBDA4]">{manuscript.source || "saved"}</td>
                    <td className="px-4 py-4 text-[#CBBDA4]">{formatDate(manuscript.updated_at || manuscript.created_at)}</td>
                    <td className="px-4 py-4">
                      <div className="flex justify-end gap-2 text-xs">
                        <Link href={`/manuscripts/${manuscript.id}`} className="rounded border border-[#5D4C31] px-3 py-2 text-[#E8D8BA] hover:border-[#C8A96E]">Open source</Link>
                        <Link href={`/evaluate?manuscriptId=${manuscript.id}`} className="rounded border border-[#C8A96E] px-3 py-2 text-[#F3E3C3] hover:bg-[#2A2115]">Evaluate</Link>
                      </div>
                    </td>
                  </tr>
                ))
              )}
            </tbody>
          </table>
        </div>
      </section>
    </main>
  );
}
