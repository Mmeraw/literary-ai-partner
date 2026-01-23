// LLM client interface and stub implementation for Phase 1 evaluation

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
    const score = ((wordCount + charCount) % 10) + 1;
    
    // Extract first sentence for summary
    const firstSentence = text.split(/[.!?]/)[0]?.trim() || "No content";

    const resultJson = {
      jobId,
      chunkId,
      phase,
      score,
      wordCount,
      charCount,
      keyIssues: [
        `Stub issue 1: Consider pacing (score: ${score}/10)`,
        `Stub issue 2: Character development opportunity detected`,
      ],
      summary: `Analyzed ${wordCount} words. Opening: "${firstSentence.substring(0, 50)}${firstSentence.length > 50 ? '...' : ''}"`,
      timestamp: new Date().toISOString(),
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
