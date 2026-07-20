import { redirect } from "next/navigation";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import ManuscriptLibraryClient from "@/components/manuscripts/ManuscriptLibraryClient";

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
        </div>

        {error && (
          <div className="mt-6 rounded-xl border border-red-400/40 bg-red-500/10 p-4 text-sm text-red-100">
            Could not load manuscripts: {error.message}
          </div>
        )}

        <div className="mt-8">
          <ManuscriptLibraryClient manuscripts={manuscripts} />
        </div>
      </section>
    </main>
  );
}
