/**
 * Actor Resolution (CI/Test + Production)
 * 
 * Gate A7: Share links require auth in evidence/CI mode using header actor model
 * (matches Flow 1 evidence harness: x-user-id header).
 * 
 * In production, uses standard Supabase session.
 * 
 * Security: Header path only activates under explicit CI/test flags.
 */

import { createClient } from "@/lib/supabase/server";
import { headers } from "next/headers";

/**
 * Get the current actor's user ID.
 * 
 * - CI/test/evidence mode: accept x-user-id header (deterministic testing)
 * - Production: use Supabase session user
 * 
 * @returns user ID or null if not authenticated
 */
export async function getActorIdOrNull(): Promise<string | null> {
  const isEvidence =
    process.env.CI === "true" ||
    process.env.NODE_ENV === "test" ||
    process.env.FLOW1_EVIDENCE === "1" ||
    process.env.FLOW_A7_EVIDENCE === "1";

  if (isEvidence) {
    const h = await headers();
    const actor = h.get("x-user-id");
    if (actor && actor.trim()) {
      return actor.trim();
    }
    return null;
  }

  // Production path: Supabase session
  const supabase = await createClient();
  const {
    data: { user },
  } = await supabase.auth.getUser();

  return user?.id ?? null;
}
