import { createAdminClient } from "../supabase/admin";

export type ObservabilitySourcePhase = "phase_1" | "phase_2" | "api" | "admin" | "system";
export type ObservabilitySeverity = "debug" | "info" | "warn" | "error" | "critical";
export type ObservabilityEntityType = "job";

export type ObservabilityEventType =
  | "job.created"
  | "job.claimed"
  | "job.started"
  | "job.completed"
  | "job.failed"
  | "job.retry_scheduled"
  | "job.dead_lettered"
  | "admin.retry_requested"
  | "admin.retry_executed"
  | "admin.job_status_changed"
  | "job.progress_updated"
  | "job.artifact_written"
  | "job.contract_violation_detected";

export interface ObservabilityEventInput {
  event_type: ObservabilityEventType;
  entity_type: ObservabilityEntityType;
  entity_id: string;
  occurred_at: string;
  source_phase: ObservabilitySourcePhase;
  payload: Record<string, unknown>;
  schema_version?: "v1";
  severity?: ObservabilitySeverity;
  correlation_id?: string;
  parent_event_id?: string | null;
  actor_id?: string | null;
  actor_type?: "user" | "service" | "system" | string;
  idempotency_key?: string | null;
}

export interface ObservabilityEmitResult {
  eventId: string | null;
  deduped: boolean;
}

export class ObservabilityEventValidationError extends Error {
  public readonly code = "OBSERVABILITY_EVENT_VALIDATION_ERROR";
}

export class ObservabilityEventInsertError extends Error {
  public readonly code = "OBSERVABILITY_EVENT_INSERT_ERROR";
}

const ALLOWED_EVENT_TYPES = new Set<ObservabilityEventType>([
  "job.created",
  "job.claimed",
  "job.started",
  "job.completed",
  "job.failed",
  "job.retry_scheduled",
  "job.dead_lettered",
  "admin.retry_requested",
  "admin.retry_executed",
  "admin.job_status_changed",
  "job.progress_updated",
  "job.artifact_written",
  "job.contract_violation_detected",
]);

const ALLOWED_SOURCE_PHASES = new Set<ObservabilitySourcePhase>([
  "phase_1",
  "phase_2",
  "api",
  "admin",
  "system",
]);

const ALLOWED_SEVERITIES = new Set<ObservabilitySeverity>([
  "debug",
  "info",
  "warn",
  "error",
  "critical",
]);

const FORBIDDEN_KEY_PATTERNS = [
  /api[_-]?key/i,
  /password/i,
  /passwd/i,
  /secret/i,
  /authorization/i,
  /auth[_-]?token/i,
  /access[_-]?token/i,
  /refresh[_-]?token/i,
  /supabase_db_url_ci/i,
  /database_url/i,
];

const FORBIDDEN_VALUE_PATTERNS = [/postgresql:\/\//i];

let _supabase: ReturnType<typeof createAdminClient> | undefined;

function getSupabase() {
  if (_supabase === undefined) {
    _supabase = createAdminClient();
  }
  return _supabase;
}

function assertRequired(value: unknown, field: string): void {
  if (value === undefined || value === null || value === "") {
    throw new ObservabilityEventValidationError(
      `Missing required field: ${field}`,
    );
  }
}

function assertPayloadField(payload: Record<string, unknown>, field: string): void {
  if (!(field in payload)) {
    throw new ObservabilityEventValidationError(
      `Missing required payload field: ${field}`,
    );
  }
}

function hasForbiddenKey(key: string): boolean {
  return FORBIDDEN_KEY_PATTERNS.some((pattern) => pattern.test(key));
}

function hasForbiddenValue(value: string): boolean {
  return FORBIDDEN_VALUE_PATTERNS.some((pattern) => pattern.test(value));
}

function redactValue(value: unknown): unknown {
  if (typeof value === "string" && hasForbiddenValue(value)) {
    return "[REDACTED]";
  }
  return value;
}

function redactObject(
  value: unknown,
  path: string,
  redactionFlag: { redacted: boolean },
): unknown {
  if (Array.isArray(value)) {
    return value.map((item, idx) => redactObject(item, `${path}[${idx}]`, redactionFlag));
  }

  if (value && typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, val] of Object.entries(value)) {
      if (hasForbiddenKey(key)) {
        result[key] = "[REDACTED]";
        redactionFlag.redacted = true;
        continue;
      }

      const redactedValue = redactObject(val, path ? `${path}.${key}` : key, redactionFlag);
      if (typeof redactedValue === "string" && hasForbiddenValue(redactedValue)) {
        result[key] = "[REDACTED]";
        redactionFlag.redacted = true;
      } else {
        result[key] = redactedValue;
      }
    }
    return result;
  }

  return redactValue(value);
}

export function scanForForbiddenContent(value: unknown, path = "payload"): void {
  if (typeof value === "string") {
    if (hasForbiddenValue(value)) {
      throw new ObservabilityEventValidationError(
        `Forbidden value match at ${path}`,
      );
    }
  }

  if (value && typeof value === "object") {
    for (const [key, val] of Object.entries(value as Record<string, unknown>)) {
      if (hasForbiddenKey(key)) {
        throw new ObservabilityEventValidationError(
          `Forbidden key "${key}" at ${path}`,
        );
      }
      scanForForbiddenContent(val, path ? `${path}.${key}` : key);
    }
  }
}

function validateEventInput(input: ObservabilityEventInput): void {
  assertRequired(input.event_type, "event_type");
  assertRequired(input.entity_type, "entity_type");
  assertRequired(input.entity_id, "entity_id");
  assertRequired(input.occurred_at, "occurred_at");
  assertRequired(input.source_phase, "source_phase");
  assertRequired(input.payload, "payload");

  if (!ALLOWED_EVENT_TYPES.has(input.event_type)) {
    throw new ObservabilityEventValidationError(
      `Invalid event_type: ${input.event_type}`,
    );
  }

  if (!ALLOWED_SOURCE_PHASES.has(input.source_phase)) {
    throw new ObservabilityEventValidationError(
      `Invalid source_phase: ${input.source_phase}`,
    );
  }

  if (input.severity && !ALLOWED_SEVERITIES.has(input.severity)) {
    throw new ObservabilityEventValidationError(
      `Invalid severity: ${input.severity}`,
    );
  }

  if (input.event_type === "job.failed") {
    assertPayloadField(input.payload, "failed_at");
    assertPayloadField(input.payload, "failure_reason");
    assertPayloadField(input.payload, "attempt_count");
  }
}

export async function emitObservabilityEvent(
  input: ObservabilityEventInput,
): Promise<ObservabilityEmitResult> {
  validateEventInput(input);

  const redactionFlag = { redacted: false };
  const sanitizedPayload = redactObject(input.payload, "payload", redactionFlag);

  const eventRow = {
    event_type: input.event_type,
    schema_version: input.schema_version ?? "v1",
    entity_type: input.entity_type,
    entity_id: input.entity_id,
    correlation_id: input.correlation_id ?? null,
    parent_event_id: input.parent_event_id ?? null,
    source_phase: input.source_phase,
    severity: input.severity ?? "info",
    occurred_at: input.occurred_at,
    payload: sanitizedPayload,
    actor_id: input.actor_id ?? null,
    actor_type: input.actor_type ?? null,
    idempotency_key: input.idempotency_key ?? null,
    is_redacted: redactionFlag.redacted,
  };

  const { data, error } = await getSupabase()
    .from("observability_events")
    .upsert(eventRow as any, {
      onConflict: "event_type,entity_type,entity_id,idempotency_key",
      ignoreDuplicates: true,
    })
    .select("event_id")
    .maybeSingle();

  if (error) {
    const code = (error as any)?.code;
    if (code === "23505") {
      return { eventId: null, deduped: true };
    }

    throw new ObservabilityEventInsertError(
      `Failed to insert observability event: ${error.message}`,
    );
  }

  if (!data || !(data as any).event_id) {
    return { eventId: null, deduped: true };
  }

  return { eventId: (data as any).event_id, deduped: false };
}
