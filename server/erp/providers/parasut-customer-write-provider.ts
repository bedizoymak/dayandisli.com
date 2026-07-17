// ParasutCustomerWriteProvider — the ONLY class that grants
// CustomerWriteProvider capability for Paraşüt. Deliberately a separate
// class from ParasutAccountingProvider (the read-only provider) — never
// merged into it, so read-only dependents can never accidentally gain write
// access by depending on "the Paraşüt provider" generically. See
// ACCOUNTING_PROVIDER_ARCHITECTURE.md, BIDIRECTIONAL_CUSTOMER_CREATION_ARCHITECTURE.md,
// and PARASUT_WRITE_API_DISCOVERY_REPORT.md.
import { ProviderWriteError, type CreateCustomerInput, type CreateCustomerProviderResult, type CustomerWriteProvider, type ProviderWriteContext } from "./customer-write-provider.ts";
import { isKnownOutcomeError, ParasutWriteApiClientError, type ParasutContactCreateAttributes, type ParasutContactWriteClient } from "../../parasut/write-client.ts";

/** Every Paraşüt attribute this maps to is confirmed optional/required exactly per PARASUT_WRITE_API_DISCOVERY_REPORT.md's ContactAttributes section — nothing here is guessed. Fields with no Paraşüt equivalent (currency, paymentTermDays) are intentionally dropped — see doc comment below. */
export function toParasutContactAttributes(input: CreateCustomerInput): ParasutContactCreateAttributes {
  const attributes: ParasutContactCreateAttributes = {
    name: input.name,
    // This provider only ever creates customers, per Phase 007's explicit
    // scope (customer creation only — see DAYANDISLI_PHASE_SYSTEM.md §8.2
    // "Do not implement" list). account_type is never taken from caller input.
    account_type: "customer",
  };
  if (input.email) attributes.email = input.email;
  if (input.phone) attributes.phone = input.phone;
  if (input.taxNumber) attributes.tax_number = input.taxNumber;
  if (input.taxOffice) attributes.tax_office = input.taxOffice;
  if (input.city) attributes.city = input.city;
  if (input.district) attributes.district = input.district;
  if (input.address) attributes.address = input.address;
  // input.shortName, input.country, input.currency, input.paymentTermDays
  // have no confirmed corresponding ContactAttributes field in
  // PARASUT_WRITE_API_DISCOVERY_REPORT.md — Paraşüt's ContactAttributes has
  // `short_name` (confirmed, but not yet wired here to keep this mapping
  // minimal and match only what Phase 007 requires) and no `currency`/
  // `payment_term_days`/`country` field at all on contacts. Silently
  // dropping is safer than guessing a field name that doesn't exist.
  if (input.shortName) attributes.short_name = input.shortName;
  return attributes;
}

export class ParasutCustomerWriteProvider implements CustomerWriteProvider {
  constructor(
    private readonly client: ParasutContactWriteClient,
  ) {}

  async createCustomer(context: ProviderWriteContext, input: CreateCustomerInput): Promise<CreateCustomerProviderResult> {
    if (!input.name || !input.name.trim()) {
      throw new ProviderWriteError("Customer name is required.", true);
    }

    try {
      const attributes = toParasutContactAttributes(input);
      const created = await this.client.createContact(context.providerCompanyId, attributes);
      return {
        provider: "parasut",
        providerResourceType: "contacts",
        providerResourceId: created.id,
        providerCompanyId: context.providerCompanyId,
        createdAt: typeof created.attributes?.created_at === "string" ? (created.attributes.created_at as string) : null,
        rawStatus: 201,
      };
    } catch (error) {
      if (error instanceof ParasutWriteApiClientError) {
        if (!isKnownOutcomeError(error)) {
          // httpStatus === 0: no response was ever received (timeout/network
          // failure) — the create may or may not have actually happened on
          // Paraşüt's side. Must be surfaced as unknown, never as a
          // confirmed failure — see CreateCustomerCommandHandler's
          // unknown_result handling.
          throw new ProviderWriteError(error.message, false, true);
        }
        // 401/403 are configuration problems (not the user's fault);
        // everything else (400/404/422) is a validation-shaped error safe
        // to surface, per the confirmed error response format.
        const isValidationError = error.httpStatus !== 401 && error.httpStatus !== 403;
        const detail = error.errors.map((e) => e.detail || e.title).join("; ") || error.message;
        throw new ProviderWriteError(detail, isValidationError);
      }
      throw error;
    }
  }
}
