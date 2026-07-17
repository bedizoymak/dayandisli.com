// Tenant configuration shape for choosing/configuring the active accounting
// provider per ERP company. TYPE DEFINITIONS ONLY — no migration, no table,
// no database code. This is the target shape for a future `public.company_settings`
// row (see ACCOUNTING_PROVIDER_ARCHITECTURE.md "Tenant Settings" and
// ERP_BUSINESS_ARCHITECTURE.md's migration-safety convention: drafted schema
// belongs in docs/migration-proposals/ first, never written directly here).
//
// HARD RULE: this type, and the eventual table it describes, must never hold
// a credential/secret value (API keys, OAuth tokens, passwords). Provider
// credentials belong in environment variables / a secrets manager, exactly
// like PARASUT_CLIENT_SECRET does today — never in a queryable table. The
// `providerConfig` field below is for non-secret operational settings only
// (e.g. "which Paraşüt company id", "sync frequency preference"), and its
// doc comment says so explicitly to keep that rule visible at the point of use.

export interface CompanySettings {
  /** The ERP's own tenant id — same UUID as ERP_COMPANY_ID / erp_users.accessible_company_ids. */
  companyId: string;

  /** Must match a ProviderMetadata.id registered in the AccountingProviderRegistry (e.g. "parasut"). */
  activeAccountingProvider: string;

  /**
   * Non-secret, provider-specific operational configuration only — e.g. which
   * external company id within the provider to use, display preferences,
   * sync-frequency preference. NEVER a credential. Shape is intentionally
   * `Record<string, unknown>` here (each provider defines its own schema);
   * a real implementation should validate this against a per-provider Zod
   * schema before use, not trust it blindly.
   */
  providerConfig: Record<string, unknown>;

  /** ERP-level feature flags, independent of provider capabilities (e.g. "show forecast tab"). */
  featureFlags: Record<string, boolean>;

  updatedAt: string;
}

/**
 * What the ERP UI is allowed to show/enable for the active provider — the
 * intersection of what the provider CAN do (ProviderCapabilities, reported
 * by the provider itself) and what this tenant has CHOSEN to enable
 * (companySettings.featureFlags). Neither alone is sufficient: a capability
 * the provider doesn't support must never be shown regardless of feature
 * flags, and a flag can turn off a supported capability for a specific tenant.
 */
export interface EffectiveProviderCapabilities {
  providerId: string;
  accounts: boolean;
  contacts: boolean;
  products: boolean;
  salesInvoices: boolean;
  purchaseBills: boolean;
  payments: boolean;
  dashboard: boolean;
  reports: boolean;
  syncStatus: boolean;
}
