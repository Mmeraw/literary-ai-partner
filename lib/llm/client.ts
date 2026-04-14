// LLM client interface and stub implementation for Phase 1 evaluation
import { CRITERIA_KEYS } from "@/schemas/criteria-keys";

export interface LlmClient {
  evaluateChunk(input: {
    chunkId: string;
    text: string;
    jobId: string;
    phase: number;
  }): Promise<{ resultJson: unknown; rawText: string }>;
}

/**
 * Stub LLM client with realistic latency and deterministic outputs.
 * Use for development and testing before wiring real OpenAI/Anthropic.
 */
export class StubLlmClient implements LlmClient {
  constructor(
    private options: { minMs?: number; maxMs?: number; failureRate?: number } = {}
  ) {}

  private async simulateLatency() {
    const min = this.options.minMs ?? 500;
    const max = this.options.maxMs ?? 2000;
    const delay = Math.floor(Math.random() * (max - min + 1)) + min;
    await new Promise((resolve) => setTimeout(resolve, delay));
  }

  async evaluateChunk({ chunkId, text, jobId, phase }: {
    chunkId: string;
    text: string;
    jobId: string;
    phase: number;
  }) {
    await this.simulateLatency();

    // Simulate occasional failures (1 in 20 by default)
    const failureRate = this.options.failureRate ?? 0.05;
    if (Math.random() < failureRate) {
      throw new Error(`Simulated LLM failure for chunk ${chunkId}`);
    }

    // Deterministic "analysis" based on text content
    const wordCount = text.split(/\s+/).filter(Boolean).length;
    const charCount = text.length;

    // Extract a short anchor snippet directly from the chunk text (EG-6 compliance)
    const words = text.split(/\s+/).filter(Boolean);
    const anchorSnippet = words.slice(0, 12).join(" ") || "No content provided";

    // Derive a base score (5–9) deterministically so all structural criteria pass EG-9 (min 4)
    const baseScore = ((wordCount + charCount) % 5) + 5;

    // Canonical schema-layer keys from single source of truth.
    const criteria = CRITERIA_KEYS.map((key, idx) => {
      const score_0_10 = ((baseScore + idx) % 5) + 5; // 5–9, always >= 4
      return {
        key,
        score_0_10,
        evidence: [
          {
            anchor_snippet: anchorSnippet,
            location_hint: `chunk:${chunkId}`,
          },
        ],
        mechanism: `Stub analysis for ${key}: text exhibits ${wordCount} words with measurable structural density.`,
        effect: `Narrative impact assessed at score ${score_0_10}/10 based on lexical composition.`,
        false_positive_check: `Verified stub criterion ${key} against chunk ${chunkId}; no fabricated content.`,
      };
    });

    const resultJson = {
      jobId,
      chunkId,
      phase,
      wordCount,
      charCount,
      timestamp: new Date().toISOString(),
      criteria,
    };

    return {
      resultJson,
      rawText: JSON.stringify(resultJson, null, 2),
    };
  }
}

/**
 * Factory function to get the appropriate LLM client based on environment.
 * In production, replace StubLlmClient with real OpenAI/Anthropic client.
 */
export function createLlmClient(): LlmClient {
  const useRealLlm = process.env.USE_REAL_LLM === 'true';
  
  if (useRealLlm) {
    // TODO: Replace with real LLM client when ready
    // return new OpenAiLlmClient({ apiKey: process.env.OPENAI_API_KEY });
    throw new Error('Real LLM client not yet implemented. Set USE_REAL_LLM=false.');
  }

  return new StubLlmClient({
    minMs: 500,
    maxMs: 2000,
    failureRate: 0.05, // 5% failure rate for testing partial completion
  });
}
