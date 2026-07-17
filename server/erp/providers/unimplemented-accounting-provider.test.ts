import { describe, expect, it } from "vitest";
import { ProviderNotImplementedError } from "./unimplemented-accounting-provider.ts";
import { LogoAccountingProvider } from "./logo-accounting-provider.ts";
import { MikroAccountingProvider } from "./mikro-accounting-provider.ts";
import { NetsisAccountingProvider } from "./netsis-accounting-provider.ts";
import { SAPBusinessOneAccountingProvider } from "./sap-business-one-accounting-provider.ts";
import { LucaAccountingProvider } from "./luca-accounting-provider.ts";
import { ETAAccountingProvider } from "./eta-accounting-provider.ts";
import type { AccountingProvider } from "./accounting-provider.ts";

const skeletons: Array<{ id: string; make: () => AccountingProvider }> = [
  { id: "logo", make: () => new LogoAccountingProvider() },
  { id: "mikro", make: () => new MikroAccountingProvider() },
  { id: "netsis", make: () => new NetsisAccountingProvider() },
  { id: "sap_business_one", make: () => new SAPBusinessOneAccountingProvider() },
  { id: "luca", make: () => new LucaAccountingProvider() },
  { id: "eta", make: () => new ETAAccountingProvider() },
];

describe.each(skeletons)("$id skeleton provider", ({ id, make }) => {
  it("reports its own metadata id and no supported capabilities", () => {
    const provider = make();
    expect(provider.getMetadata().id).toBe(id);
    const capabilities = provider.getCapabilities();
    expect(Object.values(capabilities.contacts).every((value) => value === false)).toBe(true);
    expect(
      Object.entries(capabilities)
        .filter(([key]) => key !== "contacts")
        .every(([, value]) => value === false),
    ).toBe(true);
  });

  it("reports unhealthy without throwing", async () => {
    const provider = make();
    const health = await provider.getHealthStatus();
    expect(health.healthy).toBe(false);
  });

  it("throws a typed ProviderNotImplementedError for every data-access capability, never returns fabricated empty data", async () => {
    const provider = make();
    await expect(provider.getAccounts()).rejects.toBeInstanceOf(ProviderNotImplementedError);
    await expect(provider.getCustomerProfile("x")).rejects.toBeInstanceOf(ProviderNotImplementedError);
    await expect(provider.getSupplierProfile("x")).rejects.toBeInstanceOf(ProviderNotImplementedError);
    await expect(provider.getProduct("x")).rejects.toBeInstanceOf(ProviderNotImplementedError);
    await expect(provider.getAllReceivableDocuments()).rejects.toBeInstanceOf(ProviderNotImplementedError);
    await expect(provider.getAllPayableDocuments()).rejects.toBeInstanceOf(ProviderNotImplementedError);
    await expect(provider.getDashboardSnapshot()).rejects.toBeInstanceOf(ProviderNotImplementedError);
    await expect(provider.getReportsSnapshot()).rejects.toBeInstanceOf(ProviderNotImplementedError);
    await expect(provider.getSyncStatus()).rejects.toBeInstanceOf(ProviderNotImplementedError);
  });
});
