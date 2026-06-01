import { getFinalReviewPayload } from "@/lib/revision/finalReview";
import FinalReviewClient from "@/components/revision/FinalReviewClient";

export const dynamic = "force-dynamic";

export default async function FinalReviewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const manuscriptIdRaw = params.manuscriptId;
  const evaluationJobIdRaw = params.evaluationJobId;
  const payload = await getFinalReviewPayload({
    manuscriptId: Array.isArray(manuscriptIdRaw) ? manuscriptIdRaw[0] : manuscriptIdRaw,
    evaluationJobId: Array.isArray(evaluationJobIdRaw) ? evaluationJobIdRaw[0] : evaluationJobIdRaw,
  });

  return <FinalReviewClient payload={payload} />;
}
