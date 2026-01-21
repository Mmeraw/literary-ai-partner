const DEFAULT_PORTS = [3002, 3001, 3000];

async function detectBaseUrl() {
  if (process.env.BASE_URL) {
    return process.env.BASE_URL.replace(/\/+$/, "");
  }

  for (const port of DEFAULT_PORTS) {
    const base = `http://localhost:${port}`;
    try {
      const res = await fetch(`${base}/api/health`);
      if (res.ok) {
        console.log(`[BaseDetect] Using ${base}`);
        return base;
      }
    } catch {
      // try next
    }
  }

  const fallback = "http://localhost:3000";
  console.warn(`[BaseDetect] Falling back to ${fallback}`);
  return fallback;
}

let cachedBase = null;

export async function getBaseUrl() {
  if (cachedBase) return cachedBase;
  cachedBase = await detectBaseUrl();
  return cachedBase;
}
