// Shared audit-safety helper. Any code about to persist an AuditEvent.detail
// object derived from a raw provider response or error MUST pass it through
// redactForAudit() first — this is the one place that rule is enforced and
// tested, rather than trusting every call site to remember.
const SECRET_KEY_PATTERN = /token|secret|password|authorization|credential|api[_-]?key/i;
const BEARER_PATTERN = /Bearer\s+\S+/gi;
const SB_SECRET_PATTERN = /sb_secret_\S+/gi;

function redactString(value: string): string {
  return value.replace(BEARER_PATTERN, "Bearer [REDACTED]").replace(SB_SECRET_PATTERN, "[REDACTED]");
}

/**
 * Deep-redacts an arbitrary object before it is allowed into the audit
 * trail: any object key that looks credential-shaped (token/secret/password/
 * authorization/credential/api_key, case-insensitive) has its value replaced
 * outright; any string value anywhere else still gets scanned for a literal
 * `Bearer <token>` or `sb_secret_...` pattern and redacted in place. Errs
 * toward over-redacting — a false positive (redacting a non-secret field
 * named e.g. "password_reset_requested_at") is an acceptable cost for an
 * audit trail that must never leak a real credential.
 */
export function redactForAudit<T>(value: T): T {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") return redactString(value) as unknown as T;
  if (Array.isArray(value)) return value.map((item) => redactForAudit(item)) as unknown as T;
  if (typeof value === "object") {
    const result: Record<string, unknown> = {};
    for (const [key, entryValue] of Object.entries(value as Record<string, unknown>)) {
      result[key] = SECRET_KEY_PATTERN.test(key) ? "[REDACTED]" : redactForAudit(entryValue);
    }
    return result as unknown as T;
  }
  return value;
}
