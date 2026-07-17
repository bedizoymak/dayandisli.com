// CustomerWriteProvider — the ONLY write-capable contract in the ERP
// business layer, and it grants exactly one capability: creating a
// customer. This is deliberate and narrow (per DAYANDISLI_PHASE_SYSTEM.md
// Phase 007's explicit instruction not to add generic unrestricted write
// access) — a provider implementing AccountingProvider does NOT
// automatically get write access; it must separately implement this
// interface, and a caller must separately hold a reference to it. See
// ACCOUNTING_PROVIDER_ARCHITECTURE.md, BIDIRECTIONAL_CUSTOMER_CREATION_ARCHITECTURE.md,
// and PARASUT_WRITE_API_DISCOVERY_REPORT.md for the confirmed real contract
// this is modeled on. Field names match DAYANDISLI_PHASE_SYSTEM.md §8.4 exactly.
export interface ProviderWriteContext {
  /** The ERP tenant this write is scoped to. */
  companyId: string;
  /** The external provider's own company/tenant identifier (e.g. Paraşüt's numeric company id) — never confused with companyId, same rule as SyncContext elsewhere in this codebase. */
  providerCompanyId: string;
  /** The authenticated ERP user who initiated this write — required for the audit trail, never optional. */
  requestedByUserId: string;
  /** Caller-supplied (or handler-generated) idempotency key — see accounting_outbound_commands' unique constraint in the migration proposal. */
  idempotencyKey: string;
  /** The durable outbound command id this call is scoped to. */
  commandId: string;
}

export interface CreateCustomerInput {
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

export interface CreateCustomerProviderResult {
  provider: string;
  providerResourceType: "contacts";
  providerResourceId: string;
  providerCompanyId: string;
  createdAt?: string | null;
  rawStatus: number;
}

export class ProviderWriteError extends Error {
  constructor(
    message: string,
    /** True when the underlying provider signaled this was a validation/client error (safe to show the user) vs. an unexpected/transient failure. */
    public readonly isValidationError: boolean,
    /** True when the request's outcome could not be determined (e.g. a timeout with no response) — the caller must treat this as `unknown_result`, never as a confirmed failure, and must never retry automatically. */
    public readonly isUnknownOutcome: boolean = false,
  ) {
    super(message);
    this.name = "ProviderWriteError";
  }
}

export interface CustomerWriteProvider {
  createCustomer(context: ProviderWriteContext, input: CreateCustomerInput): Promise<CreateCustomerProviderResult>;
}
