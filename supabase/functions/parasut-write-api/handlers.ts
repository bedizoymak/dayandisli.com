// Platform-agnostic handler logic for the parasut-write-api Edge Function —
// deliberately a SEPARATE function from parasut-api (which has its own test,
// client.test.ts, asserting zero write methods exist in its source). This
// keeps that invariant permanently true and confines all write capability to
// one small, auditable surface. See DAYANDISLI_PHASE_SYSTEM_V3.md §8.16 and
// BIDIRECTIONAL_CUSTOMER_CREATION_ARCHITECTURE.md.
//
// No Deno-specific imports — unit-testable directly with Vitest, same
// convention as supabase/functions/parasut-api/handlers.ts.
import { CreateCustomerCommandHandler, type CreateCustomerCommandInput, type CreateCustomerCommandRecord } from "../../../server/erp/commands/create-customer-command.ts";
import type { ProviderCapabilities } from "../../../server/erp/providers/accounting-provider.ts";
import { SyncAlreadyRunningError, type ReconciliationOutcome, type SyncResult } from "../../../server/parasut/types.ts";

export interface CreateCustomerRequestBody {
  input: CreateCustomerCommandInput;
  idempotencyKey: string;
  confirmation: true;
}

export interface CreateCustomerSafeResponse {
  commandId: string;
  status: string;
  provider: string;
  providerResourceId?: string;
  mirroredParasutId?: string;
  message: string;
}

export class CreateCustomerRejectedError extends Error {
  constructor(
    message: string,
    public readonly httpStatus: number,
  ) {
    super(message);
    this.name = "CreateCustomerRejectedError";
  }
}

function isPlainObject(value: unknown): value is Record<string, unknown> {
  return typeof value === "object" && value !== null && !Array.isArray(value);
}

/** Structural validation only (shape/required fields) — business-rule validation (name required, email format, etc.) happens inside CreateCustomerCommandHandler itself, per §8.12 step 7, so it is not duplicated here. */
export function parseCreateCustomerRequestBody(body: unknown): CreateCustomerRequestBody {
  if (!isPlainObject(body)) throw new CreateCustomerRejectedError("Geçersiz istek gövdesi.", 400);
  if (body.confirmation !== true) throw new CreateCustomerRejectedError("Onay (confirmation) alanı true olmalıdır.", 400);
  if (typeof body.idempotencyKey !== "string" || !body.idempotencyKey.trim()) throw new CreateCustomerRejectedError("idempotencyKey zorunludur.", 400);
  const input = body.input;
  if (!isPlainObject(input) || typeof input.name !== "string") throw new CreateCustomerRejectedError("input.name zorunludur.", 400);
  return { input: input as unknown as CreateCustomerCommandInput, idempotencyKey: body.idempotencyKey, confirmation: true };
}

export function toSafeResponse(record: CreateCustomerCommandRecord): CreateCustomerSafeResponse {
  const messages: Record<string, string> = {
    draft: "Talep kaydedildi.",
    validated: "Talep doğrulandı.",
    sending: "Paraşüt'e gönderiliyor.",
    sent: "Paraşüt'e gönderildi, doğrulanıyor.",
    verified_in_provider: "Paraşüt'te doğrulandı, aynaya senkronize ediliyor.",
    mirrored_back: "Müşteri başarıyla oluşturuldu ve ERP'ye yansıdı.",
    failed: record.errorMessage ?? "İşlem başarısız oldu.",
    unknown_result: "Sonuç doğrulanamadı — operatör incelemesi gerekiyor. Kayıt Paraşüt'te oluşmuş olabilir; tekrar denemeyin.",
  };
  return {
    commandId: record.id,
    status: record.status,
    provider: record.provider,
    providerResourceId: record.providerResourceId ?? undefined,
    mirroredParasutId: record.status === "mirrored_back" ? (record.providerResourceId ?? undefined) : undefined,
    message: messages[record.status] ?? "Durum bilinmiyor.",
  };
}

export interface CreateCustomerGuardInput {
  hasPermission: boolean;
  featureFlagEnabled: boolean;
  capabilities: ProviderCapabilities;
}

export interface CustomerCreateAvailabilityInput {
  authenticated: boolean;
  companyScopeOk: boolean;
  hasPermission: boolean;
  featureFlagEnabled: boolean;
  capabilities: ProviderCapabilities;
}

export interface CustomerCreateAvailabilityResponse {
  available: boolean;
}

/**
 * Read-only availability check for the "Yeni Müşteri" UI action — performs
 * no Paraşüt HTTP request and requires no PARASUT_* credential (see
 * DAYANDISLI_PHASE_SYSTEM_V3.md §8.17's UI-availability-guard requirement).
 * Returns only the single safe boolean the frontend needs; never exposes
 * which specific gate failed, the feature-flag name, or any configuration
 * detail — that would let an unauthorized caller probe internal state.
 */
export function computeCustomerCreateAvailability(input: CustomerCreateAvailabilityInput): CustomerCreateAvailabilityResponse {
  return {
    available: input.authenticated && input.companyScopeOk && input.hasPermission && input.featureFlagEnabled && input.capabilities.contacts.create,
  };
}

/** §8.16 "Reject when: ... user unauthorized, feature flag disabled, provider capability disabled" — checked in this exact order so the safe response always reflects the FIRST reason, never a partial/ambiguous combination. */
export function assertCreateCustomerAllowed(guard: CreateCustomerGuardInput): void {
  if (!guard.hasPermission) throw new CreateCustomerRejectedError("Bu işlem için 'accounting.contacts.create' yetkisi gereklidir.", 403);
  if (!guard.featureFlagEnabled) throw new CreateCustomerRejectedError("Müşteri yazma özelliği şu anda devre dışı (ACCOUNTING_WRITE_ENABLED=false).", 403);
  if (!guard.capabilities.contacts.create) throw new CreateCustomerRejectedError("Aktif sağlayıcı müşteri oluşturmayı desteklemiyor.", 403);
}

export interface ResyncContactsResponse {
  status: SyncResult["status"];
  pages: number;
  observed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: number;
  reconciliation?: ReconciliationOutcome;
  /** True when this resource wasn't fully traversed yet — the caller must invoke resync again (same resource) to continue. */
  hasMore: boolean;
  /** True when this invocation continued from a prior partial/interrupted run's checkpoint instead of starting at page 1. */
  resumed: boolean;
  /** Pages fetched by this invocation only. */
  pagesProcessedThisInvocation: number;
  /** Pages fetched across this logical run's whole resume chain, including earlier invocations. */
  totalPagesProcessed: number;
  /** Suggested delay (seconds) before the caller invokes resync again when hasMore is true. */
  resumeAfterSeconds?: number;
}

/**
 * Runs ONLY the existing GET synchronization for one resource
 * (server/parasut/sync-*.ts, called with concurrencyLock: true) and returns
 * its outcome. Never sends anything to Paraşüt, never touches any other
 * resource, never bypasses ACCOUNTING_WRITE_ENABLED-gated write logic
 * (there is none here) — this is a read+mirror-reconcile operation, not a
 * provider write, so it is deliberately NOT gated by the accounting-write
 * feature flag. `hasPermission` must reflect ERP-admin specifically (see
 * index.ts's `resolveAccess` — this is intentionally stricter than the
 * broader 'accounting.contacts.create' permission customer creation
 * accepts, per this feature's own "only ERP administrators" requirement).
 * Backs the manual "Sync" button on every Paraşüt-backed ERP list page —
 * always synchronizes only the resource the button was clicked from, never
 * a full sync.
 *
 * Concurrency: does NOT pre-check "is a sync already running" itself — a
 * separate check-then-act step here would just move the same race
 * (Codex review, 2026-07-23) to a different layer. The actual mutual
 * exclusion happens inside syncCollection's post-insert election (see
 * server/parasut/sync-base.ts's enforceSingleRunner); this function only
 * needs to translate a lost election (SyncAlreadyRunningError) into the
 * user-facing 409.
 */
export async function handleResync(
  hasPermission: boolean,
  runSync: () => Promise<SyncResult>,
): Promise<ResyncContactsResponse> {
  if (!hasPermission) throw new CreateCustomerRejectedError("Bu işlem için ERP yöneticisi yetkisi gereklidir.", 403);
  let result: SyncResult;
  try {
    result = await runSync();
  } catch (error) {
    if (error instanceof SyncAlreadyRunningError) {
      throw new CreateCustomerRejectedError("Bir senkronizasyon zaten devam ediyor.", 409);
    }
    throw error;
  }
  return {
    status: result.status,
    pages: result.pages,
    observed: result.observed,
    inserted: result.inserted,
    updated: result.updated,
    unchanged: result.unchanged,
    errors: result.errors,
    reconciliation: result.reconciliation,
    hasMore: result.hasMore,
    resumed: result.resumed,
    pagesProcessedThisInvocation: result.pagesThisInvocation,
    totalPagesProcessed: result.totalPagesProcessed,
    ...(result.hasMore ? { resumeAfterSeconds: 1 } : {}),
  };
}

export interface FullResyncResourceOutcome {
  resource: string;
  status: "completed" | "partial" | "failed";
  /** How many bounded resync chunks this resource took in this invocation — each chunk is one syncCollection() call, same page-budget-per-call behavior as the single-resource manual button. */
  chunks: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: number;
  /** True when the resource's own page budget across ALL chunks in this invocation still wasn't enough — the next full-resync click continues it (its own checkpoint is unaffected; nothing is lost). */
  hasMore: boolean;
}

export interface FullResyncResponse {
  status: "completed" | "partial" | "failed" | "conflict";
  startedAt: string;
  completedAt: string;
  resources: FullResyncResourceOutcome[];
  /** Set only when status === "conflict" — a sync (scheduled or another manual run) was already in progress for this resource, so the whole run stopped immediately rather than racing it. */
  conflictResource: string | null;
}

export interface FullResyncResourceRunner {
  resource: string;
  runSync: () => Promise<SyncResult>;
}

export interface FullResyncOptions {
  /** Safety limit #1: stop resuming a resource after this many chunks in one invocation — bounds worst-case work per HTTP request regardless of how large the resource is. */
  maxChunksPerResource?: number;
  /** Safety limit #2: stop starting new chunks once this much wall-clock time has elapsed since the run started — bounds total invocation time independent of chunk count, so this can never itself become the thing that times out the edge function. */
  maxElapsedMs?: number;
  now?: () => Date;
}

const DEFAULT_MAX_CHUNKS_PER_RESOURCE = 20;
const DEFAULT_MAX_ELAPSED_MS = 90_000;

/**
 * Full one-way Paraşüt -> Supabase synchronization across every
 * account-statement-relevant resource, each resumed to completion (not just
 * one bounded chunk) within this single invocation's safety limits. Reuses
 * the exact same server/parasut/sync-*.ts engine as handleResync — no
 * competing sync engine, no Paraşüt write call anywhere in this path.
 *
 * Per resource: calls `runSync()` repeatedly (same concurrencyLock: true
 * single-runner election as the manual per-resource button) until
 * `result.hasMore === false`, `result.status === "failed"`, a
 * SyncAlreadyRunningError, or a safety limit is hit — accumulating
 * inserted/updated/unchanged/errors across every chunk so the caller sees
 * the TOTAL work done, not just the last chunk's. A resource that still has
 * `hasMore: true` when a safety limit is hit is reported "partial", never
 * "completed" — its own checkpoint is untouched, so the next full-resync
 * (or the scheduled cron) simply continues it.
 *
 * A SyncAlreadyRunningError (another run — scheduled or manual — already
 * holds this resource's single-runner election) stops the ENTIRE sequence
 * immediately, not just that resource: racing a concurrent run resource by
 * resource would be a false economy, since the whole point is one
 * coherent, non-overlapping pass.
 */
export async function handleFullResync(
  hasPermission: boolean,
  resources: readonly FullResyncResourceRunner[],
  options: FullResyncOptions = {},
): Promise<FullResyncResponse> {
  if (!hasPermission) throw new CreateCustomerRejectedError("Bu işlem için ERP yöneticisi yetkisi gereklidir.", 403);

  const now = options.now ?? (() => new Date());
  const maxChunks = options.maxChunksPerResource ?? DEFAULT_MAX_CHUNKS_PER_RESOURCE;
  const maxElapsedMs = options.maxElapsedMs ?? DEFAULT_MAX_ELAPSED_MS;
  const startedAt = now();

  const outcomes: FullResyncResourceOutcome[] = [];
  let conflictResource: string | null = null;

  for (const { resource, runSync } of resources) {
    const totals = { inserted: 0, updated: 0, unchanged: 0, errors: 0 };
    let chunks = 0;
    let status: FullResyncResourceOutcome["status"] = "completed";
    let hasMore = false;

    try {
      for (;;) {
        if (now().getTime() - startedAt.getTime() >= maxElapsedMs) {
          status = "partial";
          hasMore = true;
          break;
        }
        chunks += 1;
        const result = await runSync();
        totals.inserted += result.inserted;
        totals.updated += result.updated;
        totals.unchanged += result.unchanged;
        totals.errors += result.errors;

        if (result.status === "failed") {
          status = "failed";
          hasMore = result.hasMore;
          break;
        }
        if (!result.hasMore) {
          status = result.errors > 0 ? "partial" : "completed";
          hasMore = false;
          break;
        }
        if (chunks >= maxChunks) {
          status = "partial";
          hasMore = true;
          break;
        }
      }
    } catch (error) {
      if (error instanceof SyncAlreadyRunningError) {
        conflictResource = resource;
        break;
      }
      status = "failed";
      hasMore = true;
    }

    outcomes.push({ resource, status, chunks, ...totals, hasMore });
    if (conflictResource) break;
  }

  const completedAt = now();
  const overallStatus: FullResyncResponse["status"] = conflictResource
    ? "conflict"
    : outcomes.length === 0
      ? "failed"
      : outcomes.every((outcome) => outcome.status === "completed")
        ? "completed"
        : outcomes.every((outcome) => outcome.status === "failed")
          ? "failed"
          : "partial";

  return {
    status: overallStatus,
    startedAt: startedAt.toISOString(),
    completedAt: completedAt.toISOString(),
    resources: outcomes,
    conflictResource,
  };
}

export async function handleCreateCustomer(
  handler: CreateCustomerCommandHandler,
  companyId: string,
  providerCompanyId: string,
  requestedBy: string,
  guard: CreateCustomerGuardInput,
  rawBody: unknown,
): Promise<CreateCustomerSafeResponse> {
  assertCreateCustomerAllowed(guard);
  const body = parseCreateCustomerRequestBody(rawBody);
  const record = await handler.handle(companyId, providerCompanyId, requestedBy, body.idempotencyKey, body.input);
  return toSafeResponse(record);
}
