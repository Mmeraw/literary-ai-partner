import { DELETE, GET, POST } from "@/app/api/manuscripts/route";
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
        select: jest.fn(() => ({
          eq: jest.fn(() => ({
            eq: jest.fn(() => ({
              maybeSingle: async () => ({ data: null, error: null }),
            })),
          })),
        })),
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

  test("POST derives a meaningful title when upload title is blank", async () => {
    const maybeSingleMock = jest.fn(async () => ({
      data: null,
      error: null,
    }));

    const eqFileUrlMock = jest.fn(() => ({
      maybeSingle: maybeSingleMock,
    }));

    const eqUserMock = jest.fn(() => ({
      eq: eqFileUrlMock,
    }));

    const selectLookupMock = jest.fn(() => ({
      eq: eqUserMock,
    }));

    const singleMock = jest.fn(async () => ({
      data: {
        id: 322,
        title: "The opening sentence of the draft continues.",
        word_count: 7,
        file_size: 41,
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
      from: jest.fn((table: string) => {
        if (table !== "manuscripts") {
          throw new Error(`Unexpected table: ${table}`);
        }

        return {
          select: selectLookupMock,
          insert: insertMock,
        };
      }),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const form = new FormData();
    form.set("title", "Untitled Manuscript");
    form.set("english_variant", "us");
    form.set("file", new File(["The opening sentence of the draft continues."], "1766034761970.txt", { type: "text/plain" }));

    const req = new Request("https://localhost:3000/api/manuscripts", {
      method: "POST",
      body: form,
    });

    const response = await POST(req);
    const json = (await response.json()) as {
      ok: boolean;
      manuscript: { id: number; title: string };
    };

    expect(response.status).toBe(201);
    expect(json.ok).toBe(true);
    expect(json.manuscript.id).toBe(322);
    expect(json.manuscript.title).toBe("The opening sentence of the draft continues.");
    expect(insertMock).toHaveBeenCalledWith(
      expect.objectContaining({
        title: "The opening sentence of the draft continues.",
      }),
    );
  });

  test("POST creates a fresh manuscript row for repeated identical uploads", async () => {
    const singleMock = jest
      .fn()
      .mockResolvedValueOnce({
        data: {
          id: 401,
          title: "Repeated Snapshot",
          word_count: 4,
          file_size: 24,
          source: "upload",
          updated_at: "2026-05-04T00:00:00.000Z",
        },
        error: null,
      })
      .mockResolvedValueOnce({
        data: {
          id: 402,
          title: "Repeated Snapshot",
          word_count: 4,
          file_size: 24,
          source: "upload",
          updated_at: "2026-05-04T00:01:00.000Z",
        },
        error: null,
      });

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

    const buildRequest = () => {
      const form = new FormData();
      form.set("title", "Repeated Snapshot");
      form.set("english_variant", "us");
      form.set("file", new File(["Same words every time."], "snapshot.txt", { type: "text/plain" }));
      return new Request("https://localhost:3000/api/manuscripts", {
        method: "POST",
        body: form,
      });
    };

    const firstResponse = await POST(buildRequest());
    const secondResponse = await POST(buildRequest());

    expect(firstResponse.status).toBe(201);
    expect(secondResponse.status).toBe(201);
    expect(insertMock).toHaveBeenCalledTimes(2);
    expect(singleMock).toHaveBeenCalledTimes(2);
  });

  test("DELETE removes the authenticated user's manuscript by id", async () => {
    const selectMock = jest.fn(async () => ({
      data: [{ id: 321 }],
      error: null,
    }));

    const eqIdMock = jest.fn(() => ({
      select: selectMock,
    }));

    const eqUserMock = jest.fn(() => ({
      eq: eqIdMock,
    }));

    const deleteMock = jest.fn(() => ({
      eq: eqUserMock,
    }));

    const supabase = {
      from: jest.fn(() => ({
        delete: deleteMock,
      })),
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const req = new Request("https://localhost:3000/api/manuscripts?id=321", {
      method: "DELETE",
    });

    const response = await DELETE(req);
    const json = (await response.json()) as { ok: boolean; deleted: number };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.deleted).toBe(321);
    expect(supabase.from).toHaveBeenCalledWith("manuscripts");
    expect(deleteMock).toHaveBeenCalled();
    expect(eqUserMock).toHaveBeenCalledWith("user_id", "user-1");
    expect(eqIdMock).toHaveBeenCalledWith("id", 321);
  });
});
