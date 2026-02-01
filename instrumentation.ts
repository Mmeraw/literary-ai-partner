/**
 * Next.js Instrumentation Hook
 * 
 * Runs ONCE at server startup (before any routes or API handlers).
 * This is the ONLY way to guarantee startup-time validation in Next.js.
 * 
 * @see https://nextjs.org/docs/app/building-your-application/optimizing/instrumentation
 */

// Must be at top-level, not in a function
const PROD_PROJECT_REF = "xtumxjnzdswuumndcbwc";

/**
 * PHASE A.5 DAY 1 CRITICAL: Prevent dev from mutating production
 * 
 * This guard runs at SERVER STARTUP, not route-time.
 * If it throws, Next.js will not start.
 * 
 * Validation:
 * - Blocks dev/test modes from using production Supabase
 * - Emergency escape hatch: ALLOW_DEV_PROD=I_UNDERSTAND_THE_RISK
 * - Runs BEFORE any routes can execute
 */
function assertNotDevAgainstProd() {
  const url = process.env.SUPABASE_URL || process.env.NEXT_PUBLIC_SUPABASE_URL || "";
  const nodeEnv = process.env.NODE_ENV || "development";
  const allow = process.env.ALLOW_DEV_PROD === "I_UNDERSTAND_THE_RISK";
  const isCi = process.env.JOB_SYSTEM_ENV === "ci";

  // Only block non-production environments (but allow CI with its own project)
  if (nodeEnv !== "production" && !allow && !isCi) {
    if (url.includes(PROD_PROJECT_REF)) {
      console.error("\n" + "=".repeat(80));
      console.error("❌ CRITICAL STARTUP FAILURE: Dev→Prod Guard Triggered");
      console.error("=".repeat(80));
      console.error(`NODE_ENV: ${nodeEnv}`);
      console.error(`SUPABASE_URL: ${url}`);
      console.error(`PROD_PROJECT_REF: ${PROD_PROJECT_REF}`);
      console.error("");
      console.error("This prevents accidental mutations of PRODUCTION data from dev/test.");
      console.error("");
      console.error("Fix:");
      console.error("  1. Update .env.local to use your dev/test Supabase URL");
      console.error("  2. Restart the server");
      console.error("");
      console.error("Emergency bypass (NOT RECOMMENDED):");
      console.error("  Set ALLOW_DEV_PROD=I_UNDERSTAND_THE_RISK");
      console.error("=".repeat(80) + "\n");
      
      throw new Error(
        `Refusing to run ${nodeEnv} mode against PRODUCTION Supabase (${PROD_PROJECT_REF})`
      );
    }
  }

  // Log safe startup
  if (nodeEnv !== "production") {
    const envLabel = isCi ? "CI" : nodeEnv;
    console.log(`✅ [Startup Guard] ${envLabel} mode using non-prod Supabase - OK`);
  }
}

/**
 * Server-side instrumentation (runs at startup)
 */
export async function register() {
  if (process.env.NEXT_RUNTIME === "nodejs") {
    // Run guard immediately at startup
    assertNotDevAgainstProd();
    
    console.log("✅ [Instrumentation] Server startup guards passed");
  }
}

/**
 * Edge runtime instrumentation (if using edge functions)
 */
export async function onRequestError() {
  // Not used for startup guards, but required by Next.js if register() exists
}
