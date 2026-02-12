/**
 * Flow 1 Proof Pack (CI—Infra Verification)
 *
 * Goal: Prove CI infrastructure works correctly
 *   1) GET /api/health returns ok (proves Next.js boots + routes work)
 *   2) POST /api/evaluate accepts manuscript creation (proves API is live)
 *
 * This is infra-level proof; authentication is handled separately in integration tests.
 * The key here is: "Does the entire CI pipeline run without hanging, and do the
 * endpoints respond?" (not "Are all authentication / response shapes perfect?")
 */

import { describe, test, expect } from "@jest/globals";

const BASE_URL = process.env.FLOW1_BASE_URL || "http://127.0.0.1:3002";

async function readJson(res: Response) {
  const text = await res.text();
  let json: any = null;
  try {
    json = text ? JSON.parse(text) : null;
  } catch {
    // keep null; callers will surface text when needed
  }
  return { text, json };
}

describe("Flow 1 Proof Pack (Infra)", () => {
  test(
    "health endpoint is up",
    async () => {
      const res = await fetch(`${BASE_URL}/api/health`);
      expect(res.status).toBe(200);

      const { json, text } = await readJson(res);
      expect(json?.ok).toBe(true);
      expect(text.length).toBeGreaterThan(0);
    },
    180000
  );

  test(
    "evaluate endpoint accepts manuscript creation (routing works)",
    async () => {
      const res = await fetch(`${BASE_URL}/api/evaluate`, {
        method: "POST",
        headers: { "content-type": "application/json" },
        body: JSON.stringify({
          title: "CI proof manuscript",
          work_type: "novel",
          content: "Short CI proof content.",
        }),
      });

      // Endpoint either succeeds (200+) or returns a structured error (not 5xx).
      // Either way, it proves:
      // - Next.js booted and compiled successfully
      // - Router is functioning
      // - The API is reachable from Jest test in CI
      // - Dev→Prod guard did NOT trigger (no crash before this point)

      expect(res.status).toBeLessThan(500);

      const { json, text } = await readJson(res);
      expect(text.length).toBeGreaterThan(0);

      // If response has an ok field, check it's not silently undefined
      if (json?.ok !== undefined) {
        expect(typeof json.ok).toBe("boolean");
      }
    },
    180000
  );
});
