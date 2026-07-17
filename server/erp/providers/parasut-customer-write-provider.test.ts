import { describe, expect, it } from "vitest";
import { ParasutCustomerWriteProvider, toParasutContactAttributes } from "./parasut-customer-write-provider.ts";
import { ParasutWriteApiClientError, type ParasutContactCreateResponse, type ParasutContactWriteClient } from "../../parasut/write-client.ts";
import { ProviderWriteError, type ProviderWriteContext } from "./customer-write-provider.ts";

const CONTEXT: ProviderWriteContext = {
  companyId: "54b50745-89e0-4b97-adb6-4f2426fa2a2f",
  providerCompanyId: "666034",
  requestedByUserId: "user-1",
  idempotencyKey: "idem-1",
  commandId: "cmd-1",
};

describe("toParasutContactAttributes", () => {
  it("always sets account_type to customer, regardless of what's in the input, since this provider only creates customers", () => {
    expect(toParasutContactAttributes({ name: "Acme" }).account_type).toBe("customer");
  });

  it("maps only the provided optional fields, omitting the rest", () => {
    expect(toParasutContactAttributes({ name: "Acme", email: "a@b.com" })).toEqual({ name: "Acme", account_type: "customer", email: "a@b.com" });
  });

  it("maps every field with a confirmed Paraşüt equivalent when provided", () => {
    const attrs = toParasutContactAttributes({
      name: "Acme",
      shortName: "ACME",
      email: "a@b.com",
      phone: "0555",
      taxNumber: "1234567890",
      taxOffice: "Kadıköy",
      city: "İstanbul",
      district: "Kadıköy",
      address: "Test Sk. No:1",
    });
    expect(attrs).toEqual({
      name: "Acme",
      account_type: "customer",
      short_name: "ACME",
      email: "a@b.com",
      phone: "0555",
      tax_number: "1234567890",
      tax_office: "Kadıköy",
      city: "İstanbul",
      district: "Kadıköy",
      address: "Test Sk. No:1",
    });
  });

  it("silently drops fields with no confirmed Paraşüt contact attribute (country, currency, paymentTermDays)", () => {
    const attrs = toParasutContactAttributes({ name: "Acme", country: "TR", currency: "TRY", paymentTermDays: 30 });
    expect(attrs).toEqual({ name: "Acme", account_type: "customer" });
  });
});

describe("ParasutCustomerWriteProvider.createCustomer", () => {
  it("rejects a blank name before ever calling the write client", async () => {
    let called = false;
    const client: ParasutContactWriteClient = { createContact: async () => { called = true; return { id: "x", type: "contacts", attributes: {} }; } };
    const provider = new ParasutCustomerWriteProvider(client);

    await expect(provider.createCustomer(CONTEXT, { name: "   " })).rejects.toBeInstanceOf(ProviderWriteError);
    expect(called).toBe(false);
  });

  it("returns a provider-neutral result with the real provider contact id, never a raw Paraşüt payload", async () => {
    const response: ParasutContactCreateResponse = { id: "1010689999", type: "contacts", attributes: { name: "Acme", created_at: "2026-07-16T00:00:00.000Z" } };
    const client: ParasutContactWriteClient = { createContact: async () => response };
    const provider = new ParasutCustomerWriteProvider(client);

    const result = await provider.createCustomer(CONTEXT, { name: "Acme" });
    expect(result).toEqual({
      provider: "parasut",
      providerResourceType: "contacts",
      providerResourceId: "1010689999",
      providerCompanyId: "666034",
      createdAt: "2026-07-16T00:00:00.000Z",
      rawStatus: 201,
    });
    expect(result).not.toHaveProperty("raw");
    expect(result).not.toHaveProperty("attributes");
  });

  it("passes the context's providerCompanyId through to the client", async () => {
    let seenCompanyId: string | null = null;
    const client: ParasutContactWriteClient = {
      createContact: async (companyId) => {
        seenCompanyId = companyId;
        return { id: "1", type: "contacts", attributes: {} };
      },
    };
    const provider = new ParasutCustomerWriteProvider(client);
    await provider.createCustomer(CONTEXT, { name: "Acme" });
    expect(seenCompanyId).toBe("666034");
  });

  it("wraps a 422 validation error from Paraşüt as a safe-to-show ProviderWriteError", async () => {
    const client: ParasutContactWriteClient = {
      createContact: async () => {
        throw new ParasutWriteApiClientError("failed", 422, [{ title: "Invalid", detail: "tax_number is invalid" }]);
      },
    };
    const provider = new ParasutCustomerWriteProvider(client);

    await expect(provider.createCustomer(CONTEXT, { name: "Acme" })).rejects.toMatchObject({ isValidationError: true, isUnknownOutcome: false, message: "tax_number is invalid" });
  });

  it("wraps a 401 from Paraşüt as a non-validation error (a configuration problem, not the user's fault)", async () => {
    const client: ParasutContactWriteClient = {
      createContact: async () => {
        throw new ParasutWriteApiClientError("unauthorized", 401, [{ title: "Unauthorized", detail: "bad token" }]);
      },
    };
    const provider = new ParasutCustomerWriteProvider(client);
    await expect(provider.createCustomer(CONTEXT, { name: "Acme" })).rejects.toMatchObject({ isValidationError: false, isUnknownOutcome: false });
  });

  it("wraps a timeout/no-response failure (httpStatus 0) as an unknown-outcome error, never a confirmed failure", async () => {
    const client: ParasutContactWriteClient = {
      createContact: async () => {
        throw new ParasutWriteApiClientError("timed out", 0, []);
      },
    };
    const provider = new ParasutCustomerWriteProvider(client);
    await expect(provider.createCustomer(CONTEXT, { name: "Acme" })).rejects.toMatchObject({ isUnknownOutcome: true });
  });
});
