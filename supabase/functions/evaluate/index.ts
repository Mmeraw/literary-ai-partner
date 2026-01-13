// supabase/functions/evaluate/index.ts
// RevisionGrade Evaluation Edge Function - 13 Story Criteria

type RGCriterion = {
  name: string;
  score: number; // 0-10
  strengths: string[];
  weaknesses: string[];
  recommendations: string[];
};

type RGResponse = {
  overall_score: number; // 0-100
  criteria: RGCriterion[]; // exactly 13 entries
  wave_diagnostics?: Record<string, unknown>;
  agent_ready?: boolean;
  next_actions?: string[];
  notes?: string[];
  meta?: {
    model?: string;
    latency_ms?: number;
    request_id?: string;
  };
};

function jsonResponse(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: {
      "Content-Type": "application/json",
      "Access-Control-Allow-Origin": "*",
      "Access-Control-Allow-Headers":
        "authorization, x-client-info, apikey, content-type, x-eval-token",
      "Access-Control-Allow-Methods": "POST, OPTIONS",
    },
  });
}

function buildPrompt(manuscriptText: string) {
  return `
You are RevisionGrade. Evaluate the manuscript text below using 13 literary criteria.

Return ONLY valid JSON (no markdown, no code fences, no commentary).
The JSON MUST match this schema exactly:

{
  "overall_score": number (0-100),
  "criteria": [
    {
      "name": string,
      "score": number (0-10),
      "strengths": [string],
      "weaknesses": [string],
      "recommendations": [string]
    }
    // exactly 13 objects
  ],
  "agent_ready": boolean,
  "next_actions": [string],
  "notes": [string]
}

The 13 criteria MUST be exactly these names in this order:
1) Hook & Premise
2) Voice & Prose
3) Character Depth
4) Conflict & Tension
5) Theme & Meaning
6) Structure & Plot
7) Pacing
8) Dialogue
9) Worldbuilding
10) Stakes
11) Polish & Clarity
12) Market Positioning
13) Emotional Resonance

For each criterion:
- score: 0-10 (10 = publishable, agent-ready)
- strengths: 2-4 specific examples from the text
- weaknesses: 2-4 areas needing improvement
- recommendations: 2-4 concrete action items

overall_score: weighted average (0-100), where 85+ = agent-ready
agent_ready: true if overall_score >= 85 and all criteria >= 7
next_actions: top 3-5 priority revisions
notes: 2-3 high-level observations

Manuscript text:
"""${manuscriptText}"""
`.trim();
}

function extractJson(text: string): string {
  const firstBrace = text.indexOf("{");
  const lastBrace = text.lastIndexOf("}");
  if (firstBrace === -1 || lastBrace === -1 || lastBrace <= firstBrace) return text;
  return text.slice(firstBrace, lastBrace + 1);
}

Deno.serve(async (req) => {
  const start = Date.now();

  if (req.method === "OPTIONS") {
    return jsonResponse({ ok: true }, 200);
  }

  if (req.method !== "POST") {
    return jsonResponse({ error: "Method not allowed" }, 405);
  }

  // Simple abuse gate
  const requiredToken = Deno.env.get("EVAL_TOKEN") || "";
  if (requiredToken) {
    const gotToken = req.headers.get("x-eval-token") || "";
    if (gotToken !== requiredToken) {
      return jsonResponse({ error: "Unauthorized" }, 401);
    }
  }

  const OPENAI_API_KEY = Deno.env.get("OPENAI_API_KEY");
  if (!OPENAI_API_KEY) {
    return jsonResponse({ error: "Missing OPENAI_API_KEY in function secrets" }, 500);
  }

  const model = Deno.env.get("OPENAI_MODEL") || "gpt-4o-mini";

  let payload: { text?: string } = {};
  try {
    payload = await req.json();
  } catch {
    return jsonResponse({ error: "Invalid JSON body" }, 400);
  }

  const text = (payload.text || "").trim();
  if (!text) return jsonResponse({ error: "Missing 'text' in request body" }, 400);

  const prompt = buildPrompt(text);

  const openaiRes = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${OPENAI_API_KEY}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      temperature: 0.2,
      messages: [
        { role: "system", content: "You output strict JSON only. No markdown." },
        { role: "user", content: prompt },
      ],
    }),
  });

  if (!openaiRes.ok) {
    const errText = await openaiRes.text().catch(() => "");
    return jsonResponse(
      { error: "OpenAI request failed", status: openaiRes.status, detail: errText.slice(0, 500) },
      502
    );
  }

  const data = await openaiRes.json();
  const raw = data?.choices?.[0]?.message?.content ?? "";
  const jsonText = extractJson(String(raw));

  let parsed: RGResponse;
  try {
    parsed = JSON.parse(jsonText);
  } catch {
    return jsonResponse(
      {
        error: "Model did not return valid JSON",
        raw_preview: String(raw).slice(0, 800),
      },
      502
    );
  }

  // Validate we got exactly 13 criteria
  if (!parsed.criteria || parsed.criteria.length !== 13) {
    return jsonResponse(
      {
        error: `Expected 13 criteria, got ${parsed.criteria?.length || 0}`,
        criteria_received: parsed.criteria?.map(c => c.name),
      },
      502
    );
  }

  const latency = Date.now() - start;
  parsed.meta = { ...(parsed.meta || {}), model, latency_ms: latency };

  return jsonResponse(parsed, 200);
});
