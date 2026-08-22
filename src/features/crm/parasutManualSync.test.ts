import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

const { runManualParasutSync } = await import("./parasutManualSync");

const NOW = () => new Date("2026-08-22T06:00:00.000Z");

function fullResyncResponse(overrides: Partial<Record<string, unknown>> = {}) {
  return {
    data: {
      status: "completed",
      startedAt: "2026-08-22T06:00:00.000Z",
      completedAt: "2026-08-22T06:00:30.000Z",
      conflictResource: null,
      resources: [
        { resource: "customers", status: "completed", chunks: 1, inserted: 2, updated: 1, unchanged: 440, errors: 0, hasMore: false },
        { resource: "sales_invoices", status: "completed", chunks: 9, inserted: 0, updated: 3, unchanged: 445, errors: 0, hasMore: false },
        { resource: "purchase_bills", status: "completed", chunks: 16, inserted: 0, updated: 0, unchanged: 811, errors: 0, hasMore: false },
        { resource: "checks", status: "completed", chunks: 1, inserted: 0, updated: 0, unchanged: 40, errors: 0, hasMore: false },
      ],
      ...overrides,
    },
    error: null,
  };
}

describe("runManualParasutSync", () => {
  it("calls parasut-write-api's full-resync action exactly once — no client-side loop", async () => {
    invoke.mockReset();
    invoke.mockResolvedValue(fullResyncResponse());
    await runManualParasutSync(NOW);
    expect(invoke).toHaveBeenCalledTimes(1);
    expect(invoke).toHaveBeenCalledWith("parasut-write-api", { body: { action: "full-resync" } });
  });

  it("21+22. surfaces each resource's accumulated multi-chunk totals from the server", async () => {
    invoke.mockReset();
    invoke.mockResolvedValue(fullResyncResponse());
    const summary = await runManualParasutSync(NOW);

    expect(summary.overallStatus).toBe("completed");
    expect(summary.resources).toHaveLength(4);
    const salesInvoices = summary.resources.find((r) => r.resource === "sales_invoices");
    expect(salesInvoices).toMatchObject({ status: "completed", chunks: 9, updated: 3, unchanged: 445 });
    const purchaseBills = summary.resources.find((r) => r.resource === "purchase_bills");
    expect(purchaseBills).toMatchObject({ chunks: 16, unchanged: 811 });
  });

  it("26. a resource still reporting hasMore is never surfaced as a fully completed overall sync", async () => {
    invoke.mockReset();
    invoke.mockResolvedValue(
      fullResyncResponse({
        status: "partial",
        resources: [
          { resource: "customers", status: "completed", chunks: 1, inserted: 0, updated: 0, unchanged: 442, errors: 0, hasMore: false },
          { resource: "sales_invoices", status: "partial", chunks: 20, inserted: 4, updated: 0, unchanged: 200, errors: 0, hasMore: true },
        ],
      }),
    );
    const summary = await runManualParasutSync(NOW);
    expect(summary.overallStatus).toBe("partial");
    expect(summary.resources[1]).toMatchObject({ status: "partial", hasMore: true });
  });

  it("24. surfaces a concurrency conflict distinctly, with the conflicting resource named", async () => {
    invoke.mockReset();
    invoke.mockResolvedValue(fullResyncResponse({ status: "conflict", conflictResource: "sales_invoices", resources: [] }));
    const summary = await runManualParasutSync(NOW);
    expect(summary.overallStatus).toBe("conflict");
    expect(summary.conflictResource).toBe("sales_invoices");
  });

  it("23. a 409 (concurrency conflict) HTTP error is treated as a conflict even without a parsed body", async () => {
    invoke.mockReset();
    invoke.mockResolvedValue({ data: null, error: { context: { status: 409 } } });
    const summary = await runManualParasutSync(NOW);
    expect(summary.overallStatus).toBe("conflict");
  });

  it("a network/edge-function failure is reported as a failed overall sync, never silently as completed", async () => {
    invoke.mockReset();
    invoke.mockResolvedValue({ data: null, error: { message: "network error" } });
    const summary = await runManualParasutSync(NOW);
    expect(summary.overallStatus).toBe("failed");
    expect(summary.resources).toHaveLength(0);
  });

  it("records start/completion timestamps from the server response", async () => {
    invoke.mockReset();
    invoke.mockResolvedValue(fullResyncResponse());
    const summary = await runManualParasutSync(NOW);
    expect(summary.startedAt).toBe("2026-08-22T06:00:00.000Z");
    expect(summary.completedAt).toBe("2026-08-22T06:00:30.000Z");
  });
});
