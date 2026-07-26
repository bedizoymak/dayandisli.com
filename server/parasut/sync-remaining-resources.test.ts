import { describe, expect, it, vi } from "vitest";
import { syncEInvoices } from "./sync-e-invoices.ts";
import { syncEmployees } from "./sync-employees.ts";
import { syncSalesOffers } from "./sync-sales-offers.ts";
import { syncShipmentDocuments } from "./sync-shipment-documents.ts";
import { syncWarehouses } from "./sync-warehouses.ts";
import * as syncBase from "./sync-base.ts";
import type { SyncContext } from "./types.ts";

// Config-correctness checks for the 5 newly-added sync entry points, mirroring
// the existing sync-*.ts convention: each wrapper is a thin, declared-type-only
// syncCollection configuration. This does not call the Paraşüt API or a
// database — syncCollection itself is mocked out so only the wrapper's own
// argument construction is under test.

const context: SyncContext = {
  companyId: "company-A",
  parasutCompanyId: "666034",
} as SyncContext;

describe("newly-added sync entry points — declared-resource-type-only configuration", () => {
  it.each([
    { fn: syncEInvoices, resourceType: "e_invoices", table: "e_invoices" },
    { fn: syncEmployees, resourceType: "employees", table: "employees" },
    { fn: syncSalesOffers, resourceType: "sales_offers", table: "sales_offers" },
    { fn: syncShipmentDocuments, resourceType: "shipment_documents", table: "shipment_documents" },
    { fn: syncWarehouses, resourceType: "warehouses", table: "warehouses" },
  ])("$resourceType: syncCollection is invoked with the correct static resourceType, table, and endpoint (no payload-derived identifiers)", async ({ fn, resourceType, table }) => {
    const spy = vi.spyOn(syncBase, "syncCollection").mockResolvedValue({
      resourceType,
      pagesProcessed: 0,
      recordsUpserted: 0,
      recordsArchived: 0,
      outcome: "completed",
    } as unknown as Awaited<ReturnType<typeof syncBase.syncCollection>>);

    await fn(context);

    expect(spy).toHaveBeenCalledTimes(1);
    const [, config] = spy.mock.calls[0];
    expect(config.resourceType).toBe(resourceType);
    expect(config.table).toBe(table);
    expect(config.endpoint).toBe(`/v4/666034/${resourceType}`);
    expect(config.reconcile).toBeUndefined(); // fail-closed: no deletion-detection confirmed for these resources
    expect(typeof config.maxPagesPerInvocation).toBe("number");
    expect(config.maxPagesPerInvocation).toBeGreaterThan(0);

    spy.mockRestore();
  });
});
