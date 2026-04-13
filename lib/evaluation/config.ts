export function getEvalPassTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.EVAL_PASS_TIMEOUT_MS || "180000", 10);
  return Number.isFinite(parsed) && parsed >= 10_000 && parsed <= 180_000 ? parsed : 180_000;
}

export function getEvalOpenAiTimeoutMs(): number {
  const parsed = Number.parseInt(process.env.EVAL_OPENAI_TIMEOUT_MS || "180000", 10);
  return Number.isFinite(parsed) && parsed >= 1_000 && parsed <= 180_000 ? parsed : 180_000;
}

export function assertEvalTimeoutConfig(): void {
  const passTimeoutMs = getEvalPassTimeoutMs();
  const openAiTimeoutMs = getEvalOpenAiTimeoutMs();

  if (openAiTimeoutMs < passTimeoutMs) {
    throw new Error(
      `[CONFIG_ERROR] EVAL_OPENAI_TIMEOUT_MS (${openAiTimeoutMs}) must be >= EVAL_PASS_TIMEOUT_MS (${passTimeoutMs})`,
    );
  }
}
