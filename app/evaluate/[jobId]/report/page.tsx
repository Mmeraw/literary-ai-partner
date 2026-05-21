import { redirect } from "next/navigation";

export default function ReportPage({ params }: { params: { jobId: string } }) {
  redirect(`/reports/${params.jobId}`);
}
