import { getFinalReviewPayload } from "@/lib/revision/finalReview";
import FinalReviewClient, { type FinalReviewView } from "@/components/revision/FinalReviewClient";

export const dynamic = "force-dynamic";

function viewValue(value: string | string[] | undefined): FinalReviewView {
  const view = Array.isArray(value) ? value[0] : value;
  return view === "clean" || view === "marked" || view === "changelog" ? view : "full";
}

export default async function FinalReviewPage({
  searchParams,
}: {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
}) {
  const params = (await searchParams) ?? {};
  const manuscriptIdRaw = params.manuscriptId;
  const evaluationJobIdRaw = params.evaluationJobId;
  const printRaw = params.print;
  const payload = await getFinalReviewPayload({
    manuscriptId: Array.isArray(manuscriptIdRaw) ? manuscriptIdRaw[0] : manuscriptIdRaw,
    evaluationJobId: Array.isArray(evaluationJobIdRaw) ? evaluationJobIdRaw[0] : evaluationJobIdRaw,
  });

  return <FinalReviewClient payload={payload} printMode={(Array.isArray(printRaw) ? printRaw[0] : printRaw) === "1"} view={viewValue(params.view)} />;
}
