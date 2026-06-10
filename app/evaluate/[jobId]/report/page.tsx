// app/evaluate/[jobId]/report/page.tsx
// Compatibility redirect — the canonical full report renderer lives at /reports/[jobId].
import { redirect } from "next/navigation";

export const dynamic = "force-dynamic";
export const revalidate = 0;

export default async function EvaluateReportRedirect({
  params,
}: {
  params: Promise<{ jobId: string }>;
}) {
  const { jobId } = await params;
  redirect(`/reports/${jobId}`);
}
