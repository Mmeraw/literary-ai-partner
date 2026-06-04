/**
 * Pass 4 — Voice-Conditioned Rewrite Runner
 *
 * Generates manuscript-ready A/B/C replacement prose for a single
 * revision opportunity using the author's voice extracted from
 * surrounding manuscript context.
 *
 * This module is designed to be called:
 * 1. During workbench queue build (batch mode) — for all ≤1200 word items
 * 2. On-demand via "Generate in Voice" button — for a single item
 *
 * Cost: ~$0.005 per call with gpt-4.1-mini (avg 800 input + 600 output tokens)
 * Budget: 100 items × 1 call each = ~$0.50 per evaluation
 */

import OpenAI from "openai";
import {
  PASS4_SYSTEM_PROMPT,
  PASS4_REWRITE_VERSION,
  buildPass4UserPrompt,
  type Pass4RewriteInput,
} from "./prompts/pass4-voice-rewrite";
import { withRetry } from "@/lib/evaluation/pipeline/openaiRetry";

export interface Pass4RewriteResult {
  a: string;
  b: string;
  c: string;
  model: string;
  promptVersion: string;
  inputTokens: number;
  outputTokens: number;
  /** Whether only variant A was generated (TrustedPath cost savings) */
  trustedPathOnly: boolean;
}

export interface Pass4RewriteError {
  error: string;
  opportunityId: string;
}

const TEMPLATE_TOKENS = /\b(LOCATION|OPERATION|CHARACTER|PROTAGONIST|ANTAGONIST)\b/;

function validateRewriteOutput(output: { a: string; b?: string; c?: string }, trustedPathOnly: boolean): boolean {
  const keys = trustedPathOnly ? ["a"] as const : ["a", "b", "c"] as const;
  for (const key of keys) {
    const text = output[key];
    if (!text || text.trim().length < 20) return false;
    if (TEMPLATE_TOKENS.test(text)) return false;
    if (text.split(/\s+/).length < 5) return false;
  }
  return true;
}

/**
 * Extract voice context from the manuscript around the target passage.
 * Returns ~500-800 words of surrounding text for voice conditioning.
 */
export function extractVoiceContext(
  manuscriptText: string,
  targetPassage: string,
  contextWords: number = 300,
): string {
  if (!manuscriptText || !targetPassage) return "";

  // Find the target passage in the manuscript
  const targetClean = targetPassage.replace(/\s+/g, " ").trim().slice(0, 100);
  const manuscriptClean = manuscriptText.replace(/\s+/g, " ");
  const idx = manuscriptClean.toLowerCase().indexOf(targetClean.toLowerCase().slice(0, 60));

  if (idx === -1) {
    // Can't find exact location — use a representative sample from the middle
    const words = manuscriptClean.split(/\s+/);
    const mid = Math.floor(words.length / 2);
    const start = Math.max(0, mid - contextWords);
    const end = Math.min(words.length, mid + contextWords);
    return words.slice(start, end).join(" ");
  }

  // Extract surrounding context
  const words = manuscriptClean.split(/\s+/);
  const charToWord = new Map<number, number>();
  let charPos = 0;
  for (let i = 0; i < words.length; i++) {
    charToWord.set(charPos, i);
    charPos += words[i].length + 1;
  }

  // Find approximate word index for our target
  let targetWordIdx = 0;
  let runningChars = 0;
  for (let i = 0; i < words.length; i++) {
    if (runningChars >= idx) {
      targetWordIdx = i;
      break;
    }
    runningChars += words[i].length + 1;
  }

  // Get context before and after, excluding the target passage itself
  const targetWordCount = targetPassage.split(/\s+/).length;
  const beforeStart = Math.max(0, targetWordIdx - contextWords);
  const beforeEnd = targetWordIdx;
  const afterStart = Math.min(words.length, targetWordIdx + targetWordCount);
  const afterEnd = Math.min(words.length, afterStart + contextWords);

  const before = words.slice(beforeStart, beforeEnd).join(" ");
  const after = words.slice(afterStart, afterEnd).join(" ");

  return `${before}\n\n[...target passage location...]\n\n${after}`;
}

/**
 * Generate voice-conditioned A/B/C rewrites for a single revision opportunity.
 */
export async function runPass4VoiceRewrite(
  input: Pass4RewriteInput,
  options?: {
    model?: string;
    temperature?: number;
    maxTokens?: number;
  },
): Promise<Pass4RewriteResult> {
  const model = options?.model ?? process.env.EVAL_REWRITE_MODEL ?? "gpt-4.1-mini";
  const temperature = options?.temperature ?? 0.6;
  // TrustedPath (A-only) uses fewer output tokens
  const maxTokens = options?.maxTokens ?? (input.trustedPathOnly ? 800 : 2000);

  const openai = new OpenAI();
  const userPrompt = buildPass4UserPrompt(input);

  const response = await withRetry(
    () =>
      openai.chat.completions.create({
        model,
        temperature,
        max_tokens: maxTokens,
        response_format: { type: "json_object" },
        messages: [
          { role: "system", content: PASS4_SYSTEM_PROMPT },
          { role: "user", content: userPrompt },
        ],
      }),
    { maxAttempts: 2, label: "pass4_voice_rewrite" },
  );

  const content = response.choices[0]?.message?.content ?? "";
  const usage = response.usage;

  let parsed: { a: string; b?: string; c?: string };
  try {
    parsed = JSON.parse(content);
  } catch {
    throw new Error(`Pass 4 rewrite returned invalid JSON: ${content.slice(0, 200)}`);
  }

  if (!validateRewriteOutput(parsed, !!input.trustedPathOnly)) {
    throw new Error(
      `Pass 4 rewrite failed quality gate — output contains template tokens or is too short`,
    );
  }

  return {
    a: parsed.a!.trim(),
    b: input.trustedPathOnly ? "" : (parsed.b ?? "").trim(),
    c: input.trustedPathOnly ? "" : (parsed.c ?? "").trim(),
    model,
    promptVersion: PASS4_REWRITE_VERSION,
    inputTokens: usage?.prompt_tokens ?? 0,
    outputTokens: usage?.completion_tokens ?? 0,
    trustedPathOnly: !!input.trustedPathOnly,
  };
}

/**
 * Batch rewrite runner — processes multiple opportunities in sequence
 * with rate limiting between calls.
 */
export async function runPass4BatchRewrite(
  items: Array<{
    opportunityId: string;
    input: Pass4RewriteInput;
  }>,
  options?: {
    model?: string;
    delayBetweenCallsMs?: number;
    onProgress?: (completed: number, total: number) => void;
  },
): Promise<{
  results: Map<string, Pass4RewriteResult>;
  errors: Pass4RewriteError[];
  totalInputTokens: number;
  totalOutputTokens: number;
}> {
  const results = new Map<string, Pass4RewriteResult>();
  const errors: Pass4RewriteError[] = [];
  let totalInputTokens = 0;
  let totalOutputTokens = 0;

  const delay = options?.delayBetweenCallsMs ?? 200;

  for (let i = 0; i < items.length; i++) {
    const item = items[i];
    try {
      const result = await runPass4VoiceRewrite(item.input, { model: options?.model });
      results.set(item.opportunityId, result);
      totalInputTokens += result.inputTokens;
      totalOutputTokens += result.outputTokens;
    } catch (err) {
      errors.push({
        error: err instanceof Error ? err.message : "Unknown rewrite error",
        opportunityId: item.opportunityId,
      });
    }

    options?.onProgress?.(i + 1, items.length);

    // Rate limiting between calls
    if (i < items.length - 1 && delay > 0) {
      await new Promise((resolve) => setTimeout(resolve, delay));
    }
  }

  return { results, errors, totalInputTokens, totalOutputTokens };
}
