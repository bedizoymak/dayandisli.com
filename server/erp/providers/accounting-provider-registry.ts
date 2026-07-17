// AccountingProviderRegistry — registers concrete providers by id and
// resolves the tenant's active one. This is the ONLY place in the ERP
// business layer allowed to hold references to multiple concrete providers
// at once; ERP Services never see it — they receive one already-resolved
// AccountingProvider via constructor injection. See
// ACCOUNTING_PROVIDER_ARCHITECTURE.md "Provider Registration".
import type { AccountingProvider, ProviderCapabilities, ProviderMetadata } from "./accounting-provider.ts";

export class UnknownProviderError extends Error {
  constructor(providerId: string) {
    super(`No accounting provider is registered with id "${providerId}".`);
    this.name = "UnknownProviderError";
  }
}

export class AccountingProviderRegistry {
  private readonly providers = new Map<string, AccountingProvider>();

  register(provider: AccountingProvider): void {
    this.providers.set(provider.getMetadata().id, provider);
  }

  /** Throws UnknownProviderError rather than returning undefined — a caller resolving "the active provider" must never silently fall through to no provider at all. */
  resolve(providerId: string): AccountingProvider {
    const provider = this.providers.get(providerId);
    if (!provider) throw new UnknownProviderError(providerId);
    return provider;
  }

  has(providerId: string): boolean {
    return this.providers.has(providerId);
  }

  listMetadata(): ProviderMetadata[] {
    return Array.from(this.providers.values())
      .map((provider) => provider.getMetadata())
      .sort((a, b) => a.id.localeCompare(b.id));
  }

  getCapabilities(providerId: string): ProviderCapabilities {
    return this.resolve(providerId).getCapabilities();
  }
}
