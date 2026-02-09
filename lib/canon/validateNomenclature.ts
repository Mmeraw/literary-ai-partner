import canon from "./nomenclature_canon.v1.json";

type Domain = "evaluationCriteria" | "mdmCriteria" | "wave";

type CanonMap = Record<string, { aliases_invalid?: string[] }>;

function escapeRegExp(value: string): string {
  return value.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function isCanonicalWaveIdentifier(key: string): boolean {
  if (canon.wave.tiers.includes(key)) return true;
  if (canon.wave.ids.includes(key)) return true;

  if (canon.wave.item_pattern) {
    const itemPattern = new RegExp(canon.wave.item_pattern);
    if (itemPattern.test(key)) return true;
  }

  if (canon.wave.test_case_pattern) {
    const testPattern = new RegExp(canon.wave.test_case_pattern);
    if (testPattern.test(key)) return true;
  }

  return false;
}

export function assertCanonical(domain: Domain, key: string): void {
  if (domain === "wave") {
    if (!isCanonicalWaveIdentifier(key)) {
      throw new Error(`Non-canonical WAVE identifier: ${key}`);
    }
    return;
  }

  const domainMap = (canon as unknown as Record<string, CanonMap>)[domain];
  if (!domainMap || !domainMap[key]) {
    throw new Error(`Non-canonical ${domain} key: ${key}`);
  }
}

export function assertNoInvalidAliases(domain: Exclude<Domain, "wave">, key: string): void {
  const domainMap = (canon as unknown as Record<string, CanonMap>)[domain];
  if (!domainMap) return;

  for (const canonicalKey of Object.keys(domainMap)) {
    const aliases = domainMap[canonicalKey]?.aliases_invalid || [];
    if (aliases.includes(key)) {
      throw new Error(`Invalid alias used as key: ${key} (use ${canonicalKey})`);
    }
  }
}
