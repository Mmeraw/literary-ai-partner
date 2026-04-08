describe("buildOpenAIOutputTokenParam", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  test("uses max_completion_tokens for reasoning-style models", async () => {
    const { buildOpenAIOutputTokenParam } = require("../../../lib/evaluation/policy");

    expect(buildOpenAIOutputTokenParam("o3", 1400)).toEqual({
      max_completion_tokens: 1400,
    });
    expect(buildOpenAIOutputTokenParam("gpt-5", 900)).toEqual({
      max_completion_tokens: 900,
    });
  });

  test("uses max_tokens for non-reasoning chat-completions models", async () => {
    const { buildOpenAIOutputTokenParam } = require("../../../lib/evaluation/policy");

    expect(buildOpenAIOutputTokenParam("gpt-4o-mini", 1200)).toEqual({
      max_tokens: 1200,
    });
  });
});

describe("buildOpenAITemperatureParam", () => {
  beforeEach(() => {
    jest.resetModules();
    process.env.NEXT_PUBLIC_SUPABASE_URL = "https://example.supabase.co";
    process.env.SUPABASE_SERVICE_ROLE_KEY = "service-role-key";
  });

  test("omits temperature for reasoning-style models", async () => {
    const { buildOpenAITemperatureParam } = require("../../../lib/evaluation/policy");

    expect(buildOpenAITemperatureParam("o3", 0.2)).toEqual({});
    expect(buildOpenAITemperatureParam("gpt-5", 0.2)).toEqual({});
  });

  test("keeps temperature for non-reasoning chat-completions models", async () => {
    const { buildOpenAITemperatureParam } = require("../../../lib/evaluation/policy");

    expect(buildOpenAITemperatureParam("gpt-4o-mini", 0.2)).toEqual({
      temperature: 0.2,
    });
  });
});