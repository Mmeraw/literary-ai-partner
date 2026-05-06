export const PIPELINE_HEALTH_ADMIN_EMAIL = "tsavobc@hotmail.com";

export function isPipelineHealthAdminEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === PIPELINE_HEALTH_ADMIN_EMAIL;
}
