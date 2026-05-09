/**
 * Unit tests for upsertChunks() — atomic-RPC contract.
 *
 * These tests assert the TS wrapper now delegates the read-then-write logic
 * to the Postgres RPC `upsert_manuscript_chunks` and that orphan-deletion
 * runs AFTER the upsert (never before — see issue #378 for why).
 *
 * Race-safety and bit-for-bit semantics of the RPC itself are validated by
 * the SQL smoke test in supabase/migrations/tests/.
 */

const createClientMock = jest.fn();

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: any[]) => createClientMock(...args),
}));

// chunks.ts uses getSupabaseAdminClient from @/lib/supabase, which calls
// @supabase/supabase-js#createClient internally. Mocking createClient is the
// cleanest seam — it covers both admin client and anon client without us
// having to thread credentials.
beforeEach(() => {
  process.env.NEXT_PUBLIC_SUPABASE_URL = "http://stub.supabase.test";
  process.env.SUPABASE_SERVICE_ROLE_KEY = "stub-service-role-key";
  process.env.SUPABASE_PROJECT_REF = "stub";
  process.env.NODE_ENV = "test";
  jest.resetModules();
  createClientMock.mockReset();
});

type RpcCall = { fn: string; params: any };

/**
 * Build a minimal mock supabase client that captures rpc() calls and the
 * sequence of from() interactions, so tests can assert ORDER of operations.
 */
function makeStubClient(opts: {
  /** Rows returned by getManuscriptChunks() AFTER the upsert (post-state). */
  postUpsertRows?: Array<{ id: string; chunk_index: number }>;
  /** Force the rpc() call to resolve with an error. */
  rpcError?: { message: string } | null;
  /** Force the .delete().in() chain to resolve with an error. */
  deleteError?: { message: string } | null;
}) {
  const events: string[] = [];
  const rpcCalls: RpcCall[] = [];
  const deletedIdSets: any[][] = [];

  const rpc = jest.fn(async (fn: string, params: any) => {
    events.push(`rpc:${fn}`);
    rpcCalls.push({ fn, params });
    return { data: null, error: opts.rpcError ?? null };
  });

  const from = jest.fn((table: string) => {
    if (table !== "manuscript_chunks") {
      throw new Error(`Unexpected table: ${table}`);
    }
    return {
      // SELECT path: getManuscriptChunks() — chunks.ts uses .select("*").eq("manuscript_id", X).order(...)
      select: (_cols: string) => ({
        eq: (_col: string, _val: any) => ({
          order: (_oCol: string, _oOpts: any) => {
            events.push("select");
            return Promise.resolve({
              data: opts.postUpsertRows ?? [],
              error: null,
            });
          },
        }),
      }),
      // DELETE path: orphan removal — .delete().in("id", [...])
      delete: () => ({
        in: (_col: string, ids: any[]) => {
          events.push("delete");
          deletedIdSets.push(ids);
          return Promise.resolve({ error: opts.deleteError ?? null });
        },
      }),
    };
  });

  const client = { rpc, from };
  return { client, events, rpcCalls, deletedIdSets };
}

function makeChunkSpec(idx: number, hash: string, content = `chunk-${idx}`) {
  return {
    chunk_index: idx,
    char_start: idx * 100,
    char_end: idx * 100 + 100,
    overlap_chars: 0,
    label: null,
    content,
    content_hash: hash,
  };
}

describe("upsertChunks (atomic RPC)", () => {
  it("calls upsert_manuscript_chunks RPC with a correctly-shaped payload", async () => {
    const { client, rpcCalls } = makeStubClient({ postUpsertRows: [
      { id: "row-0", chunk_index: 0 },
      { id: "row-1", chunk_index: 1 },
    ]});
    createClientMock.mockReturnValue(client);

    const { upsertChunks } = await import("@/lib/manuscripts/chunks");
    const jobId = "11111111-1111-1111-1111-111111111111";

    await upsertChunks(42, [makeChunkSpec(0, "h0"), makeChunkSpec(1, "h1")], jobId);

    expect(rpcCalls).toHaveLength(1);
    expect(rpcCalls[0].fn).toBe("upsert_manuscript_chunks");
    expect(rpcCalls[0].params).toEqual({
      p_chunks: [
        {
          manuscript_id: 42,
          chunk_index: 0,
          char_start: 0,
          char_end: 100,
          overlap_chars: 0,
          label: null,
          content: "chunk-0",
          content_hash: "h0",
          job_id: jobId,
        },
        {
          manuscript_id: 42,
          chunk_index: 1,
          char_start: 100,
          char_end: 200,
          overlap_chars: 0,
          label: null,
          content: "chunk-1",
          content_hash: "h1",
          job_id: jobId,
        },
      ],
    });
  });

  it("translates undefined jobId to null in the payload", async () => {
    const { client, rpcCalls } = makeStubClient({ postUpsertRows: [{ id: "row-0", chunk_index: 0 }] });
    createClientMock.mockReturnValue(client);

    const { upsertChunks } = await import("@/lib/manuscripts/chunks");
    await upsertChunks(7, [makeChunkSpec(0, "h0")]);

    expect(rpcCalls[0].params.p_chunks[0].job_id).toBeNull();
  });

  it("throws a clear error when the RPC fails (no orphan-delete attempted)", async () => {
    const { client, events } = makeStubClient({
      rpcError: { message: "boom" },
    });
    createClientMock.mockReturnValue(client);

    const { upsertChunks } = await import("@/lib/manuscripts/chunks");

    await expect(upsertChunks(42, [makeChunkSpec(0, "h0")], "job-1"))
      .rejects.toThrow(/Failed to upsert chunks: boom/);

    // Order invariant: orphan-delete must NEVER fire if the upsert failed.
    expect(events.filter((e) => e === "delete")).toHaveLength(0);
  });

  it("runs orphan-deletion AFTER the upsert (never before)", async () => {
    // Simulate that the manuscript previously had chunks 0,1,2 but the new
    // spec only has 0,1 — chunk_index=2 must be deleted.
    const { client, events, deletedIdSets } = makeStubClient({
      postUpsertRows: [
        { id: "row-0", chunk_index: 0 },
        { id: "row-1", chunk_index: 1 },
        { id: "row-2-orphan", chunk_index: 2 },
      ],
    });
    createClientMock.mockReturnValue(client);

    const { upsertChunks } = await import("@/lib/manuscripts/chunks");
    await upsertChunks(42, [makeChunkSpec(0, "h0"), makeChunkSpec(1, "h1")], "job-1");

    // Order: rpc first, THEN select (post-state read), THEN delete.
    expect(events).toEqual(["rpc:upsert_manuscript_chunks", "select", "delete"]);
    expect(deletedIdSets).toEqual([["row-2-orphan"]]);
  });

  it("skips the orphan-delete entirely when no orphans exist", async () => {
    const { client, events } = makeStubClient({
      postUpsertRows: [
        { id: "row-0", chunk_index: 0 },
        { id: "row-1", chunk_index: 1 },
      ],
    });
    createClientMock.mockReturnValue(client);

    const { upsertChunks } = await import("@/lib/manuscripts/chunks");
    await upsertChunks(42, [makeChunkSpec(0, "h0"), makeChunkSpec(1, "h1")], "job-1");

    expect(events).toEqual(["rpc:upsert_manuscript_chunks", "select"]);
    // .delete() should never have been called — no events after select.
  });

  it("is idempotent: calling twice with the same input is safe (no error, RPC fired twice)", async () => {
    const { client, rpcCalls } = makeStubClient({
      postUpsertRows: [
        { id: "row-0", chunk_index: 0 },
        { id: "row-1", chunk_index: 1 },
      ],
    });
    createClientMock.mockReturnValue(client);

    const { upsertChunks } = await import("@/lib/manuscripts/chunks");
    const chunks = [makeChunkSpec(0, "h0"), makeChunkSpec(1, "h1")];

    await upsertChunks(42, chunks, "job-1");
    await upsertChunks(42, chunks, "job-1");

    expect(rpcCalls).toHaveLength(2);
    // Both calls carry the same payload — RPC absorbs duplicates atomically.
    expect(rpcCalls[0].params).toEqual(rpcCalls[1].params);
  });

  it("survives many concurrent calls without throwing (race-safety lives in the RPC, but the wrapper must not serialize)", async () => {
    const { client, rpcCalls } = makeStubClient({
      postUpsertRows: [{ id: "row-0", chunk_index: 0 }],
    });
    createClientMock.mockReturnValue(client);

    const { upsertChunks } = await import("@/lib/manuscripts/chunks");

    const N = 20;
    await Promise.all(
      Array.from({ length: N }, (_, i) =>
        upsertChunks(42, [makeChunkSpec(0, "h0")], `job-${i}`)
      )
    );

    expect(rpcCalls).toHaveLength(N);
  });

  it("surfaces orphan-delete errors without masking the upsert success", async () => {
    const { client } = makeStubClient({
      postUpsertRows: [
        { id: "row-0", chunk_index: 0 },
        { id: "row-orphan", chunk_index: 99 },
      ],
      deleteError: { message: "delete failed" },
    });
    createClientMock.mockReturnValue(client);

    const { upsertChunks } = await import("@/lib/manuscripts/chunks");
    await expect(upsertChunks(42, [makeChunkSpec(0, "h0")], "job-1"))
      .rejects.toThrow(/Failed to delete orphan chunks: delete failed/);
  });
});
