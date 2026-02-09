import { scanForForbiddenContent } from "./events";
import { sampleEvents } from "./sampleEvents";

const FORBIDDEN_KEYS: RegExp[] = [
  /api[_-]?key/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /authorization/i,
  /auth_token/i,
  /access_token/i,
  /refresh_token/i,
  /supabase_db_url_ci/i,
  /database_url/i,
];

const FORBIDDEN_VALUE_PATTERNS: RegExp[] = [/postgresql:\/\//i, /postgres:\/\//i];

describe("observability payload forbidden keys", () => {
  it("allows safe payloads", () => {
    sampleEvents.forEach((event) => {
      expect(() => scanForForbiddenContent(event.payload)).not.toThrow();

      const serialized = JSON.stringify(event.payload);
      for (const rx of [...FORBIDDEN_KEYS, ...FORBIDDEN_VALUE_PATTERNS]) {
        expect(serialized).not.toMatch(rx);
      }
    });
  });

  it("rejects forbidden keys and values", () => {
    const payload = {
      message: "bad payload",
      api_key: "sk-should-not-appear",
      nested: {
        connection: "postgresql://user:pass@host:5432/db",
      },
    };

    expect(() => scanForForbiddenContent(payload)).toThrow(
      /Forbidden key|Forbidden value/,
    );
  });
});
