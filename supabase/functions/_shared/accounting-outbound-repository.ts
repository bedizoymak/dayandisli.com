// Supabase-backed implementations of CommandRepository/AttemptRepository/
// ProviderLinkRepository/AuditRepository (server/erp/commands/create-customer-command.ts),
// querying the proposed public.accounting_outbound_commands/_attempts/_provider_links
// tables (see docs/migration-proposals/20260716130000_accounting_outbound_commands.sql).
//
// These tables do not exist in production yet — this file is prepared code,
// not yet reachable by any deployed function, per DAYANDISLI_PHASE_SYSTEM_V3.md's
// "prepare everything required, do not perform the irreversible action" rule.
// Platform-agnostic (no Deno-specific imports), same convention as
// supabase/functions/parasut-api/handlers.ts, so it can be unit-tested
// directly with Vitest.
import type {
  AttemptRecord,
  AttemptRepository,
  AuditEvent,
  AuditRepository,
  CommandRepository,
  CreateCustomerCommandInput,
  CreateCustomerCommandRecord,
  CreateCustomerCommandStatus,
  ProviderLinkRepository,
} from "../../../server/erp/commands/create-customer-command.ts";

export interface DatabaseError {
  message: string;
  /** Postgres SQLSTATE, e.g. "23505" for a unique-violation — used only to detect the idempotency race below, never surfaced to a caller. */
  code?: string;
}

export interface DatabaseResult<T> {
  data: T | null;
  error: DatabaseError | null;
}

export interface SelectableQuery<T> extends PromiseLike<DatabaseResult<T[]>> {
  eq(column: string, value: unknown): SelectableQuery<T>;
  maybeSingle(): Promise<DatabaseResult<T>>;
}

export interface MutableTable<T> {
  select<R = T>(columns?: string): SelectableQuery<R>;
  insert(values: unknown): { select(columns?: string): { single(): Promise<DatabaseResult<T>> } };
  update(values: unknown): { eq(column: string, value: unknown): PromiseLike<{ error: { message: string } | null }> };
  upsert(values: unknown, options?: { onConflict?: string }): PromiseLike<{ error: { message: string } | null }>;
}

/** Minimal structural shape this file needs from the real Supabase admin client — same pattern as SupabaseAdminLike in supabase/functions/parasut-api/handlers.ts. */
export interface OutboundAdminLike {
  schema(name: "public"): { from<T = unknown>(table: string): MutableTable<T> };
}

interface CommandRow {
  id: string;
  company_id: string;
  provider: string;
  operation: string;
  resource_type: string;
  status: CreateCustomerCommandStatus;
  idempotency_key: string;
  requested_by: string;
  safe_payload: CreateCustomerCommandInput;
  provider_resource_id: string | null;
  verification_status: "pending" | "verified" | "failed" | null;
  mirror_status: "pending" | "mirrored" | null;
  error_code: string | null;
  error_message: string | null;
  created_at: string;
  updated_at: string;
}

function rowToRecord(row: CommandRow): CreateCustomerCommandRecord {
  return {
    id: row.id,
    companyId: row.company_id,
    provider: row.provider,
    operation: "create_customer",
    resourceType: "contacts",
    status: row.status,
    idempotencyKey: row.idempotency_key,
    requestedBy: row.requested_by,
    safePayload: row.safe_payload,
    providerResourceId: row.provider_resource_id,
    verificationStatus: row.verification_status,
    mirrorStatus: row.mirror_status,
    errorCode: row.error_code,
    errorMessage: row.error_message,
    createdAt: row.created_at,
    updatedAt: row.updated_at,
  };
}

/** Never carries a raw Postgres error message/detail — see findOrCreateCommand's unique-violation handling below. */
export class OutboundRepositoryError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "OutboundRepositoryError";
  }
}

const UNIQUE_VIOLATION = "23505";

const STATUS_TIMESTAMP_COLUMN: Partial<Record<CreateCustomerCommandStatus, string>> = {
  validated: "validated_at",
  sending: "sending_at",
  sent: "sent_at",
  verified_in_provider: "verified_at",
  mirrored_back: "mirrored_at",
  failed: "failed_at",
};

export class SupabaseCommandRepository implements CommandRepository {
  constructor(
    private readonly admin: OutboundAdminLike,
    private readonly now: () => Date = () => new Date(),
  ) {}

  private table() {
    return this.admin.schema("public").from<CommandRow>("accounting_outbound_commands");
  }

  async findOrCreateCommand(input: {
    companyId: string;
    provider: string;
    operation: "create_customer";
    resourceType: "contacts";
    idempotencyKey: string;
    requestedBy: string;
    safePayload: CreateCustomerCommandInput;
  }): Promise<{ record: CreateCustomerCommandRecord; wasCreated: boolean }> {
    const existing = await this.lookupByIdempotencyKey(input.companyId, input.provider, input.operation, input.idempotencyKey);
    if (existing.error) throw new OutboundRepositoryError("Failed to look up outbound command.");
    if (existing.data) return { record: rowToRecord(existing.data), wasCreated: false };

    // Relies on the migration's (company_id, provider, operation, idempotency_key)
    // unique constraint to make this race-safe under concurrent duplicate
    // submissions (§8.13 "concurrency protection is required"). A second
    // concurrent insert loses the race with a 23505 unique-violation — that
    // is expected and handled below by re-reading the winner's row, never by
    // weakening the constraint or exposing the raw Postgres error to the
    // caller. The provider is never called twice as a result: this method
    // only ever returns one winning row either way.
    const inserted = await this.table()
      .insert({
        company_id: input.companyId,
        provider: input.provider,
        operation: input.operation,
        resource_type: input.resourceType,
        status: "draft",
        idempotency_key: input.idempotencyKey,
        requested_by: input.requestedBy,
        safe_payload: input.safePayload,
      })
      .select("*")
      .single();

    if (inserted.data) return { record: rowToRecord(inserted.data), wasCreated: true };

    if (inserted.error?.code === UNIQUE_VIOLATION) {
      const winner = await this.lookupByIdempotencyKey(input.companyId, input.provider, input.operation, input.idempotencyKey);
      if (winner.data) return { record: rowToRecord(winner.data), wasCreated: false };
      throw new OutboundRepositoryError("Lost the idempotency race but could not find the winning command.");
    }

    throw new OutboundRepositoryError("Failed to create outbound command.");
  }

  private lookupByIdempotencyKey(companyId: string, provider: string, operation: string, idempotencyKey: string): Promise<DatabaseResult<CommandRow>> {
    return this.table()
      .select("*")
      .eq("company_id", companyId)
      .eq("provider", provider)
      .eq("operation", operation)
      .eq("idempotency_key", idempotencyKey)
      .maybeSingle();
  }

  async updateStatus(
    commandId: string,
    patch: Partial<Pick<CreateCustomerCommandRecord, "status" | "providerResourceId" | "verificationStatus" | "mirrorStatus" | "errorCode" | "errorMessage">>,
  ): Promise<void> {
    const values: Record<string, unknown> = { updated_at: this.now().toISOString() };
    if (patch.status !== undefined) {
      values.status = patch.status;
      const timestampColumn = STATUS_TIMESTAMP_COLUMN[patch.status];
      if (timestampColumn) values[timestampColumn] = this.now().toISOString();
    }
    if (patch.providerResourceId !== undefined) values.provider_resource_id = patch.providerResourceId;
    if (patch.verificationStatus !== undefined) values.verification_status = patch.verificationStatus;
    if (patch.mirrorStatus !== undefined) values.mirror_status = patch.mirrorStatus;
    if (patch.errorCode !== undefined) values.error_code = patch.errorCode;
    if (patch.errorMessage !== undefined) values.error_message = patch.errorMessage;

    const result = await this.table().update(values).eq("id", commandId);
    if (result.error) throw new Error(result.error.message);
  }
}

export class SupabaseAttemptRepository implements AttemptRepository {
  constructor(private readonly admin: OutboundAdminLike) {}

  async recordAttempt(attempt: AttemptRecord): Promise<void> {
    const result = await this.admin
      .schema("public")
      .from("accounting_outbound_attempts")
      .insert({
        command_id: attempt.commandId,
        attempt_number: attempt.attemptNumber,
        request_started_at: attempt.requestStartedAt,
        response_received_at: attempt.responseReceivedAt,
        http_status: attempt.httpStatus,
        safe_request_summary: attempt.safeRequestSummary,
        safe_response_summary: attempt.safeResponseSummary,
        provider_request_id: attempt.providerRequestId,
        error_class: attempt.errorClass,
        error_code: attempt.errorCode,
        error_message: attempt.errorMessage,
        result_classification: attempt.resultClassification,
      })
      .select("*")
      .single();
    if (!result.data) throw new Error("Failed to record outbound attempt.");
  }
}

export class SupabaseProviderLinkRepository implements ProviderLinkRepository {
  constructor(private readonly admin: OutboundAdminLike) {}

  async upsertLink(link: {
    companyId: string;
    provider: string;
    erpResourceType: "customer";
    erpResourceId: string;
    providerResourceType: "contacts";
    providerResourceId: string;
    outboundCommandId: string;
    verifiedAt: string | null;
    lastMirroredAt: string | null;
  }): Promise<void> {
    const result = await this.admin
      .schema("public")
      .from("accounting_provider_links")
      .upsert(
        {
          company_id: link.companyId,
          provider: link.provider,
          erp_resource_type: link.erpResourceType,
          erp_resource_id: link.erpResourceId,
          provider_resource_type: link.providerResourceType,
          provider_resource_id: link.providerResourceId,
          outbound_command_id: link.outboundCommandId,
          verified_at: link.verifiedAt,
          last_mirrored_at: link.lastMirroredAt,
        },
        { onConflict: "company_id,provider,erp_resource_type,erp_resource_id" },
      );
    if (result.error) throw new Error(result.error.message);
  }
}

/**
 * §8.8: outbound commands are never inserted by the frontend, and this audit
 * trail must never contain a secret (see server/erp/commands/audit-trail.ts's
 * redactForAudit(), applied by the caller BEFORE detail reaches this class —
 * this class does not re-redact, so callers must not bypass it).
 */
export class SupabaseAuditRepository implements AuditRepository {
  constructor(private readonly admin: OutboundAdminLike) {}

  async record(event: AuditEvent): Promise<void> {
    const result = await this.admin
      .schema("public")
      .from("accounting_audit_log")
      .insert({
        command_id: event.commandId,
        company_id: event.companyId,
        actor_user_id: event.actorUserId,
        action: event.action,
        detail: event.detail,
        occurred_at: event.occurredAt,
      })
      .select("*")
      .single();
    if (!result.data) throw new Error("Failed to record audit event.");
  }
}
