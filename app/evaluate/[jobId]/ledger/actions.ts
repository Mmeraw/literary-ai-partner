'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { recordEvaluationEvent } from '@/lib/evaluation/workflow/events';

async function assertOwnedJob(jobId: string, userId: string) {
  const supabase = createAdminClient();
  const { data: job, error } = await supabase
    .from('evaluation_jobs')
    .select('id, user_id, manuscript_id, evaluation_project_id, manuscripts(user_id,title)')
    .eq('id', jobId)
    .maybeSingle();

  if (error || !job) {
    throw new Error('Unable to load evaluation job.');
  }

  const ownerId =
    (job as { user_id?: string | null }).user_id ??
    ((job as { manuscripts?: { user_id?: string | null } | Array<{ user_id?: string | null }> }).manuscripts &&
      (Array.isArray((job as { manuscripts?: Array<{ user_id?: string | null }> }).manuscripts)
        ? (job as { manuscripts?: Array<{ user_id?: string | null }> }).manuscripts?.[0]?.user_id
        : ((job as { manuscripts?: { user_id?: string | null } }).manuscripts)?.user_id));

  if (ownerId !== userId) {
    throw new Error('Evaluation job is not accessible to this account.');
  }

  return job as {
    id: string;
    manuscript_id: number;
    evaluation_project_id?: string | null;
  };
}

export async function approveLedgerAction(formData: FormData): Promise<void> {
  const jobId = String(formData.get('jobId') ?? '').trim();
  if (!jobId) throw new Error('Missing job id.');

  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Please sign in to approve the ledger.');

  const supabase = createAdminClient();
  const job = await assertOwnedJob(jobId, user.id);

  const { data: ledgerArtifact, error: ledgerError } = await supabase
    .from('evaluation_artifacts')
    .select('id')
    .eq('job_id', jobId)
    .eq('artifact_type', 'pass1a_character_ledger_v1')
    .maybeSingle();

  if (ledgerError || !ledgerArtifact?.id) {
    throw new Error('Story Ledger is not ready yet.');
  }

  const approvedAt = new Date().toISOString();
  const { error: updateError } = await supabase
    .from('evaluation_jobs')
    .update({
      ledger_approved_at: approvedAt,
      ledger_approved_by: user.id,
      guided_full_novel_stage: 'ledger_approved',
      updated_at: approvedAt,
    })
    .eq('id', jobId);

  if (updateError) {
    throw new Error(`Unable to approve ledger: ${updateError.message}`);
  }

  if (job.evaluation_project_id) {
    await recordEvaluationEvent({
      supabase,
      projectId: job.evaluation_project_id,
      eventType: 'ledger_approved',
      payload: {
        job_id: jobId,
        artifact_id: ledgerArtifact.id,
        approved_by: user.id,
        approved_at: approvedAt,
      },
    }).catch((eventError) => {
      console.warn('[approveLedgerAction] ledger approval event failed', eventError);
    });
  }

  redirect(`/evaluate/${jobId}/ledger?approved=1`);
}
