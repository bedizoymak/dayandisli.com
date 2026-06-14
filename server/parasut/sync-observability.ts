import type { SyncCounters, SyncResult } from "./types.ts";

const DEFAULT_MESSAGE_LIMIT = 240;
const REDACTED = "[REDACTED]";

export interface SyncSummaryInput extends SyncCounters {
  runId: string;
  resourceType: string;
  status: SyncResult["status"];
  startedAt: Date;
  completedAt: Date;
  lastCompletedPage: number;
}

export interface SyncSummary {
  run_id: string;
  resource_type: string;
  status: SyncResult["status"];
  pages: number;
  observed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: number;
  last_completed_page: number;
  duration_ms: number;
}

export interface ErrorSummary {
  code: string | null;
  message: string;
  retryable: boolean;
}

export interface SyncObservabilitySink {
  emitSyncSummary?(summary: SyncSummary): void | Promise<void>;
  emitErrorSummary?(summary: ErrorSummary): void | Promise<void>;
}

function nonNegativeInteger(value: number, label: string): number {
  if (!Number.isInteger(value) || value < 0) {
    throw new Error(`${label} must be a non-negative integer`);
  }
  return value;
}

function redactQuerySecrets(value: string): string {
  return value.replace(
    /([?&](?:access_token|refresh_token|api_key|apikey|key|token|secret|password)=)[^&#\s]*/gi,
    `$1${REDACTED}`,
  );
}

function decodeObservabilityText(value: string): string {
  if (!/%[0-9A-F]{2}/i.test(value)) return value;

  try {
    return decodeURIComponent(value);
  } catch {
    return value;
  }
}

export function sanitizeObservabilityText(
  value: unknown,
  limit = DEFAULT_MESSAGE_LIMIT,
): string {
  if (!Number.isInteger(limit) || limit < 1) {
    throw new Error("Sanitization limit must be a positive integer");
  }

  let text = decodeObservabilityText(
    value instanceof Error ? value.message : String(value ?? ""),
  );
  text = redactQuerySecrets(text)
    .replace(/Bearer\s+\S+/gi, `Bearer ${REDACTED}`)
    .replace(
      /(["']?\b(?:access_token|refresh_token|api_key|apikey|client_secret|password)\b["']?\s*[:=]\s*)["']?[^,\s"'&}]+/gi,
      `$1${REDACTED}`,
    )
    .replace(/\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/gi, REDACTED)
    .replace(/(?:\+?\d[\d().\s-]{7,}\d)/g, REDACTED)
    .replace(/\s+/g, " ")
    .trim();

  if (text.length <= limit) return text;
  if (limit <= 3) return ".".repeat(limit);
  return `${text.slice(0, limit - 3)}...`;
}

export function createSyncSummary(input: SyncSummaryInput): SyncSummary {
  const duration = input.completedAt.getTime() - input.startedAt.getTime();
  if (!Number.isFinite(duration) || duration < 0) {
    throw new Error("Sync duration must not be negative");
  }

  return {
    run_id: input.runId,
    resource_type: input.resourceType,
    status: input.status,
    pages: nonNegativeInteger(input.pages, "Pages"),
    observed: nonNegativeInteger(input.observed, "Observed"),
    inserted: nonNegativeInteger(input.inserted, "Inserted"),
    updated: nonNegativeInteger(input.updated, "Updated"),
    unchanged: nonNegativeInteger(input.unchanged, "Unchanged"),
    errors: nonNegativeInteger(input.errors, "Errors"),
    last_completed_page: nonNegativeInteger(
      input.lastCompletedPage,
      "Last completed page",
    ),
    duration_ms: duration,
  };
}

export function createErrorSummary(input: {
  code?: unknown;
  message: unknown;
  retryable: boolean;
  messageLimit?: number;
}): ErrorSummary {
  const sanitizedCode =
    input.code === null || input.code === undefined
      ? null
      : sanitizeObservabilityText(input.code, 80);

  return {
    code: sanitizedCode,
    message: sanitizeObservabilityText(
      input.message,
      input.messageLimit ?? DEFAULT_MESSAGE_LIMIT,
    ),
    retryable: input.retryable,
  };
}

export { DEFAULT_MESSAGE_LIMIT };
