import fs from "node:fs";
import path from "node:path";

export type TimeoutSettingName = "EVAL_OPENAI_TIMEOUT_MS" | "EVAL_PASS_TIMEOUT_MS";

export type TimeoutResolutionReason =
  | "explicit_env"
  | "file_baseline"
  | "default_fallback"
  | "malformed_env_fallback"
  | "clamped_to_min"
  | "clamped_to_max"
  | "conflicting_env_override";

export interface TimeoutBaselineEntry {
  raw: string;
  source: string;
}

export type TimeoutBaseline = Partial<Record<TimeoutSettingName, TimeoutBaselineEntry>>;

export interface ResolvedTimeoutSetting {
  name: TimeoutSettingName;
  raw: string | undefined;
  valueMs: number;
  reason: TimeoutResolutionReason;
  conflict?: TimeoutBaselineEntry;
}

export interface EvaluationTimeoutConfig {
  openAiTimeout: ResolvedTimeoutSetting;
  passTimeout: ResolvedTimeoutSetting;
}

export type EnvLike = Readonly<Record<string, string | undefined>>;

type TimeoutSpec = {
  defaultMs: number;
  minMs: number;
  maxMs: number;
};

const TIMEOUT_SPECS: Record<TimeoutSettingName, TimeoutSpec> = {
  EVAL_OPENAI_TIMEOUT_MS: {
    defaultMs: 720_000,
    minMs: 1_000,
    maxMs: 800_000,
  },
  EVAL_PASS_TIMEOUT_MS: {
    defaultMs: 720_000,
    minMs: 10_000,
    maxMs: 800_000,
  },
};

let cachedLocalTimeoutBaseline: TimeoutBaseline | undefined;

function parseDotenv(src: string | Buffer): Record<string, string> {
  const parsed: Record<string, string> = {};
  const content = src.toString();

  for (const rawLine of content.split(/\r?\n/u)) {
    const line = rawLine.trim();

    if (line === "" || line.startsWith("#")) {
      continue;
    }

    const match = line.match(/^(?:export\s+)?([A-Za-z_][A-Za-z0-9_]*)\s*=\s*(.*)$/u);
    if (!match) {
      continue;
    }

    const [, key, rawValue] = match;
    let value = rawValue.trim();

    if (
      (value.startsWith('"') && value.endsWith('"')) ||
      (value.startsWith("'") && value.endsWith("'"))
    ) {
      value = value.slice(1, -1);
    } else {
      value = value.replace(/\s+#.*$/u, "").trim();
    }

    parsed[key] = value;
  }

  return parsed;
}

function parseStrictInteger(raw: string): number | undefined {
  const trimmed = raw.trim();
  if (!/^[-]?\d+$/.test(trimmed)) {
    return undefined;
  }

  const parsed = Number.parseInt(trimmed, 10);
  return Number.isFinite(parsed) ? parsed : undefined;
}

function resolveParsedTimeout(
  name: TimeoutSettingName,
  raw: string | undefined,
): Pick<ResolvedTimeoutSetting, "valueMs" | "reason"> {
  const spec = TIMEOUT_SPECS[name];

  if (raw === undefined) {
    return {
      valueMs: spec.defaultMs,
      reason: "default_fallback",
    };
  }

  const parsed = parseStrictInteger(raw);
  if (parsed === undefined) {
    return {
      valueMs: spec.defaultMs,
      reason: "malformed_env_fallback",
    };
  }

  if (parsed < spec.minMs) {
    return {
      valueMs: spec.minMs,
      reason: "clamped_to_min",
    };
  }

  if (parsed > spec.maxMs) {
    return {
      valueMs: spec.maxMs,
      reason: "clamped_to_max",
    };
  }

  return {
    valueMs: parsed,
    reason: "explicit_env",
  };
}

export function readLocalTimeoutBaseline(cwd = process.cwd()): TimeoutBaseline {
  if (cachedLocalTimeoutBaseline) {
    return cachedLocalTimeoutBaseline;
  }

  const baseline: TimeoutBaseline = {};
  for (const fileName of [".env", ".env.local"]) {
    const filePath = path.join(cwd, fileName);
    if (!fs.existsSync(filePath)) {
      continue;
    }

    const parsed = parseDotenv(fs.readFileSync(filePath, "utf8"));
    for (const name of Object.keys(TIMEOUT_SPECS) as TimeoutSettingName[]) {
      const raw = parsed[name];
      if (typeof raw === "string") {
        baseline[name] = {
          raw,
          source: fileName,
        };
      }
    }
  }

  cachedLocalTimeoutBaseline = baseline;
  return baseline;
}

function resolveTimeoutSetting(
  name: TimeoutSettingName,
  env: EnvLike,
  baseline?: TimeoutBaselineEntry,
): ResolvedTimeoutSetting {
  const raw = env[name];

  const trimmed = raw?.trim();
  if (baseline && (trimmed === undefined || trimmed === "")) {
    const resolvedBaseline = resolveParsedTimeout(name, baseline.raw);
    return {
      name,
      raw: baseline.raw,
      valueMs: resolvedBaseline.valueMs,
      reason: "file_baseline",
      conflict: baseline,
    };
  }

  if (baseline && trimmed !== baseline.raw.trim()) {
    const resolvedBaseline = resolveParsedTimeout(name, baseline.raw);
    return {
      name,
      raw,
      valueMs: resolvedBaseline.valueMs,
      reason: "conflicting_env_override",
      conflict: baseline,
    };
  }

  const resolved = resolveParsedTimeout(name, raw);

  return {
    name,
    raw,
    valueMs: resolved.valueMs,
    reason: resolved.reason,
  };
}

export function resolveEvaluationTimeoutConfig(
  env: EnvLike = process.env,
  baseline: TimeoutBaseline = readLocalTimeoutBaseline(),
): EvaluationTimeoutConfig {
  return {
    openAiTimeout: resolveTimeoutSetting(
      "EVAL_OPENAI_TIMEOUT_MS",
      env,
      baseline.EVAL_OPENAI_TIMEOUT_MS,
    ),
    passTimeout: resolveTimeoutSetting(
      "EVAL_PASS_TIMEOUT_MS",
      env,
      baseline.EVAL_PASS_TIMEOUT_MS,
    ),
  };
}

function formatSingleTimeoutResolution(setting: ResolvedTimeoutSetting): string {
  const parts = [`${setting.name}=${setting.reason}(${setting.valueMs})`];

  if (setting.reason === "file_baseline" && setting.conflict) {
    parts.push(`source=${setting.conflict.source}`);
    parts.push(`raw=${JSON.stringify(setting.conflict.raw)}`);
  }

  if (setting.reason === "malformed_env_fallback" && setting.raw !== undefined) {
    parts.push(`raw=${JSON.stringify(setting.raw)}`);
  }

  if ((setting.reason === "clamped_to_min" || setting.reason === "clamped_to_max") && setting.raw !== undefined) {
    parts.push(`raw=${JSON.stringify(setting.raw)}`);
  }

  if (setting.reason === "conflicting_env_override" && setting.conflict) {
    parts.push(`ignored_shell=${JSON.stringify(setting.raw)}`);
    parts.push(`using=${setting.conflict.source}(${JSON.stringify(setting.conflict.raw)})`);
  }

  return parts.join(" ");
}

export function formatTimeoutResolutionSummary(config: EvaluationTimeoutConfig): string {
  return [
    formatSingleTimeoutResolution(config.openAiTimeout),
    formatSingleTimeoutResolution(config.passTimeout),
  ].join(", ");
}

export function getEvalPassTimeoutMs(env: EnvLike = process.env): number {
  return resolveEvaluationTimeoutConfig(env).passTimeout.valueMs;
}

export function getEvalOpenAiTimeoutMs(env: EnvLike = process.env): number {
  return resolveEvaluationTimeoutConfig(env).openAiTimeout.valueMs;
}

export function assertEvalTimeoutConfig(
  env: EnvLike = process.env,
  baseline: TimeoutBaseline = readLocalTimeoutBaseline(),
): void {
  const config = resolveEvaluationTimeoutConfig(env, baseline);

  if (config.openAiTimeout.valueMs < config.passTimeout.valueMs) {
    throw new Error(
      `[CONFIG_ERROR] EVAL_OPENAI_TIMEOUT_MS (${config.openAiTimeout.valueMs}, reason=${config.openAiTimeout.reason}) must be >= EVAL_PASS_TIMEOUT_MS (${config.passTimeout.valueMs}, reason=${config.passTimeout.reason}). ${formatTimeoutResolutionSummary(config)}`,
    );
  }
}