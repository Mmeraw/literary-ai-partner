/**
 * tests/stress/mocks/supabase.ts
 *
 * Minimal in-memory Supabase client mock for the pipeline stress harness.
 *
 * Scope: just enough surface to satisfy the call sites that runPipeline and
 * downstream persistence touch when the harness drives them. Real Supabase
 * is NEVER reached.
 *
 * Fault injection:
 *   - `disconnectAfterCalls`: count down; on the Nth call to any builder,
 *     the next operation throws "supabase: connection lost" (matrix row
 *     S-disconnect-mid-job).
 *   - `omitRpc`: when true, `.rpc` is undefined so calling code hits the
 *     exact PR #470 failure mode (matrix row S-rpc-not-function).
 *
 * Anti-flake: this mock holds no timestamps, no sleeps, no async timers.
 * Every method returns a resolved Promise with deterministic shape.
 */

type Row = Record<string, unknown>;

export interface SupabaseFault {
  /** When ≥ 1, decrement on each builder call; throw at zero. */
  disconnectAfterCalls?: number;
  /** Omit `.rpc` from the client (simulates PR #470 mock-shape regression). */
  omitRpc?: boolean;
}

export interface MockSupabaseContext {
  fault: SupabaseFault;
  callCount: number;
  insertedRows: Record<string, Row[]>;
  updatedRows: Record<string, Row[]>;
  rpcCalls: Array<{ fn: string; args: unknown }>;
}

function makeBuilder(ctx: MockSupabaseContext, table: string) {
  function tick() {
    ctx.callCount += 1;
    if (
      typeof ctx.fault.disconnectAfterCalls === "number" &&
      ctx.callCount > ctx.fault.disconnectAfterCalls
    ) {
      throw new Error("supabase: connection lost (stress mock)");
    }
  }
  const api = {
    select(_cols?: string) {
      tick();
      return api;
    },
    insert(row: Row | Row[]) {
      tick();
      ctx.insertedRows[table] ??= [];
      const rows = Array.isArray(row) ? row : [row];
      ctx.insertedRows[table].push(...rows);
      return api;
    },
    update(row: Row) {
      tick();
      ctx.updatedRows[table] ??= [];
      ctx.updatedRows[table].push(row);
      return api;
    },
    upsert(row: Row | Row[]) {
      tick();
      const rows = Array.isArray(row) ? row : [row];
      ctx.insertedRows[table] ??= [];
      ctx.insertedRows[table].push(...rows);
      return api;
    },
    eq(_col: string, _val: unknown) {
      return api;
    },
    in(_col: string, _vals: unknown[]) {
      return api;
    },
    order(_col: string, _opts?: unknown) {
      return api;
    },
    limit(_n: number) {
      return api;
    },
    single() {
      return Promise.resolve({ data: null, error: null });
    },
    maybeSingle() {
      return Promise.resolve({ data: null, error: null });
    },
    then<T>(onFulfilled: (v: { data: Row[]; error: null }) => T) {
      return Promise.resolve({ data: [], error: null }).then(onFulfilled);
    },
  };
  return api;
}

export interface MockSupabaseClient {
  from(table: string): ReturnType<typeof makeBuilder>;
  rpc?: (fn: string, args?: unknown) => Promise<{ data: null; error: null }>;
}

export function makeMockSupabase(fault: SupabaseFault = {}): {
  client: MockSupabaseClient;
  context: MockSupabaseContext;
} {
  const ctx: MockSupabaseContext = {
    fault,
    callCount: 0,
    insertedRows: {},
    updatedRows: {},
    rpcCalls: [],
  };

  const client: MockSupabaseClient = {
    from(table: string) {
      return makeBuilder(ctx, table);
    },
  };
  if (!fault.omitRpc) {
    client.rpc = (fn: string, args?: unknown) => {
      ctx.rpcCalls.push({ fn, args });
      return Promise.resolve({ data: null, error: null });
    };
  }
  return { client, context: ctx };
}
