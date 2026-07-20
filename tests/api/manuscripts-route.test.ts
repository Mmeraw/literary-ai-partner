import { DELETE, GET, POST } from "@/app/api/manuscripts/route";
import { createAdminClient } from "@/lib/supabase/admin";
import { getAuthenticatedUser } from "@/lib/supabase/server";
import { createInitialVersion } from "@/lib/manuscripts/versions";

const mockExtractRawText = jest.fn(async (_args?: unknown) => ({ value: "" }));

jest.mock("mammoth", () => ({
  extractRawText: (args: unknown) => mockExtractRawText(args),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

jest.mock("@/lib/supabase/server", () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock("@/lib/manuscripts/versions", () => ({
  createInitialVersion: jest.fn(async () => ({ id: "version-1" })),
}));

const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;
const mockGetAuthenticatedUser = getAuthenticatedUser as jest.MockedFunction<typeof getAuthenticatedUser>;
const mockCreateInitialVersion = createInitialVersion as jest.MockedFunction<typeof createInitialVersion>;

describe("/api/manuscripts route", () => {
  jest.setTimeout(20_000);

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue({ id: "user-1" } as never);
    mockCreateInitialVersion.mockResolvedValue({ id: "version-1" } as never);
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

  test("POST uploads docx manuscript and extracts text", async () => {
    mockExtractRawText.mockResolvedValueOnce({ value: "Docx words from manuscript" });

    const singleMock = jest.fn(async () => ({
      data: {
        id: 323,
        title: "River Draft",
        word_count: 4,
        file_size: 88,
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
    form.set("title", "River Draft");
    form.set("english_variant", "us");
    form.set(
      "file",
      new File(["fake-docx-bytes"], "river.docx", {
        type: "application/vnd.openxmlformats-officedocument.wordprocessingml.document",
      }),
    );

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
    expect(json.manuscript.id).toBe(323);
    expect(json.manuscript.source).toBe("upload");
    expect(mockExtractRawText).toHaveBeenCalledTimes(1);
  });

  test("POST rejects non-multipart upload requests", async () => {
    const req = new Request("https://localhost:3000/api/manuscripts", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
      },
      body: JSON.stringify({ file: "not-a-file" }),
    });

    const response = await POST(req);
    const json = (await response.json()) as { ok: boolean; error: string };

    expect(response.status).toBe(415);
    expect(json.ok).toBe(false);
    expect(json.error).toMatch(/Invalid upload request/i);
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

  test("DELETE removes the authenticated user's manuscript by id and storage object", async () => {
    const fileUrl = "https://example.supabase.co/storage/v1/object/public/manuscripts/user-1/321.docx";

    const rpcMock = jest.fn(async () => ({
      data: [{ deleted_ids: [321], already_absent_ids: [], deleted_count: 1, counts: {} }],
      error: null,
    }));

    const inMock = jest.fn(async () => ({
      data: [{ id: 321, file_url: fileUrl }],
      error: null,
    }));

    const eqUserMock = jest.fn(() => ({
      in: inMock,
    }));

    const selectMock = jest.fn(() => ({
      eq: eqUserMock,
    }));

    const insertQueueMock = jest.fn(async () => ({ data: null, error: null }));
    const removeMock = jest.fn(async () => ({ data: [{ name: "user-1/321.docx", metadata: { httpStatusCode: 200 } }], error: null }));
    const fromStorageMock = jest.fn(() => ({ remove: removeMock }));

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "manuscripts") {
          return { select: selectMock };
        }
        if (table === "manuscript_storage_cleanup_queue") {
          return { insert: insertQueueMock };
        }
        return {};
      }),
      rpc: rpcMock,
      storage: {
        from: fromStorageMock,
      },
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const req = new Request("https://localhost:3000/api/manuscripts?id=321", {
      method: "DELETE",
    });

    const response = await DELETE(req);
    const json = (await response.json()) as {
      ok: boolean;
      deleted: number[];
      storageCleanup: { removed: string[]; failed: unknown[] };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.deleted).toEqual([321]);
    expect(json.storageCleanup.removed).toContain("manuscripts/user-1/321.docx");
    expect(json.storageCleanup.failed).toHaveLength(0);
    expect(supabase.from).toHaveBeenCalledWith("manuscripts");
    expect(selectMock).toHaveBeenCalledWith("id,file_url");
    expect(rpcMock).toHaveBeenCalledWith("delete_manuscripts_permanently", {
      p_user_id: "user-1",
      p_manuscript_ids: [321],
    });
    expect(fromStorageMock).toHaveBeenCalledWith("manuscripts");
    expect(removeMock).toHaveBeenCalledWith(["user-1/321.docx"]);
    expect(insertQueueMock).not.toHaveBeenCalled();
  });

  test("DELETE reports storage cleanup failures and persists them for retry", async () => {
    const fileUrl = "https://example.supabase.co/storage/v1/object/public/manuscripts/user-1/321.docx";

    const rpcMock = jest.fn(async () => ({
      data: [{ deleted_ids: [321], already_absent_ids: [], deleted_count: 1, counts: {} }],
      error: null,
    }));

    const inMock = jest.fn(async () => ({
      data: [{ id: 321, file_url: fileUrl }],
      error: null,
    }));

    const eqUserMock = jest.fn(() => ({
      in: inMock,
    }));

    const selectMock = jest.fn(() => ({
      eq: eqUserMock,
    }));

    const insertQueueMock = jest.fn(async () => ({ data: null, error: null }));
    const removeError = new Error("storage remove failed");
    const removeMock = jest.fn(async () => ({ data: null, error: removeError }));
    const fromStorageMock = jest.fn(() => ({ remove: removeMock }));

    const supabase = {
      from: jest.fn((table: string) => {
        if (table === "manuscripts") {
          return { select: selectMock };
        }
        if (table === "manuscript_storage_cleanup_queue") {
          return { insert: insertQueueMock };
        }
        return {};
      }),
      rpc: rpcMock,
      storage: {
        from: fromStorageMock,
      },
    };

    mockCreateAdminClient.mockReturnValue(supabase as never);

    const req = new Request("https://localhost:3000/api/manuscripts?id=321", {
      method: "DELETE",
    });

    const response = await DELETE(req);
    const json = (await response.json()) as {
      ok: boolean;
      deleted: number[];
      storageCleanup: { removed: string[]; failed: { bucket: string; path: string; error: string }[] };
    };

    expect(response.status).toBe(200);
    expect(json.ok).toBe(true);
    expect(json.storageCleanup.removed).toHaveLength(0);
    expect(json.storageCleanup.failed).toHaveLength(1);
    expect(json.storageCleanup.failed[0]?.bucket).toBe("manuscripts");
    expect(json.storageCleanup.failed[0]?.path).toBe("user-1/321.docx");

    expect(insertQueueMock).toHaveBeenCalledWith({
      manuscript_id: 321,
      user_id: "user-1",
      bucket: "manuscripts",
      path: "user-1/321.docx",
      status: "pending",
      last_error: "storage remove failed",
    });
  });
});
