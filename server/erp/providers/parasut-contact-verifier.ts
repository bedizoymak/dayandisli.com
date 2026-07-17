// ParasutContactVerifier — implements ProviderVerifier for Paraşüt by
// reusing the EXISTING read-only ParaşütClient (server/parasut/client.ts),
// never the write client. This is a GET-only operation, per
// DAYANDISLI_PHASE_SYSTEM.md §8.14 — it must never be able to mutate anything.
import type { ProviderVerifier } from "../commands/create-customer-command.ts";

export interface MinimalParasutReadClient {
  get(path: string): Promise<{ data: { id: string; type: string; attributes: Record<string, unknown> } | null }>;
}

export class ParasutContactVerifier implements ProviderVerifier {
  constructor(private readonly client: MinimalParasutReadClient) {}

  async verifyContact(providerCompanyId: string, providerResourceId: string, expectedName: string): Promise<boolean> {
    try {
      const document = await this.client.get(`/v4/${encodeURIComponent(providerCompanyId)}/contacts/${encodeURIComponent(providerResourceId)}`);
      const contact = document.data;
      if (!contact) return false;
      if (contact.id !== providerResourceId) return false;
      if (contact.type !== "contacts") return false;
      if (contact.attributes.account_type !== "customer") return false;
      if (contact.attributes.name !== expectedName) return false;
      return true;
    } catch {
      // A verification failure (network error, 404, etc.) is reported as
      // "not verified", never thrown — the caller (CreateCustomerCommandHandler)
      // treats an unverified result as unknown_result, never as a crash.
      return false;
    }
  }
}
