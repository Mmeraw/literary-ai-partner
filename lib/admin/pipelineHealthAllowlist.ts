/**
 * Pure client/server-safe allowlist for Pipeline Health admin access.
 * NO server-only imports here. Safe to import from "use client" components.
 */
export const PIPELINE_HEALTH_ADMIN_EMAIL = "tsavobc@hotmail.com";

export function isPipelineHealthAdminEmail(email?: string | null): boolean {
  if (!email) return false;
  return email.trim().toLowerCase() === PIPELINE_HEALTH_ADMIN_EMAIL;
}
