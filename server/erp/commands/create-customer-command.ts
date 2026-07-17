// CreateCustomerCommandHandler — the ONLY code path allowed to call
// CustomerWriteProvider.createCustomer. Owns the full durable command
// lifecycle, attempt log, provider-link, and audit trail required by
// DAYANDISLI_PHASE_SYSTEM.md Phase 007 §8.12-8.13.
//
// CRITICAL: this handler NEVER writes to parasut.contacts, directly or
// indirectly. It only ever reaches "verified_in_provider" on its own —
// the transition to "mirrored_back" is made by confirmMirrored(), which
// must only ever be called by (or after) a real contacts-only GET
// synchronization run confirms the new provider contact id is present in
// the mirror. This is the enforcement point for "the mirror can only be
// updated through the existing GET synchronization path" — see
// ACCOUNTING_PROVIDER_ARCHITECTURE.md.
import { ProviderWriteError, type CustomerWriteProvider } from "../providers/customer-write-provider.ts";
import { redactForAudit } from "./audit-trail.ts";

export type CreateCustomerCommandStatus = "draft" | "validated" | "sending" | "sent" | "verified_in_provider" | "mirrored_back" | "failed" | "unknown_result";

export interface CreateCustomerCommandInput {
  name: string;
  shortName?: string | null;
  email?: string | null;
  phone?: string | null;
  taxNumber?: string | null;
  taxOffice?: string | null;
  address?: string | null;
  district?: string | null;
  city?: string | null;
  country?: string | null;
  currency?: string | null;
  paymentTermDays?: number | null;
}

export interface CreateCustomerCommandRecord {
  id: string;
  companyId: string;
  provider: string;
  operation: "create_customer";
  resourceType: "contacts";
  status: CreateCustomerCommandStatus;
  idempotencyKey: string;
  requestedBy: string;
  safePayload: CreateCustomerCommandInput;
  providerResourceId: string | null;
  verificationStatus: "pending" | "verified" | "failed" | null;
  mirrorStatus: "pending" | "mirrored" | null;
  errorCode: string | null;
  errorMessage: string | null;
  createdAt: string;
  updatedAt: string;
}

export interface CommandRepository {
  /** Must enforce the (companyId, provider, operation, idempotencyKey) unique constraint — see docs/migration-proposals/20260716120000_erp_outbound_commands.sql. Returns the EXISTING record (not a new one) when a command with the same key already exists for this company+provider+operation, per §8.13's idempotency requirement. */
  findOrCreateCommand(record: {
    companyId: string;
    provider: string;
    operation: "create_customer";
    resourceType: "contacts";
    idempotencyKey: string;
    requestedBy: string;
    safePayload: CreateCustomerCommandInput;
  }): Promise<{ record: CreateCustomerCommandRecord; wasCreated: boolean }>;
  updateStatus(
    commandId: string,
    patch: Partial<Pick<CreateCustomerCommandRecord, "status" | "providerResourceId" | "verificationStatus" | "mirrorStatus" | "errorCode" | "errorMessage">>,
  ): Promise<void>;
}

export interface AttemptRecord {
  commandId: string;
  attemptNumber: number;
  requestStartedAt: string;
  responseReceivedAt: string | null;
  httpStatus: number | null;
  safeRequestSummary: Record<string, unknown>;
  safeResponseSummary: Record<string, unknown>;
  providerRequestId: string | null;
  errorClass: string | null;
  errorCode: string | null;
  errorMessage: string | null;
  resultClassification: "success" | "validation_error" | "config_error" | "unknown_outcome" | null;
}

export interface AttemptRepository {
  recordAttempt(attempt: AttemptRecord): Promise<void>;
}

export interface ProviderLinkRepository {
  /** Creates (or, if one already exists for this exact erp/provider resource pair, updates) the durable mapping from the ERP-originated resource to the real provider resource. */
  upsertLink(link: {
    companyId: string;
    provider: string;
    erpResourceType: "customer";
    erpResourceId: string;
    providerResourceType: "contacts";
    providerResourceId: string;
    outboundCommandId: string;
    verifiedAt: string | null;
    lastMirroredAt: string | null;
  }): Promise<void>;
}

export interface AuditEvent {
  commandId: string;
  companyId: string;
  actorUserId: string;
  action: "command_created" | "validated" | "sending" | "sent" | "verified_in_provider" | "mirrored_back" | "failed" | "unknown_result" | "idempotent_replay";
  /** Must already be redacted before this is called — see redactForAudit() in audit-trail.ts. Never pass a raw provider response or raw error object here. */
  detail: Record<string, unknown>;
  occurredAt: string;
}

export interface AuditRepository {
  record(event: AuditEvent): Promise<void>;
}

/**
 * GET-verifies the exact contact Paraşüt returned, per §8.14: id, resource
 * type, name, account_type, and provider company must all match. Injected
 * rather than hard-imported so this handler stays provider-neutral — a
 * ParasutContactVerifier implementation lives alongside
 * ParasutCustomerWriteProvider.
 */
export interface ProviderVerifier {
  verifyContact(providerCompanyId: string, providerResourceId: string, expectedName: string): Promise<boolean>;
}

/**
 * Runs the contacts-only GET synchronization and reports whether
 * providerResourceId now exists in parasut.contacts for this company. Never
 * a full sync — see §8.15.
 */
export interface ContactsOnlySync {
  syncAndCheck(companyId: string, providerCompanyId: string, providerResourceId: string): Promise<boolean>;
}

/** Returns a list of human-readable problems, empty when valid. Pure — no I/O. */
export function validateCreateCustomerInput(input: CreateCustomerCommandInput): string[] {
  const errors: string[] = [];
  if (!input.name || !input.name.trim()) errors.push("Müşteri adı zorunludur.");
  if (input.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(input.email)) errors.push("E-posta adresi geçersiz.");
  if (input.paymentTermDays !== undefined && input.paymentTermDays !== null && input.paymentTermDays < 0) errors.push("Vade günü negatif olamaz.");
  return errors;
}

export class CreateCustomerCommandHandler {
  constructor(
    private readonly commands: CommandRepository,
    private readonly attempts: AttemptRepository,
    private readonly links: ProviderLinkRepository,
    private readonly audit: AuditRepository,
    private readonly writeProvider: CustomerWriteProvider,
    private readonly verifier: ProviderVerifier,
    private readonly contactsSync: ContactsOnlySync,
    private readonly now: () => Date = () => new Date(),
  ) {}

  async handle(companyId: string, providerCompanyId: string, requestedBy: string, idempotencyKey: string, input: CreateCustomerCommandInput): Promise<CreateCustomerCommandRecord> {
    const { record: command, wasCreated } = await this.commands.findOrCreateCommand({
      companyId,
      provider: "parasut",
      operation: "create_customer",
      resourceType: "contacts",
      idempotencyKey,
      requestedBy,
      safePayload: input,
    });

    // Idempotency (§8.13): the same key must NEVER create a second customer
    // or send another POST — return the existing state as-is.
    if (!wasCreated) {
      await this.audit.record({ commandId: command.id, companyId, actorUserId: requestedBy, action: "idempotent_replay", detail: { existingStatus: command.status }, occurredAt: this.now().toISOString() });
      return command;
    }

    await this.audit.record({ commandId: command.id, companyId, actorUserId: requestedBy, action: "command_created", detail: redactForAudit({ input }), occurredAt: this.now().toISOString() });

    const validationErrors = validateCreateCustomerInput(input);
    if (validationErrors.length > 0) {
      await this.commands.updateStatus(command.id, { status: "failed", errorMessage: validationErrors.join(" ") });
      await this.audit.record({ commandId: command.id, companyId, actorUserId: requestedBy, action: "failed", detail: { reason: "validation_failed", errors: validationErrors }, occurredAt: this.now().toISOString() });
      return { ...command, status: "failed", errorMessage: validationErrors.join(" ") };
    }

    await this.commands.updateStatus(command.id, { status: "validated" });
    await this.audit.record({ commandId: command.id, companyId, actorUserId: requestedBy, action: "validated", detail: {}, occurredAt: this.now().toISOString() });

    await this.commands.updateStatus(command.id, { status: "sending" });
    await this.audit.record({ commandId: command.id, companyId, actorUserId: requestedBy, action: "sending", detail: {}, occurredAt: this.now().toISOString() });

    const requestStartedAt = this.now().toISOString();
    try {
      const result = await this.writeProvider.createCustomer(
        { companyId, providerCompanyId, requestedByUserId: requestedBy, idempotencyKey, commandId: command.id },
        input,
      );

      await this.attempts.recordAttempt({
        commandId: command.id,
        attemptNumber: 1,
        requestStartedAt,
        responseReceivedAt: this.now().toISOString(),
        httpStatus: result.rawStatus,
        safeRequestSummary: redactForAudit({ operation: "create_customer" }),
        safeResponseSummary: redactForAudit({ providerResourceId: result.providerResourceId }),
        providerRequestId: null,
        errorClass: null,
        errorCode: null,
        errorMessage: null,
        resultClassification: "success",
      });

      // Persist the provider ID immediately (§8.12 step 14) — even if
      // everything after this fails, the command must never lose track of
      // the real record it just created.
      await this.commands.updateStatus(command.id, { status: "sent", providerResourceId: result.providerResourceId });
      await this.audit.record({ commandId: command.id, companyId, actorUserId: requestedBy, action: "sent", detail: { providerResourceId: result.providerResourceId }, occurredAt: this.now().toISOString() });

      const verified = await this.verifier.verifyContact(providerCompanyId, result.providerResourceId, input.name);
      if (!verified) {
        // §8.14: GET verification failed — preserve the provider ID, never
        // create another customer, do not mark mirrored_back.
        await this.commands.updateStatus(command.id, { status: "unknown_result", verificationStatus: "failed" });
        await this.audit.record({ commandId: command.id, companyId, actorUserId: requestedBy, action: "unknown_result", detail: { reason: "get_verification_failed", providerResourceId: result.providerResourceId }, occurredAt: this.now().toISOString() });
        return { ...command, status: "unknown_result", providerResourceId: result.providerResourceId, verificationStatus: "failed" };
      }

      await this.commands.updateStatus(command.id, { status: "verified_in_provider", verificationStatus: "verified" });
      await this.audit.record({ commandId: command.id, companyId, actorUserId: requestedBy, action: "verified_in_provider", detail: { providerResourceId: result.providerResourceId }, occurredAt: this.now().toISOString() });

      // §8.15: contacts-only sync, never a full sync.
      const mirrored = await this.contactsSync.syncAndCheck(companyId, providerCompanyId, result.providerResourceId);
      if (!mirrored) {
        await this.commands.updateStatus(command.id, { status: "unknown_result", mirrorStatus: "pending" });
        await this.audit.record({ commandId: command.id, companyId, actorUserId: requestedBy, action: "unknown_result", detail: { reason: "contacts_sync_did_not_find_record", providerResourceId: result.providerResourceId }, occurredAt: this.now().toISOString() });
        return { ...command, status: "unknown_result", providerResourceId: result.providerResourceId, verificationStatus: "verified", mirrorStatus: "pending" };
      }

      return this.finalizeMirrored(command, companyId, requestedBy, result.providerResourceId);
    } catch (error) {
      return this.handleWriteFailure(command, companyId, requestedBy, error, requestStartedAt);
    }
  }

  private async handleWriteFailure(
    command: CreateCustomerCommandRecord,
    companyId: string,
    requestedBy: string,
    error: unknown,
    requestStartedAt: string,
  ): Promise<CreateCustomerCommandRecord> {
    const isProviderError = error instanceof ProviderWriteError;
    const message = isProviderError ? error.message : "Sağlayıcı isteği beklenmeyen bir şekilde başarısız oldu.";
    const isUnknownOutcome = isProviderError && error.isUnknownOutcome;

    await this.attempts.recordAttempt({
      commandId: command.id,
      attemptNumber: 1,
      requestStartedAt,
      responseReceivedAt: isUnknownOutcome ? null : this.now().toISOString(),
      httpStatus: null,
      safeRequestSummary: redactForAudit({ operation: "create_customer" }),
      safeResponseSummary: {},
      providerRequestId: null,
      errorClass: isProviderError ? "ProviderWriteError" : "UnexpectedError",
      errorCode: null,
      errorMessage: redactForAudit(message),
      resultClassification: isUnknownOutcome ? "unknown_outcome" : isProviderError && error.isValidationError ? "validation_error" : "config_error",
    });

    if (isUnknownOutcome) {
      // §8.13: uncertain outcome — never retry automatically, never mark
      // failed (Paraşüt may have actually created the contact).
      await this.commands.updateStatus(command.id, { status: "unknown_result", errorMessage: message });
      await this.audit.record({ commandId: command.id, companyId, actorUserId: requestedBy, action: "unknown_result", detail: redactForAudit({ reason: "provider_request_outcome_unknown", message }), occurredAt: this.now().toISOString() });
      return { ...command, status: "unknown_result", errorMessage: message };
    }

    await this.commands.updateStatus(command.id, { status: "failed", errorMessage: message });
    await this.audit.record({ commandId: command.id, companyId, actorUserId: requestedBy, action: "failed", detail: redactForAudit({ reason: message }), occurredAt: this.now().toISOString() });
    return { ...command, status: "failed", errorMessage: message };
  }

  private async finalizeMirrored(command: CreateCustomerCommandRecord, companyId: string, requestedBy: string, providerResourceId: string): Promise<CreateCustomerCommandRecord> {
    const nowIso = this.now().toISOString();
    await this.links.upsertLink({
      companyId,
      provider: "parasut",
      erpResourceType: "customer",
      erpResourceId: command.id,
      providerResourceType: "contacts",
      providerResourceId,
      outboundCommandId: command.id,
      verifiedAt: nowIso,
      lastMirroredAt: nowIso,
    });
    await this.commands.updateStatus(command.id, { status: "mirrored_back", mirrorStatus: "mirrored" });
    await this.audit.record({ commandId: command.id, companyId, actorUserId: requestedBy, action: "mirrored_back", detail: { providerResourceId }, occurredAt: nowIso });
    return { ...command, status: "mirrored_back", providerResourceId, verificationStatus: "verified", mirrorStatus: "mirrored" };
  }
}
