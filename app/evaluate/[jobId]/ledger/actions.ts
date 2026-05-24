'use server';

import { redirect } from 'next/navigation';
import { createAdminClient } from '@/lib/supabase/admin';
import { getAuthenticatedUser } from '@/lib/supabase/server';
import { headers } from 'next/headers';

/**
 * approveLedgerAction
 *
 * Server Action wired to the Review Gate approval form.
 *
 * Delegates to the backend-enforced /api/jobs/[jobId]/review-gate POST endpoint.
 * This action MUST NOT perform the state transition itself — that logic lives
 * server-side in the review-gate route so it is enforced on every path.
 *
 * Disposition is always 'accepted_without_changes' when triggered from the
 * standard approve button. The UI surfaces 'accepted_with_edits' and 'rejected'
 * via the extended review panel (additional form fields).
 */
export async function approveLedgerAction(formData: FormData): Promise<void> {
  const jobId = String(formData.get('jobId') ?? '').trim();
  if (!jobId) throw new Error('Missing job id.');

  const disposition = String(formData.get('disposition') ?? 'accepted_without_changes').trim();
  const authorNotes = String(formData.get('author_notes') ?? '').trim() || undefined;
  const editRequestsRaw = String(formData.get('edit_requests') ?? '').trim();
  const editRequests = editRequestsRaw
    ? editRequestsRaw.split('\n').map((s) => s.trim()).filter(Boolean)
    : undefined;

  const layerDecisionsRaw = formData.get('layer_decisions');
  let layerDecisions: Record<string, { status: string; comment: string }> | undefined;
  if (layerDecisionsRaw) {
    try {
      layerDecisions = JSON.parse(layerDecisionsRaw as string);
    } catch {
      throw new Error('Invalid layer_decisions payload.');
    }
  }

  const user = await getAuthenticatedUser();
  if (!user) throw new Error('Please sign in to approve the ledger.');

  // Verify ownership before forwarding — belt-and-suspenders (review-gate route
  // also checks ownership, but failing early gives a cleaner error message here).
  const supabase = createAdminClient();
  const { data: job, error: jobError } = await supabase
    .from('evaluation_jobs')
    .select('id, user_id, phase, phase_status, manuscripts(user_id)')
    .eq('id', jobId)
    .maybeSingle();

  if (jobError || !job) throw new Error('Unable to load evaluation job.');

  type MinimalJob = {
    user_id?: string | null;
    phase?: string | null;
    phase_status?: string | null;
    manuscripts?: { user_id?: string | null } | Array<{ user_id?: string | null }> | null;
  };
  const j = job as MinimalJob;
  const ownerId =
    j.user_id ??
    (Array.isArray(j.manuscripts) ? j.manuscripts[0]?.user_id : j.manuscripts?.user_id);

  if (ownerId !== user.id) throw new Error('Evaluation job is not accessible to this account.');

  // Gate: job must be at review_gate / awaiting_approval
  // The review-gate route enforces this too, but early validation improves UX
  // (the error is surfaced before a round-trip to the API).
  if (j.phase !== 'review_gate' || j.phase_status !== 'awaiting_approval') {
    throw new Error(
      `Job is not at the Review Gate (phase=${j.phase ?? 'unknown'}, ` +
        `phase_status=${j.phase_status ?? 'unknown'}). Refresh and try again.`,
    );
  }

  // Build absolute URL for the internal API call from a Server Action.
  // headers() gives us the host so we can form the correct absolute URL.
  const headersList = await headers();
  const host = headersList.get('host') ?? 'localhost:3000';
  const proto = process.env.NODE_ENV === 'production' ? 'https' : 'http';
  const apiUrl = `${proto}://${host}/api/jobs/${jobId}/review-gate`;

  // Forward the request to the backend-enforced Review Gate endpoint.
  // The endpoint re-validates ownership, phase state, and artifact existence.
  const body: Record<string, unknown> = { disposition };
  if (authorNotes) body.author_notes = authorNotes;
  if (editRequests?.length) body.edit_requests = editRequests;
  if (layerDecisions) body.layer_decisions = layerDecisions;

  // Pass the user's session cookie so the review-gate route can authenticate.
  const cookieHeader = headersList.get('cookie') ?? '';

  const res = await fetch(apiUrl, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      Cookie: cookieHeader,
    },
    body: JSON.stringify(body),
    cache: 'no-store',
  });

  if (!res.ok) {
    let errMsg = `Review Gate API returned ${res.status}`;
    try {
      const json = await res.json();
      if (json?.error) errMsg = json.error;
    } catch {
      // ignore parse errors
    }
    throw new Error(errMsg);
  }

  // Success — redirect back to the ledger with approval flag so the UI shows
  // the success banner. Phase 2 is now queued and the worker will pick it up.
  const redirectTarget =
    disposition === 'rejected'
      ? `/evaluate/${jobId}/ledger?rejected=1`
      : `/evaluate/${jobId}/ledger?approved=1`;

  redirect(redirectTarget);
}

/**
 * rejectLedgerAction
 *
 * Convenience Server Action for the explicit reject button on the ledger page.
 * Delegates to approveLedgerAction with disposition='rejected'.
 */
export async function rejectLedgerAction(formData: FormData): Promise<void> {
  const cloned = new FormData();
  cloned.set('jobId', String(formData.get('jobId') ?? ''));
  cloned.set('disposition', 'rejected');
  const authorNotes = formData.get('author_notes');
  if (authorNotes) cloned.set('author_notes', String(authorNotes));
  return approveLedgerAction(cloned);
}
