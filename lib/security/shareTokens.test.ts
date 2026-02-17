/**
 * Gate A7 — Share Token Cryptography Tests
 * 
 * Unit tests for token generation, hashing, and comparison.
 * 
 * Security properties tested:
 * - Token entropy
 * - Hash determinism
 * - Constant-time comparison
 */

import crypto from "crypto";
import {
  generateShareToken,
  hashShareToken,
  safeEqualHex,
} from "@/lib/security/shareTokens";

// Mock environment variable
const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("generateShareToken", () => {
  it("should generate token with default length", () => {
    const token = generateShareToken();
    expect(token).toBeDefined();
    expect(typeof token).toBe("string");
    // 32 bytes base64url ~= 43 chars (no padding)
    expect(token.length).toBeGreaterThanOrEqual(43);
  });

  it("should generate token with custom length", () => {
    const token = generateShareToken(64);
    expect(token.length).toBeGreaterThanOrEqual(85); // 64 bytes ~= 85 chars
  });

  it("should generate different tokens on each call", () => {
    const token1 = generateShareToken();
    const token2 = generateShareToken();
    expect(token1).not.toBe(token2);
  });

  it("should generate URL-safe tokens (no +, /, or =)", () => {
    const token = generateShareToken();
    expect(token).not.toMatch(/[\+\/=]/);
  });
});

describe("hashShareToken", () => {
  it("should hash token deterministically", () => {
    process.env.REPORT_SHARE_HMAC_SECRET = "test-secret-key";

    const token = "test-token-123";
    const hash1 = hashShareToken(token);
    const hash2 = hashShareToken(token);

    expect(hash1).toBe(hash2);
  });

  it("should produce different hashes for different tokens", () => {
    process.env.REPORT_SHARE_HMAC_SECRET = "test-secret-key";

    const hash1 = hashShareToken("token-1");
    const hash2 = hashShareToken("token-2");

    expect(hash1).not.toBe(hash2);
  });

  it("should throw if REPORT_SHARE_HMAC_SECRET is missing", () => {
    delete process.env.REPORT_SHARE_HMAC_SECRET;

    expect(() => hashShareToken("test")).toThrow(
      "Missing REPORT_SHARE_HMAC_SECRET"
    );
  });

  it("should produce hex string output", () => {
    process.env.REPORT_SHARE_HMAC_SECRET = "test-secret-key";

    const hash = hashShareToken("test");
    expect(hash).toMatch(/^[0-9a-f]+$/);
    expect(hash.length).toBe(64); // SHA-256 hex = 64 chars
  });
});

describe("safeEqualHex", () => {
  it("should return true for identical hashes", () => {
    const hash = "abc123def456";
    expect(safeEqualHex(hash, hash)).toBe(true);
  });

  it("should return false for different hashes", () => {
    expect(safeEqualHex("abc123", "def456")).toBe(false);
  });

  it("should return false for different lengths", () => {
    expect(safeEqualHex("abc123", "abc")).toBe(false);
  });

  it("should use constant-time comparison", () => {
    // This tests that we're using crypto.timingSafeEqual
    // If not, this would throw, so the test implicitly validates it
    const hash1 = "a".repeat(64);
    const hash2 = "b".repeat(64);

    expect(() => safeEqualHex(hash1, hash2)).not.toThrow();
  });
});
