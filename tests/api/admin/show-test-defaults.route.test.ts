import { NextRequest } from "next/server";
import { GET as getAdminJobs } from "@/app/api/admin/jobs/route";
import { GET as getDeadLetter } from "@/app/api/admin/dead-letter/route";
import { GET as getPipelineHealth } from "@/app/api/admin/pipeline-health/route";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import { createAdminClient } from "@/lib/supabase/admin";

jest.mock("@/lib/admin/requireAdmin", () => ({
  requireAdmin: jest.fn(),
}));

jest.mock("@/lib/supabase/admin", () => ({
  createAdminClient: jest.fn(),
}));

const mockRequireAdmin = requireAdmin as jest.MockedFunction<typeof requireAdmin>;
const mockCreateAdminClient = createAdminClient as jest.MockedFunction<typeof createAdminClient>;

type RpcJob = {
  id: string;
  manuscript_id: number;
  user_id?: string;
  failed_at?: string | null;
  created_at?: string;
  has_more?: boolean;
};

function makeRequest(url: string): NextRequest {
  return {
    nextUrl: new URL(url),
    headers: new Headers(),
  } as unknown as NextRequest;
}

function buildRpcClient(rows: RpcJob[]) {
  return {
    from: jest.fn(() => makeThenableQuery({ data: rows, error: null })),
    rpc: jest.fn(async () => ({ data: rows, error: null })),
    auth: {
      admin: {
        listUsers: jest.fn(async () => ({ data: { users: [] } })),
      },
    },
  } as const;
}

function makeThenableQuery<T extends object>(
  result: { data: unknown; error: unknown },
  extras?: Partial<T>,
): T & PromiseLike<{ data: unknown; error: unknown }> {
  const query: Record<string, unknown> = {};
  const chainMethods = ["select", "eq", "gte", "lte", "order", "limit", "lt", "in"];

  for (const method of chainMethods) {
    query[method] = jest.fn(() => query);
  }

  if (extras) {
    for (const [k, v] of Object.entries(extras)) {
      query[k] = v;
    }
  }

  const promise = Promise.resolve(result);
  query.then = promise.then.bind(promise);
  query.catch = promise.catch.bind(promise);
  query.finally = promise.finally.bind(promise);

  return query as T & PromiseLike<{ data: unknown; error: unknown }>;
}

function buildPipelineHealthClient() {
  const evaluationJobsQueries: Array<Record<string, jest.Mock>> = [];

  const from = jest.fn((table: string) => {
    if (table === "evaluation_jobs") {
      const evalQuery = makeThenableQuery<{ lt: jest.Mock }>(
        { data: [], error: null },
        { lt: jest.fn(() => evalQuery as unknown) as unknown as jest.Mock },
      ) as unknown as Record<string, jest.Mock>;
      evaluationJobsQueries.push(evalQuery);
      return evalQuery;
    }

    if (table === "evaluation_artifacts") {
      return makeThenableQuery({ data: [], error: null });
    }

    throw new Error(`Unexpected table: ${table}`);
  });

  return {
    from,
    auth: {
      admin: {
        listUsers: jest.fn(async () => ({ data: { users: [] } })),
      },
    },
    evaluationJobsQueries,
  };
}

function buildAdminJobsClient(rows: RpcJob[]) {
  return {
    rpc: jest.fn(async () => ({ data: rows, error: null })),
    from: jest.fn((table: string) => {
      if (table === "evaluation_jobs") {
        return makeThenableQuery({ data: rows, error: null });
      }

      throw new Error(`Unexpected table: ${table}`);
    }),
    auth: {
      admin: {
        listUsers: jest.fn(async () => ({ data: { users: [] } })),
      },
    },
  } as const;
}

describe("Admin show_test default visibility hardening", () => {
  beforeEach(() => {
    jest.resetAllMocks();
    mockRequireAdmin.mockResolvedValue(null);
  });

  describe("GET /api/admin/jobs", () => {
    it("includes test-range manuscripts by default when show_test is omitted", async () => {
      const client = buildAdminJobsClient([
        { id: "job-non-test", manuscript_id: 120, has_more: false },
        { id: "job-test", manuscript_id: 9500, has_more: false },
      ]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const res = await getAdminJobs(makeRequest("https://example.test/api/admin/jobs?limit=50"));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.filters.showTestManuscripts).toBe(true);
      expect(json.jobs).toHaveLength(2);
      expect(json.jobs.map((j: { id: string }) => j.id)).toEqual(["job-non-test", "job-test"]);
    });

    it("hides test-range manuscripts when show_test=0", async () => {
      const client = buildAdminJobsClient([
        { id: "job-non-test", manuscript_id: 120, has_more: false },
        { id: "job-test", manuscript_id: 9500, has_more: false },
      ]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const res = await getAdminJobs(makeRequest("https://example.test/api/admin/jobs?limit=50&show_test=0"));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.filters.showTestManuscripts).toBe(false);
      expect(json.jobs).toHaveLength(1);
      expect(json.jobs[0].id).toBe("job-non-test");
    });
  });

  describe("GET /api/admin/dead-letter", () => {
    it("includes test-range failed jobs by default when show_test is omitted", async () => {
      const client = buildRpcClient([
        {
          id: "dead-non-test",
          manuscript_id: 500,
          user_id: "user-1",
          failed_at: "2026-06-13T00:00:00.000Z",
          created_at: "2026-06-13T00:00:00.000Z",
          has_more: false,
        },
        {
          id: "dead-test",
          manuscript_id: 9700,
          user_id: "user-2",
          failed_at: "2026-06-13T00:00:01.000Z",
          created_at: "2026-06-13T00:00:01.000Z",
          has_more: false,
        },
      ]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const res = await getDeadLetter(makeRequest("https://example.test/api/admin/dead-letter?limit=50"));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.filters.showTestManuscripts).toBe(true);
      expect(json.jobs).toHaveLength(2);
      expect(json.jobs.map((j: { id: string }) => j.id)).toEqual(["dead-non-test", "dead-test"]);
    });

    it("hides test-range failed jobs when show_test=false", async () => {
      const client = buildRpcClient([
        {
          id: "dead-non-test",
          manuscript_id: 500,
          user_id: "user-1",
          failed_at: "2026-06-13T00:00:00.000Z",
          created_at: "2026-06-13T00:00:00.000Z",
          has_more: false,
        },
        {
          id: "dead-test",
          manuscript_id: 9700,
          user_id: "user-2",
          failed_at: "2026-06-13T00:00:01.000Z",
          created_at: "2026-06-13T00:00:01.000Z",
          has_more: false,
        },
      ]);
      mockCreateAdminClient.mockReturnValue(client as never);

      const res = await getDeadLetter(makeRequest("https://example.test/api/admin/dead-letter?limit=50&show_test=false"));
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.filters.showTestManuscripts).toBe(false);
      expect(json.jobs).toHaveLength(1);
      expect(json.jobs[0].id).toBe("dead-non-test");
    });
  });

  describe("GET /api/admin/pipeline-health", () => {
    it("defaults to show_test=true and does not apply manuscript lt filter", async () => {
      const client = buildPipelineHealthClient();
      mockCreateAdminClient.mockReturnValue(client as never);

      const res = await getPipelineHealth(
        makeRequest("https://example.test/api/admin/pipeline-health?window=24h&limit=20"),
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.filters.showTestManuscripts).toBe(true);
      expect(client.evaluationJobsQueries.length).toBeGreaterThanOrEqual(2);
      for (const query of client.evaluationJobsQueries) {
        expect(query.lt).not.toHaveBeenCalled();
      }
    });

    it("applies manuscript lt filter when show_test=0", async () => {
      const client = buildPipelineHealthClient();
      mockCreateAdminClient.mockReturnValue(client as never);

      const res = await getPipelineHealth(
        makeRequest("https://example.test/api/admin/pipeline-health?window=24h&limit=20&show_test=0"),
      );
      const json = await res.json();

      expect(res.status).toBe(200);
      expect(json.ok).toBe(true);
      expect(json.filters.showTestManuscripts).toBe(false);
      expect(client.evaluationJobsQueries.length).toBeGreaterThanOrEqual(2);
      for (const query of client.evaluationJobsQueries) {
        expect(query.lt).toHaveBeenCalledWith("manuscript_id", expect.any(Number));
      }
    });
  });
});
