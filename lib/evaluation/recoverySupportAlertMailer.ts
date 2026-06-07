import {
  REVISIONGRADE_SUPPORT_EMAIL,
  type SplitBrainRecoveryAction,
} from '@/lib/evaluation/hardStopGovernance';

export interface RecoverySupportAlertPayload {
  job_id: string;
  manuscript_id?: number | null;
  user_id?: string | null;
  phase?: string | null;
  phase_status?: string | null;
  progress_phase?: string | null;
  progress_phase_status?: string | null;
  recovery_key: string;
  recovery_action: SplitBrainRecoveryAction;
  internal_diagnosis: string;
  user_safe_message: string;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface RecoverySupportAlertResult {
  attempted: boolean;
  sent: boolean;
  error?: string;
}

export interface EvaluationFailureSupportAlertPayload {
  job_id: string;
  manuscript_id?: number | null;
  user_id?: string | null;
  phase?: string | null;
  phase_status?: string | null;
  progress_phase?: string | null;
  progress_phase_status?: string | null;
  failure_code: string;
  failure_message: string;
  source: string;
  pipeline_stage?: string | null;
  retry_eligible?: boolean | null;
  diagnostics?: unknown;
  created_at?: string | null;
  updated_at?: string | null;
}

export interface EvaluationMajorIssueUserAlertPayload {
  job_id: string;
  manuscript_id?: number | null;
  user_email: string;
}

interface RecoverySupportAlertDeps {
  fetchFn?: typeof fetch;
  logger?: Pick<typeof console, 'warn' | 'error'>;
}

const RECOVERY_ALERT_DEFAULT_SAFE_MESSAGE =
  'Evaluation paused while synchronizing progress. Your manuscript and completed analysis have been preserved. Continue Evaluation will resume from the safest available checkpoint.';

export const MAJOR_TECHNICAL_ISSUE_PUBLIC_MESSAGE =
  'We hit a technical issue that needs engineering support. Our team has been alerted and is investigating. Your manuscript and completed analysis have been preserved; you do not need to retry. We will notify you by email when the problem has been fixed.';

export function shouldAlertSupportForRecoveryAction(
  action: SplitBrainRecoveryAction | 'none' | null | undefined,
): action is SplitBrainRecoveryAction {
  return (
    action === 'repair_to_expected_handoff'
    || action === 'sync_progress_to_job_state'
    || action === 'halt_for_engineering_review'
  );
}

export function toUserSafeRecoveryMessage(message: string | null | undefined): string {
  if (typeof message !== 'string' || message.trim().length === 0) {
    return RECOVERY_ALERT_DEFAULT_SAFE_MESSAGE;
  }

  if (/split-brain/i.test(message)) {
    return RECOVERY_ALERT_DEFAULT_SAFE_MESSAGE;
  }

  return message.trim();
}

function renderRecoveryEmailBody(payload: RecoverySupportAlertPayload): string {
  return [
    `job_id: ${payload.job_id}`,
    `manuscript_id: ${payload.manuscript_id ?? 'null'}`,
    `user_id: ${payload.user_id ?? 'null'}`,
    `phase: ${payload.phase ?? 'null'}`,
    `phase_status: ${payload.phase_status ?? 'null'}`,
    `progress.phase: ${payload.progress_phase ?? 'null'}`,
    `progress.phase_status: ${payload.progress_phase_status ?? 'null'}`,
    `recovery_key: ${payload.recovery_key}`,
    `recovery_action: ${payload.recovery_action}`,
    `internal_diagnosis: ${payload.internal_diagnosis}`,
    `user_safe_message: ${payload.user_safe_message}`,
    `created_at: ${payload.created_at ?? 'null'}`,
    `updated_at: ${payload.updated_at ?? 'null'}`,
  ].join('\n');
}

function renderEvaluationFailureEmailBody(payload: EvaluationFailureSupportAlertPayload): string {
  return [
    `job_id: ${payload.job_id}`,
    `failure_type: ${payload.failure_code}`,
  ].join('\n');
}

function renderEvaluationMajorIssueUserEmailBody(payload: EvaluationMajorIssueUserAlertPayload): string {
  return [
    'Hi,',
    '',
    'We hit a technical issue with your evaluation.',
    '',
    `Job ID: ${payload.job_id}`,
    ...(typeof payload.manuscript_id === 'number' ? [`Manuscript ID: ${payload.manuscript_id}`] : []),
    '',
    'Engineering support has been alerted and is investigating. Your manuscript and completed analysis have been preserved, and you do not need to retry.',
    '',
    'We will email you again when the problem has been fixed.',
    '',
    'RevisionGrade Support',
  ].join('\n');
}

export async function sendRecoverySupportAlert(
  payload: RecoverySupportAlertPayload,
  deps: RecoverySupportAlertDeps = {},
): Promise<RecoverySupportAlertResult> {
  const logger = deps.logger ?? console;
  const provider = (process.env.RECOVERY_ALERT_EMAIL_PROVIDER ?? 'resend').trim().toLowerCase();

  if (provider !== 'resend') {
    logger.warn('[RecoverySupportAlert] unsupported_email_provider', {
      provider,
      recovery_key: payload.recovery_key,
      to: REVISIONGRADE_SUPPORT_EMAIL,
    });
    return { attempted: false, sent: false, error: `unsupported provider: ${provider}` };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.RECOVERY_ALERT_FROM_EMAIL
    ?? process.env.RESEND_FROM_EMAIL
    ?? 'alerts@revisiongrade.com';

  if (!resendApiKey) {
    logger.warn('[RecoverySupportAlert] missing_provider_config', {
      provider,
      recovery_key: payload.recovery_key,
      missing: ['RESEND_API_KEY'],
      to: REVISIONGRADE_SUPPORT_EMAIL,
    });
    return { attempted: false, sent: false, error: 'RESEND_API_KEY not configured' };
  }

  const fetchFn = deps.fetchFn ?? fetch;

  try {
    const res = await fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: REVISIONGRADE_SUPPORT_EMAIL,
        subject: `[RevisionGrade] Evaluation recovery alert: ${payload.recovery_key}`,
        text: renderRecoveryEmailBody(payload),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error('[RecoverySupportAlert] resend_send_failed', {
        status: res.status,
        recovery_key: payload.recovery_key,
      });
      return {
        attempted: true,
        sent: false,
        error: `Resend API error ${res.status}: ${body}`,
      };
    }

    return { attempted: true, sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[RecoverySupportAlert] send_exception', {
      message,
      recovery_key: payload.recovery_key,
    });
    return { attempted: true, sent: false, error: message };
  }
}

export async function sendEvaluationFailureSupportAlert(
  payload: EvaluationFailureSupportAlertPayload,
  deps: RecoverySupportAlertDeps = {},
): Promise<RecoverySupportAlertResult> {
  const logger = deps.logger ?? console;
  const provider = (
    process.env.EVALUATION_FAILURE_ALERT_EMAIL_PROVIDER
    ?? process.env.RECOVERY_ALERT_EMAIL_PROVIDER
    ?? 'resend'
  ).trim().toLowerCase();

  if (provider !== 'resend') {
    logger.warn('[EvaluationFailureSupportAlert] unsupported_email_provider', {
      provider,
      job_id: payload.job_id,
      failure_code: payload.failure_code,
      to: REVISIONGRADE_SUPPORT_EMAIL,
    });
    return { attempted: false, sent: false, error: `unsupported provider: ${provider}` };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.EVALUATION_FAILURE_ALERT_FROM_EMAIL
    ?? process.env.RECOVERY_ALERT_FROM_EMAIL
    ?? process.env.RESEND_FROM_EMAIL
    ?? 'alerts@revisiongrade.com';

  if (!resendApiKey) {
    logger.warn('[EvaluationFailureSupportAlert] missing_provider_config', {
      provider,
      job_id: payload.job_id,
      failure_code: payload.failure_code,
      missing: ['RESEND_API_KEY'],
      to: REVISIONGRADE_SUPPORT_EMAIL,
    });
    return { attempted: false, sent: false, error: 'RESEND_API_KEY not configured' };
  }

  const fetchFn = deps.fetchFn ?? fetch;
  const shortJobId = payload.job_id.length > 8 ? `${payload.job_id.slice(0, 8)}…` : payload.job_id;

  try {
    const res = await fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: REVISIONGRADE_SUPPORT_EMAIL,
        subject: `[RevisionGrade] Evaluation failed: ${payload.failure_code} (${shortJobId})`,
        text: renderEvaluationFailureEmailBody(payload),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error('[EvaluationFailureSupportAlert] resend_send_failed', {
        status: res.status,
        job_id: payload.job_id,
        failure_code: payload.failure_code,
      });
      return {
        attempted: true,
        sent: false,
        error: `Resend API error ${res.status}: ${body}`,
      };
    }

    return { attempted: true, sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[EvaluationFailureSupportAlert] send_exception', {
      message,
      job_id: payload.job_id,
      failure_code: payload.failure_code,
    });
    return { attempted: true, sent: false, error: message };
  }
}

export async function sendEvaluationMajorIssueUserAlert(
  payload: EvaluationMajorIssueUserAlertPayload,
  deps: RecoverySupportAlertDeps = {},
): Promise<RecoverySupportAlertResult> {
  const logger = deps.logger ?? console;
  const userEmail = payload.user_email.trim().toLowerCase();
  if (!userEmail || !userEmail.includes('@')) {
    logger.warn('[EvaluationMajorIssueUserAlert] missing_user_email', {
      job_id: payload.job_id,
    });
    return { attempted: false, sent: false, error: 'user_email not configured' };
  }

  const provider = (
    process.env.EVALUATION_MAJOR_ISSUE_USER_EMAIL_PROVIDER
    ?? process.env.EVALUATION_FAILURE_ALERT_EMAIL_PROVIDER
    ?? process.env.RECOVERY_ALERT_EMAIL_PROVIDER
    ?? 'resend'
  ).trim().toLowerCase();

  if (provider !== 'resend') {
    logger.warn('[EvaluationMajorIssueUserAlert] unsupported_email_provider', {
      provider,
      job_id: payload.job_id,
    });
    return { attempted: false, sent: false, error: `unsupported provider: ${provider}` };
  }

  const resendApiKey = process.env.RESEND_API_KEY;
  const fromEmail =
    process.env.EVALUATION_MAJOR_ISSUE_USER_FROM_EMAIL
    ?? process.env.EVALUATION_FAILURE_ALERT_FROM_EMAIL
    ?? process.env.RECOVERY_ALERT_FROM_EMAIL
    ?? process.env.RESEND_FROM_EMAIL
    ?? 'RevisionGrade Support <noreply@revisiongrade.com>';

  if (!resendApiKey) {
    logger.warn('[EvaluationMajorIssueUserAlert] missing_provider_config', {
      provider,
      job_id: payload.job_id,
      missing: ['RESEND_API_KEY'],
      to: userEmail,
    });
    return { attempted: false, sent: false, error: 'RESEND_API_KEY not configured' };
  }

  const fetchFn = deps.fetchFn ?? fetch;
  const shortJobId = payload.job_id.length > 8 ? `${payload.job_id.slice(0, 8)}…` : payload.job_id;

  try {
    const res = await fetchFn('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${resendApiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: fromEmail,
        to: userEmail,
        subject: `[RevisionGrade] Evaluation support update: ${shortJobId}`,
        text: renderEvaluationMajorIssueUserEmailBody({
          ...payload,
          user_email: userEmail,
        }),
      }),
    });

    if (!res.ok) {
      const body = await res.text();
      logger.error('[EvaluationMajorIssueUserAlert] resend_send_failed', {
        status: res.status,
        job_id: payload.job_id,
      });
      return {
        attempted: true,
        sent: false,
        error: `Resend API error ${res.status}: ${body}`,
      };
    }

    return { attempted: true, sent: true };
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    logger.error('[EvaluationMajorIssueUserAlert] send_exception', {
      message,
      job_id: payload.job_id,
    });
    return { attempted: true, sent: false, error: message };
  }
}
