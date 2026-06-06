import { redirect } from 'next/navigation';
import type { Metadata } from 'next';

export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function generateMetadata({ params }: { params: { jobId: string } }): Promise<Metadata> {
  return {
    title: `Evaluation Report ${params.jobId}`,
  };
}

export default async function LegacyReportsPage({
  params,
  searchParams,
}: {
  params: { jobId: string };
  searchParams?: Promise<{ print?: string | string[] }> | { print?: string | string[] };
}) {
  const resolved = searchParams ? await searchParams : {};
  const print = Array.isArray(resolved.print) ? resolved.print[0] : resolved.print;
  const printSuffix = print === '1' ? '?print=1' : '';
  redirect(`/evaluate/${params.jobId}${printSuffix}`);
}
