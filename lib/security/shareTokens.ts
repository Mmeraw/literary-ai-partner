/**
 * Gate A7 — Share Token Cryptography
 * 
 * Security design:
 * - Tokens are random, base64url-encoded
 * - Tokens are NEVER stored in plaintext
 * - Tokens are hashed with HMAC-SHA256 using server secret
 * - Comparison uses constant-time equality to prevent timing attacks
 */

import crypto from "crypto";

/**
 * Convert buffer to base64url (URL-safe base64 without padding)
 */
function base64url(buf: Buffer): string {
  return buf
    .toString("base64")
    .replace(/\+/g, "-")
    .replace(/\//g, "_")
    .replace(/=+$/g, "");
}

/**
 * Generate a share token (return plaintext token to caller; never store it).
 * 
 * @param bytes - Number of random bytes (default 32 = 256 bits)
 * @returns base64url-encoded token string
 */
export function generateShareToken(bytes = 32): string {
  return base64url(crypto.randomBytes(bytes));
}

/**
 * Hash a share token for storage.
 * 
 * Uses HMAC-SHA256 with a server secret to prevent offline token guessing.
 * Requires REPORT_SHARE_HMAC_SECRET environment variable.
 * 
 * @param token - plaintext share token
 * @returns hex-encoded hash
 * @throws if REPORT_SHARE_HMAC_SECRET is not set
 */
export function hashShareToken(token: string): string {
  const secret = process.env.REPORT_SHARE_HMAC_SECRET;
  if (!secret) {
    throw new Error("Missing REPORT_SHARE_HMAC_SECRET environment variable");
  }
  return crypto.createHmac("sha256", secret).update(token).digest("hex");
}

/**
 * Constant-time comparison of two hex strings.
 * 
 * Prevents timing attacks that could leak token information.
 * 
 * @param a - first hex string
 * @param b - second hex string
 * @returns true if equal, false otherwise
 */
export function safeEqualHex(a: string, b: string): boolean {
  if (a.length !== b.length) return false;
  
  const ba = Buffer.from(a, "hex");
  const bb = Buffer.from(b, "hex");
  
  if (ba.length !== bb.length) return false;
  
  return crypto.timingSafeEqual(ba, bb);
}
