// lib/audit.js

import { GOVERNANCE_VERSION } from "./governance";

/**
 * Shape of a standard audit event emitted by any function.
 */
export function createAuditEvent({
  functionId,
  workType,
  status = "success",
  message = "",
  meta = {},
}) {
  const timestamp = new Date().toISOString();

  return {
    governanceVersion: GOVERNANCE_VERSION,
    functionId,
    workType,
    status,           // "success" | "error" | "warning"
    message,
    meta,
    timestamp,
  };
}

/**
 * Lightweight logger for now; later this can POST to Supabase,
 * a logging service, or your own analytics endpoint.
 */
export async function emitAuditEvent(event, logger = console) {
  try {
    logger.info?.("[RG-AUDIT]", event);
  } catch {
    // no-op fallback
  }
}

