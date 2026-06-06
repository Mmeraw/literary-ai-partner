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

interface RecoverySupportAlertDeps {
  fetchFn?: typeof fetch;
  logger?: Pick<typeof console, 'warn' | 'error'>;
}

const RECOVERY_ALERT_DEFAULT_SAFE_MESSAGE =
  'Evaluation paused while synchronizing progress. Your manuscript and completed analysis have been preserved. Continue Evaluation will resume from the safest available checkpoint.';

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
