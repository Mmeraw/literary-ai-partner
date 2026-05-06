import { NextRequest, NextResponse } from "next/server";
import type { User } from "@supabase/supabase-js";
import { createClient } from "@/lib/supabase/server";

export const PIPELINE_HEALTH_ADMIN_EMAIL = "tsavobc@hotmail.com";

export function isPipelineHealthAdminEmail(email: string | null | undefined): boolean {
  return email?.trim().toLowerCase() === PIPELINE_HEALTH_ADMIN_EMAIL;
}

export function isPipelineHealthAdminUser(user: User | null | undefined): boolean {
  return isPipelineHealthAdminEmail(user?.email);
}

export async function getPipelineHealthAdminState(): Promise<{ isAdmin: boolean; email: string | null }> {
  try {
    const supabase = await createClient();
    const { data, error } = await supabase.auth.getUser();
    const user = error ? null : data?.user ?? null;
    const email = user?.email ?? null;

    return { email, isAdmin: isPipelineHealthAdminUser(user) };
  } catch (err) {
    console.warn("[pipelineHealthAccess] Failed to resolve admin state", err);
    return { email: null, isAdmin: false };
  }
}

export async function requirePipelineHealthAdmin(
  req?: NextRequest
): Promise<NextResponse | null> {
  const { isAdmin, email } = await getPipelineHealthAdminState();

  if (isAdmin) return null;

  if (email) {
    console.warn("[requirePipelineHealthAdmin] Forbidden pipeline health access attempt", {
      email,
      path: req?.nextUrl?.pathname ?? "unknown",
    });
  }

  return NextResponse.json(
    {
      success: false,
      error: {
        code: email ? "pipeline_health_forbidden" : "pipeline_health_unauthorized",
        message: "Pipeline Health is restricted to the configured administrator account",
      },
    },
    { status: email ? 403 : 401 }
  );
}
