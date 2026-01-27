/**
 * Supabase Project Guard - Prevents accidental usage of wrong database
 * 
 * CANONICAL PROJECTS:
 * - Production: xtumxjnzdswuumndcbwc (RevisionGrade Production)
 * - Testing: ngfszuqjoyixmtlbthyv (⚠️ TESTING ONLY - DO NOT USE)
 * 
 * This guard runs at app startup and ensures you're using the correct project.
 */

const PRODUCTION_PROJECT_ID = "xtumxjnzdswuumndcbwc";
const TESTING_PROJECT_ID = "ngfszuqjoyixmtlbthyv";

export interface ProjectInfo {
  projectId: string;
  url: string;
  environment: "production" | "testing" | "unknown";
  isCorrect: boolean;
}

/**
 * Extract Supabase project ID from URL
 * Example: https://xtumxjnzdswuumndcbwc.supabase.co → xtumxjnzdswuumndcbwc
 */
function extractProjectId(url: string): string | null {
  try {
    const urlObj = new URL(url);
    const hostname = urlObj.hostname;
    // Extract subdomain (project ref) from *.supabase.co
    if (hostname.endsWith('.supabase.co')) {
      return hostname.split('.')[0];
    }
    return null;
  } catch {
    return null;
  }
}

/**
 * Determine which Supabase project environment is configured
 */
export function detectSupabaseProject(): ProjectInfo {
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

  let environment: "production" | "testing" | "unknown" = "unknown";
  let isCorrect = false;

  if (projectId === PRODUCTION_PROJECT_ID) {
    environment = "production";
    isCorrect = true;
  } else if (projectId === TESTING_PROJECT_ID) {
    environment = "testing";
    isCorrect = false; // Testing should NOT be used for real work
  }

  return {
    projectId,
    url,
    environment,
    isCorrect,
  };
}

/**
 * Assert that we're using the production database
 * Throws error if wrong project is detected
 * 
 * Call this at app startup or in critical server routes
 */
export function assertProductionProject(): void {
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

/**
 * Log which Supabase project is being used (safe for startup logging)
 * Use this to provide visibility at app startup
 */
export function logSupabaseProject(): void {
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

/**
 * Environment-aware guard that only enforces in production
 * In development/test, it just logs warnings
 */
export function guardSupabaseProject(): void {
  const project = detectSupabaseProject();
  const isProduction = process.env.NODE_ENV === "production";

  if (project.environment === "testing") {
    const message =
      `⚠️ TESTING DATABASE DETECTED!\n` +
      `You are using: ${project.url}\n` +
      `This is the TESTING project, not production!\n`;

    if (isProduction) {
      // In production, throw error (hard fail)
      throw new Error(message);
    } else {
      // In dev/test, just warn loudly
      console.error("\n" + "=".repeat(60));
      console.error(message);
      console.error("=".repeat(60) + "\n");
    }
  }

  // Always log what project we're using
  logSupabaseProject();
}
