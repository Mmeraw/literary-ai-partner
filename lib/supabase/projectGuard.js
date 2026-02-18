const PRODUCTION_PROJECT_ID = "xtumxjnzdswuumndcbwc";
const TESTING_PROJECT_ID = "ngfszuqjoyixmtlbthyv";

/**
 * Detect if running in Jest test environment
 * Prevents projectGuard console spam during test runs
 * 
 * SAFETY: TEST_MODE is gated behind NODE_ENV !== "production"
 * to prevent accidental log suppression in production
 */
function isTestEnv() {
  const isJest = process.env.JEST_WORKER_ID != null; // catches undefined/null cleanly
  const isNodeTest = process.env.NODE_ENV === "test";

  // Allow TEST_MODE to behave like test ONLY when we are not in production
  const isExplicitTestMode =
    process.env.TEST_MODE === "true" && process.env.NODE_ENV !== "production";

  return isJest || isNodeTest || isExplicitTestMode;
}

function extractProjectId(url) {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    if (hostname.endsWith(".supabase.co")) {
      return hostname.split(".")[0];
    }
    return null;
  } catch {
    return null;
  }
}

export function detectSupabaseProject() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL || process.env.SUPABASE_URL || "";
  const projectId = extractProjectId(url);

  if (!projectId) {
    return {
      projectId: "unknown",
      url,
      environment: "unknown",
      isCorrect: false,
    };
  }

  let environment = "unknown";
  let isCorrect = false;

  if (projectId === PRODUCTION_PROJECT_ID) {
    environment = "production";
    isCorrect = true;
  } else if (projectId === TESTING_PROJECT_ID) {
    environment = "testing";
    isCorrect = false;
  }

  return {
    projectId,
    url,
    environment,
    isCorrect,
  };
}

export function assertProductionProject() {
  const project = detectSupabaseProject();

  if (project.environment === "testing") {
    throw new Error(
      `❌ CRITICAL ERROR: TESTING DATABASE DETECTED!\n\n` +
        `Your code is configured to use the TESTING project (⚠️ TESTING ONLY - DO NOT USE).\n` +
        `This is NOT safe for production use!\n\n` +
        `Current URL: ${project.url}\n` +
        `Expected URL: https://${PRODUCTION_PROJECT_ID}.supabase.co\n\n` +
        `FIX: Update your .env.local file:\n` +
        `NEXT_PUBLIC_SUPABASE_URL=https://${PRODUCTION_PROJECT_ID}.supabase.co\n\n` +
        `Then restart your server.`
    );
  }

  if (!project.isCorrect) {
    console.warn(
      `⚠️ WARNING: Unknown Supabase project detected!\n` +
        `Current URL: ${project.url}\n` +
        `Expected production: https://${PRODUCTION_PROJECT_ID}.supabase.co\n` +
        `Expected testing: https://${TESTING_PROJECT_ID}.supabase.co\n`
    );
  }
}

export function logSupabaseProject() {
  // Silent in test environments to prevent spam
  if (isTestEnv()) return;

  const project = detectSupabaseProject();

  const symbols = {
    production: "✅",
    testing: "⚠️",
    unknown: "❓",
  };

  const symbol = symbols[project.environment];

  console.log(`\n${symbol} Supabase Project Configuration ${symbol}`);
  console.log(`   Environment: ${project.environment.toUpperCase()}`);
  console.log(`   Project ID: ${project.projectId}`);
  console.log(`   URL: ${project.url}`);

  if (project.environment === "testing") {
    console.error(`   ⚠️ WARNING: You are using the TESTING database!`);
    console.error(`   ⚠️ This should NEVER happen in production!`);
  } else if (project.environment === "production") {
    console.log(`   ✅ Production database active`);
  }
  console.log("");
}

export function guardSupabaseProject() {
  // Silent in test environments to prevent spam
  if (isTestEnv()) return;

  const project = detectSupabaseProject();
  const isProduction = process.env.NODE_ENV === "production";

  if (project.environment === "testing") {
    const message =
      `⚠️ TESTING DATABASE DETECTED!\n` +
      `You are using: ${project.url}\n` +
      `This is the TESTING project, not production!\n`;

    if (isProduction) {
      throw new Error(message);
    } else {
      console.error("\n" + "=".repeat(60));
      console.error(message);
      console.error("=".repeat(60) + "\n");
    }
  }

  logSupabaseProject();
}
