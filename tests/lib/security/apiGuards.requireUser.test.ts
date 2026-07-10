import { requireUser } from "@/lib/security/apiGuards";
import * as supabaseServer from "@/lib/supabase/server";

jest.mock("@/lib/supabase/server", () => ({
  getAuthenticatedUser: jest.fn(),
}));

jest.mock("@/lib/admin/requireAdmin", () => ({
  requireAdmin: jest.fn(),
}));

const mockGetAuthenticatedUser = supabaseServer.getAuthenticatedUser as jest.MockedFunction<
  typeof supabaseServer.getAuthenticatedUser
>;

function requestWithUser(userId?: string) {
  const headers = new Headers();
  if (userId) headers.set("x-user-id", userId);
  return new Request("https://localhost.test/probe", { headers });
}

describe("requireUser guarded dev header actor", () => {
  const prevTestMode = process.env.TEST_MODE;
  const prevAllowHeaderUserId = process.env.ALLOW_HEADER_USER_ID;

  beforeEach(() => {
    jest.clearAllMocks();
    mockGetAuthenticatedUser.mockResolvedValue(null);
    delete process.env.TEST_MODE;
    delete process.env.ALLOW_HEADER_USER_ID;
  });

  afterAll(() => {
    process.env.TEST_MODE = prevTestMode;
    process.env.ALLOW_HEADER_USER_ID = prevAllowHeaderUserId;
  });

  test("accepts x-user-id only when both guarded header flags are enabled", async () => {
    process.env.TEST_MODE = "true";
    process.env.ALLOW_HEADER_USER_ID = "true";

    const result = await requireUser(requestWithUser("user-1"));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.id).toBe("user-1");
  });

  test("rejects x-user-id when TEST_MODE is absent", async () => {
    process.env.ALLOW_HEADER_USER_ID = "true";

    const result = await requireUser(requestWithUser("user-1"));

    expect(result.ok).toBe(false);
  });

  test("rejects x-user-id when ALLOW_HEADER_USER_ID is absent", async () => {
    process.env.TEST_MODE = "true";

    const result = await requireUser(requestWithUser("user-1"));

    expect(result.ok).toBe(false);
  });

  test("falls back to session auth when header is absent", async () => {
    mockGetAuthenticatedUser.mockResolvedValue({ id: "session-user", email: "s@example.com" } as never);

    const result = await requireUser(requestWithUser());

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.id).toBe("session-user");
  });

  test("uses guarded x-user-id deterministically when both session and header are present", async () => {
    process.env.TEST_MODE = "true";
    process.env.ALLOW_HEADER_USER_ID = "true";
    mockGetAuthenticatedUser.mockResolvedValue({ id: "session-user", email: "s@example.com" } as never);

    const result = await requireUser(requestWithUser("header-user"));

    expect(result.ok).toBe(true);
    if (result.ok) expect(result.user.id).toBe("header-user");
  });
});
