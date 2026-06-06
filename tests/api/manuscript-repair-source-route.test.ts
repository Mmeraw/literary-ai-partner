import { POST } from "@/app/api/manuscripts/[manuscriptId]/repair-source/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createInitialVersion } from "@/lib/manuscripts/versions";

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock("@/lib/manuscripts/versions", () => ({
  createInitialVersion: jest.fn(),
}));

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockCreateInitialVersion = createInitialVersion as jest.MockedFunction<typeof createInitialVersion>;

describe("POST /api/manuscripts/[manuscriptId]/repair-source", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: "user-1" } as never);
    mockCreateInitialVersion.mockResolvedValue({ id: "version-1" } as never);
  });

  test("repairs missing Version 1 using stored manuscript source text", async () => {
    const maybeSingleMock = jest.fn(async () => ({
      data: {
        id: 7477,
        user_id: "user-1",
        file_url: `data:text/plain;charset=utf-8,${encodeURIComponent("Chapter one opens with rain and thunder.")}`,
        word_count: 7,
      },
      error: null,
    }));

    const supabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: maybeSingleMock,
            })),
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const req = new Request("https://localhost:3000/api/manuscripts/7477/repair-source", {
      method: "POST",
    });

    const response = await POST(req, { params: { manuscriptId: "7477" } });
    const json = (await response.json()) as {
      ok: boolean;
      manuscript_id: number;
      manuscript_version_id: string;
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.manuscript_id).toBe(7477);
    expect(json.manuscript_version_id).toBe("version-1");
    expect(mockCreateInitialVersion).toHaveBeenCalledWith(
      expect.objectContaining({
        manuscript_id: 7477,
        created_by: "user-1",
      }),
    );
  });

  test("returns 422 when manuscript source payload is missing", async () => {
    const maybeSingleMock = jest.fn(async () => ({
      data: {
        id: 7477,
        user_id: "user-1",
        file_url: null,
        word_count: 0,
      },
      error: null,
    }));

    const supabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: maybeSingleMock,
            })),
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const req = new Request("https://localhost:3000/api/manuscripts/7477/repair-source", {
      method: "POST",
    });

    const response = await POST(req, { params: { manuscriptId: "7477" } });
    const json = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(422);
    expect(json.ok).toBe(false);
    expect(json.error).toBe("Source snapshot missing. Please repair before evaluating.");
    expect(mockCreateInitialVersion).not.toHaveBeenCalled();
  });
});
