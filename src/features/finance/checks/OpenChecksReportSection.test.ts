import { describe, expect, it, vi } from "vitest";

const listChecks = vi.hoisted(() => vi.fn());
vi.mock("./checksApi", () => ({ listChecks }));

const { fetchAllOpenChecks } = await import("./OpenChecksReportSection");

describe("fetchAllOpenChecks", () => {
  it("paginates the real open direction-specific result instead of truncating a report at 100", async () => {
    listChecks
      .mockResolvedValueOnce({
        ok: true,
        data: { rows: [{ id: "erp:first" }], total: 101, page: 1, pageSize: 100, latestSyncAt: null },
      })
      .mockResolvedValueOnce({
        ok: true,
        data: { rows: [{ id: "parasut:last" }], total: 101, page: 2, pageSize: 100, latestSyncAt: null },
      });

    const result = await fetchAllOpenChecks("issued");

    expect(result).toEqual({ ok: true, data: [{ id: "erp:first" }, { id: "parasut:last" }] });
    expect(listChecks).toHaveBeenNthCalledWith(1, {
      page: 1,
      pageSize: 100,
      filters: { direction: "issued", openOnly: true },
    });
    expect(listChecks).toHaveBeenNthCalledWith(2, {
      page: 2,
      pageSize: 100,
      filters: { direction: "issued", openOnly: true },
    });
  });
});
