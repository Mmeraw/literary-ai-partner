import { createClient } from "@supabase/supabase-js";

describe("Anti-mock regression (real AI path)", () => {
  const supabaseUrl = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
  const openaiKey = process.env.OPENAI_API_KEY;
  const runRealAiTests = process.env.RUN_REAL_AI_TESTS === "1";

  const itIf = (cond: any) => (cond ? it : it.skip);
  const hasUsableSecrets =
    !!supabaseUrl &&
    !!serviceKey &&
    !!openaiKey &&
    /^sk-/.test(openaiKey) &&
    !/replace|placeholder/i.test(openaiKey);

  const shouldRun = runRealAiTests && hasUsableSecrets;

  itIf(shouldRun)(
    "fails if a real-AI evaluation stores MOCK EVALUATION warnings",
    async () => {
      const supabase = createClient(supabaseUrl!, serviceKey!);

      // Pull most recent completed evaluations (tune limit as desired)
      const { data, error } = await supabase
        .from("evaluation_jobs")
        .select("id, evaluation_result, created_at")
        .eq("status", "complete")
        .order("created_at", { ascending: false })
        .limit(10);

      if (error) throw new Error(error.message);
      expect(data && data.length).toBeGreaterThan(0);

      // Find any job that claims mock
      const offenders = (data ?? []).filter((row: any) => {
        const warnings: string[] = row?.evaluation_result?.governance?.warnings ?? [];
        return warnings.some((w) => /mock evaluation/i.test(String(w)));
      });

      expect(offenders).toEqual([]);

      // Optional: sanity check at least one looks like real OpenAI
      const latest = data?.[0] as any;
      expect(latest?.evaluation_result?.engine?.provider).toBe("openai");
      expect(String(latest?.evaluation_result?.engine?.model ?? "")).toMatch(/^gpt-/);
    }
  );
});
