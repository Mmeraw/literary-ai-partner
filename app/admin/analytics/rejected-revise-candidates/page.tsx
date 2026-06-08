import { redirect } from "next/navigation";
import { NextRequest } from "next/server";
import { requireAdmin } from "@/lib/admin/requireAdmin";
import RejectedReviseCandidateAnalyticsClient from "./rejectedReviseCandidateAnalyticsClient";

export const dynamic = "force-dynamic";

export default async function RejectedReviseCandidateAnalyticsPage() {
  const denied = await requireAdmin({
    nextUrl: { pathname: "/admin/analytics/rejected-revise-candidates" },
    headers: new Headers(),
  } as unknown as NextRequest);

  if (denied) redirect("/evaluate");

  return <RejectedReviseCandidateAnalyticsClient />;
}
