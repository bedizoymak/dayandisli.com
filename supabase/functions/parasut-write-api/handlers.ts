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
