/**
 * Gate A7 — Report Share Server Logic Tests
 * 
 * Tests for server-side share token validation.
 * 
 * Coverage:
 * - Valid share lookup
 * - Revoked share denial
 * - Expired share denial
 * - Missing share denial
 */

import { lookupShareByToken } from "@/lib/reportShares/server";
import { hashShareToken } from "@/lib/security/shareTokens";

// Mock dependencies
jest.mock("@/lib/supabase/admin");
jest.mock("@/lib/security/shareTokens");

const mockHashShareToken = hashShareToken as jest.Mock;
const mockCreateAdminClient = require("@/lib/supabase/admin")
  .createAdminClient as jest.Mock;

const ORIGINAL_ENV = process.env;

beforeEach(() => {
  jest.resetModules();
  process.env = { ...ORIGINAL_ENV };
  jest.clearAllMocks();
});

afterAll(() => {
  process.env = ORIGINAL_ENV;
});

describe("lookupShareByToken", () => {
  it("should return success for valid share", async () => {
    const mockToken = "test-token-xyz";
    const mockTokenHash = "hashed-token-xyz";
    const mockJobId = "job-123";
    const mockShareId = "share-456";

    mockHashShareToken.mockReturnValue(mockTokenHash);

    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({
                data: {
                  id: mockShareId,
                  job_id: mockJobId,
                  artifact_type: "evaluation_result_v1",
                  revoked_at: null,
                  expires_at: null,
                },
                error: null,
              })
            ),
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(mockSupabase);

    const result = await lookupShareByToken(mockToken);

    expect(result).toEqual({
      ok: true,
      shareId: mockShareId,
      jobId: mockJobId,
      artifactType: "evaluation_result_v1",
    });

    expect(mockHashShareToken).toHaveBeenCalledWith(mockToken);
  });

  it("should return failure for revoked share", async () => {
    const mockToken = "test-token-revoked";
    const mockTokenHash = "hashed-token-revoked";

    mockHashShareToken.mockReturnValue(mockTokenHash);

    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({
                data: {
                  id: "share-123",
                  job_id: "job-123",
                  artifact_type: "evaluation_result_v1",
                  revoked_at: new Date().toISOString(),
                  expires_at: null,
                },
                error: null,
              })
            ),
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(mockSupabase);

    const result = await lookupShareByToken(mockToken);

    expect(result).toEqual({ ok: false });
  });

  it("should return failure for expired share", async () => {
    const mockToken = "test-token-expired";
    const mockTokenHash = "hashed-token-expired";

    mockHashShareToken.mockReturnValue(mockTokenHash);

    const pastDate = new Date(Date.now() - 24 * 60 * 60 * 1000).toISOString();

    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({
                data: {
                  id: "share-123",
                  job_id: "job-123",
                  artifact_type: "evaluation_result_v1",
                  revoked_at: null,
                  expires_at: pastDate,
                },
                error: null,
              })
            ),
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(mockSupabase);

    const result = await lookupShareByToken(mockToken);

    expect(result).toEqual({ ok: false });
  });

  it("should return failure for missing share", async () => {
    const mockToken = "test-token-missing";
    const mockTokenHash = "hashed-token-missing";

    mockHashShareToken.mockReturnValue(mockTokenHash);

    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: null,
              })
            ),
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(mockSupabase);

    const result = await lookupShareByToken(mockToken);

    expect(result).toEqual({ ok: false });
  });

  it("should return failure on database error", async () => {
    const mockToken = "test-token-error";
    const mockTokenHash = "hashed-token-error";

    mockHashShareToken.mockReturnValue(mockTokenHash);

    const mockSupabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            maybeSingle: jest.fn(() =>
              Promise.resolve({
                data: null,
                error: { message: "Database error" },
              })
            ),
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(mockSupabase);

    const result = await lookupShareByToken(mockToken);

    expect(result).toEqual({ ok: false });
  });
});
