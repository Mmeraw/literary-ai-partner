const createCompletionMock = jest.fn();
const OpenAIMock = jest.fn(() => ({
  chat: {
    completions: {
      create: createCompletionMock,
    },
  },
}));

const createClientMock = jest.fn();

jest.mock("openai", () => ({
  __esModule: true,
  default: OpenAIMock,
}));

jest.mock("@supabase/supabase-js", () => ({
  createClient: (...args: unknown[]) => createClientMock(...args),
}));

describe("processEvaluationJob — EVAL_PIPELINE_ENABLED kill switch", () => {
  const originalFlag = process.env.EVAL_PIPELINE_ENABLED;

  beforeEach(() => {
    jest.resetModules();
    jest.clearAllMocks();

    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
    process.env.OPENAI_API_KEY = "sk-test-key";
    process.env.EVAL_PASS_TIMEOUT_MS = "180000";
    process.env.EVAL_OPENAI_TIMEOUT_MS = "180000";
  });

  afterEach(() => {
    if (originalFlag === undefined) {
      delete process.env.EVAL_PIPELINE_ENABLED;
    } else {
      process.env.EVAL_PIPELINE_ENABLED = originalFlag;
    }
  });

  test("processEvaluationJob short-circuits with the skip envelope and never touches the DB or OpenAI", async () => {
    process.env.EVAL_PIPELINE_ENABLED = "false";

    // If the guard fails to fire, processor will try to build a supabase client
    // and call its methods. We assert createClient is NEVER invoked.
    createClientMock.mockImplementation(() => {
      throw new Error("createClient must not be called when pipeline is disabled");
    });

    const { processEvaluationJob } = require("../../../lib/evaluation/processor");

    const result = await processEvaluationJob("job-guard-test");

    expect(result.success).toBe(false);
    expect(result.skipped).toBe(true);
    expect(result.reason).toBe("EVAL_PIPELINE_DISABLED_BY_FLAG");

    // Hard contract: no DB interaction, no AI provider construction.
    expect(createClientMock).not.toHaveBeenCalled();
    expect(OpenAIMock).not.toHaveBeenCalled();
  });

  test("processQueuedJobs short-circuits with zero work claimed when pipeline is disabled", async () => {
    process.env.EVAL_PIPELINE_ENABLED = "false";

    createClientMock.mockImplementation(() => {
      throw new Error("createClient must not be called when pipeline is disabled");
    });

    const { processQueuedJobs } = require("../../../lib/evaluation/processor");

    const result = await processQueuedJobs();

    expect(result).toEqual({
      processed: 0,
      succeeded: 0,
      failed: 0,
      claimed: 0,
      errors: [],
    });

    expect(createClientMock).not.toHaveBeenCalled();
    expect(OpenAIMock).not.toHaveBeenCalled();
  });
});
