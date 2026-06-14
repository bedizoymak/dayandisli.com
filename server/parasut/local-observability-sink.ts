import {
  createErrorSummary,
  sanitizeObservabilityText,
  type ErrorSummary,
  type SyncObservabilitySink,
  type SyncSummary,
} from "./sync-observability.ts";

type Environment = Record<string, string | undefined>;
type LineWriter = (line: string) => void | Promise<void>;

export interface LocalObservabilitySinkOptions {
  env?: Environment;
  writeLine?: LineWriter;
}

export function isLocalObservabilityEnabled(env: Environment): boolean {
  return env.PARASUT_SYNC_OBSERVABILITY === "1";
}

function sanitizeCliText(value: unknown, limit: number): string {
  return sanitizeObservabilityText(value, limit).replace(
    /\b(?:request_metadata|raw_payload)\b\s*[:=]\s*\S+/gi,
    "[REDACTED]",
  );
}

function allowlistedSummary(summary: SyncSummary): SyncSummary {
  return {
    run_id: sanitizeCliText(summary.run_id, 120),
    resource_type: sanitizeCliText(summary.resource_type, 120),
    status: summary.status,
    pages: summary.pages,
    observed: summary.observed,
    inserted: summary.inserted,
    updated: summary.updated,
    unchanged: summary.unchanged,
    errors: summary.errors,
    last_completed_page: summary.last_completed_page,
    duration_ms: summary.duration_ms,
  };
}

function allowlistedError(summary: ErrorSummary): ErrorSummary {
  const sanitized = createErrorSummary({
    code: summary.code,
    message: summary.message,
    retryable: summary.retryable,
  });

  return {
    code:
      sanitized.code === null ? null : sanitizeCliText(sanitized.code, 80),
    message: sanitizeCliText(sanitized.message, 240),
    retryable: sanitized.retryable,
  };
}

export function createLocalObservabilitySink(
  options: LocalObservabilitySinkOptions = {},
): SyncObservabilitySink {
  const enabled = isLocalObservabilityEnabled(options.env ?? {});
  const writeLine = options.writeLine ?? (() => undefined);

  async function emit(value: SyncSummary | ErrorSummary): Promise<void> {
    if (!enabled) return;
    try {
      await writeLine(`${JSON.stringify(value)}\n`);
    } catch {
      // Local reporting must never change synchronization outcomes.
    }
  }

  return {
    emitSyncSummary: (summary) => emit(allowlistedSummary(summary)),
    emitErrorSummary: (summary) => emit(allowlistedError(summary)),
  };
}
