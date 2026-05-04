import { GET, POST } from "@/app/api/manuscripts/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  getAuthenticatedUser: jest.fn(),
}));

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;

describe("/api/manuscripts route", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: "user-1" } as never);
  });

  test("GET lists dashboard manuscripts for the authenticated user", async () => {
    const limitMock = jest.fn(async () => ({
      data: [
        {
          id: 100,
          title: "Let the River Decide",
          word_count: 85611,
          file_size: 612300,
          source: "upload",
          updated_at: "2026-05-04T00:00:00.000Z",
        },
      ],
      error: null,
    }));

    const orderMock = jest.fn(() => ({
      limit: limitMock,
    }));

    const supabase = {
      from: jest.fn(() => ({
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            order: orderMock,
          })),
        })),
      })),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const response = await GET();
    const json = (await response.json()) as { ok: boolean; manuscripts: Array<{ id: number }> };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.manuscripts).toHaveLength(1);
    expect(json.manuscripts[0]?.id).toBe(100);
    expect(orderMock).toHaveBeenCalledWith("updated_at", { ascending: false });
    expect(limitMock).toHaveBeenCalledWith(50);
  });

  test("POST uploads txt manuscript and creates manuscript row", async () => {
    const singleMock = jest.fn(async () => ({
      data: {
        id: 321,
        title: "Let_the_River_Decide",
        word_count: 4,
        file_size: 24,
        source: "upload",
        updated_at: "2026-05-04T00:00:00.000Z",
      },
      error: null,
    }));

    const insertMock = jest.fn(() => ({
      select: jest.fn(() => ({
        single: singleMock,
      })),
    }));

    const supabase = {
      from: jest.fn(() => ({
        insert: insertMock,
      })),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const form = new FormData();
    form.set("title", "Let_the_River_Decide");
    form.set("english_variant", "us");
    form.set("file", new File(["One two three four"], "river.txt", { type: "text/plain" }));

    const req = new Request("https://localhost:3000/api/manuscripts", {
      method: "POST",
      body: form,
    });

    const response = await POST(req);
    const json = (await response.json()) as {
      ok: boolean;
      manuscript: { id: number; source: string };
    };

    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.manuscript.id).toBe(321);
    expect(json.manuscript.source).toBe("upload");

    expect(supabase.from).toHaveBeenCalledWith("manuscripts");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        source: "upload",
        user_id: "user-1",
      }),
    );
  });
});
