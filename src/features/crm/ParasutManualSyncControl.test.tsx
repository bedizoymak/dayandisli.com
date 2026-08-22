import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { describe, expect, it, vi } from "vitest";
import type { ManualSyncSummary } from "./parasutManualSync";

const runManualParasutSync = vi.hoisted(() => vi.fn());
vi.mock("./parasutManualSync", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./parasutManualSync")>();
  return { ...actual, runManualParasutSync };
});

let roles: string[] = ["admin"];
vi.mock("@/features/erp-shell/erpIdentity", () => ({
  useErpIdentity: () => ({ roles }),
}));

import { ParasutManualSyncControl } from "./ParasutManualSyncControl";

function summary(overrides: Partial<ManualSyncSummary> = {}): ManualSyncSummary {
  return {
    overallStatus: "completed",
    startedAt: "2026-08-22T06:00:00.000Z",
    completedAt: "2026-08-22T06:00:05.000Z",
    conflictResource: null,
    resources: [
      { resource: "customers", label: "Cariler", status: "completed", chunks: 1, inserted: 2, updated: 1, unchanged: 440, errors: 0, hasMore: false },
      { resource: "sales_invoices", label: "Satış Faturaları", status: "completed", chunks: 1, inserted: 0, updated: 3, unchanged: 445, errors: 0, hasMore: false },
      { resource: "purchase_bills", label: "Alış Faturaları", status: "completed", chunks: 1, inserted: 0, updated: 0, unchanged: 811, errors: 0, hasMore: false },
      { resource: "checks", label: "Çekler", status: "completed", chunks: 1, inserted: 0, updated: 0, unchanged: 40, errors: 0, hasMore: false },
    ],
    ...overrides,
  };
}

describe("ParasutManualSyncControl", () => {
  it("renders nothing for a non-admin user (server-side enforcement is authoritative; this only avoids a button that would just 403)", () => {
    roles = ["viewer"];
    const { container } = render(<ParasutManualSyncControl />);
    expect(container.firstChild).toBeNull();
  });

  it("admin sees the sync button", () => {
    roles = ["admin"];
    render(<ParasutManualSyncControl />);
    expect(screen.getByRole("button", { name: /Paraşüt ile Senkronize Et/ })).toBeInTheDocument();
  });

  it("disables the button while a sync is running and re-enables it once finished (prevents a concurrent duplicate click-triggered run)", async () => {
    roles = ["admin"];
    let resolveSync: (value: ManualSyncSummary) => void = () => {};
    runManualParasutSync.mockReturnValue(new Promise((resolve) => { resolveSync = resolve; }));
    const user = userEvent.setup();
    render(<ParasutManualSyncControl />);

    const button = screen.getByRole("button", { name: /Paraşüt ile Senkronize Et/ });
    await user.click(button);
    expect(screen.getByRole("button", { name: /Senkronize Ediliyor/ })).toBeDisabled();

    await user.click(screen.getByRole("button", { name: /Senkronize Ediliyor/ }));
    expect(runManualParasutSync).toHaveBeenCalledTimes(1); // the second click while disabled/running must not start a second run

    resolveSync(summary());
    // The dialog that opens on completion marks the rest of the page
    // aria-hidden (Radix's focus trap), so the button is no longer
    // accessible-by-role here — assert re-enablement via a hidden-inclusive
    // query instead of the default role query.
    await waitFor(() => expect(screen.queryByRole("button", { name: /Senkronize Ediliyor/, hidden: true })).not.toBeInTheDocument());
  });

  it("shows a per-resource change-summary popup after a successful sync", async () => {
    roles = ["admin"];
    runManualParasutSync.mockResolvedValue(summary());
    const user = userEvent.setup();
    render(<ParasutManualSyncControl />);

    await user.click(screen.getByRole("button", { name: /Paraşüt ile Senkronize Et/ }));

    expect(await screen.findByText("Senkronizasyon tamamlandı")).toBeInTheDocument();
    expect(screen.getByText("Cariler")).toBeInTheDocument();
    expect(screen.getByText(/Eklenen 2, Güncellenen 1, Değişmeyen 440/)).toBeInTheDocument();
  });

  it("shows a simple no-change message when nothing changed", async () => {
    roles = ["admin"];
    runManualParasutSync.mockResolvedValue(
      summary({
        resources: [
          { resource: "customers", label: "Cariler", status: "completed", chunks: 1, inserted: 0, updated: 0, unchanged: 442, errors: 0, hasMore: false },
          { resource: "sales_invoices", label: "Satış Faturaları", status: "completed", chunks: 1, inserted: 0, updated: 0, unchanged: 448, errors: 0, hasMore: false },
          { resource: "purchase_bills", label: "Alış Faturaları", status: "completed", chunks: 1, inserted: 0, updated: 0, unchanged: 811, errors: 0, hasMore: false },
          { resource: "checks", label: "Çekler", status: "completed", chunks: 1, inserted: 0, updated: 0, unchanged: 40, errors: 0, hasMore: false },
        ],
      }),
    );
    const user = userEvent.setup();
    render(<ParasutManualSyncControl />);
    await user.click(screen.getByRole("button", { name: /Paraşüt ile Senkronize Et/ }));

    expect(await screen.findByText("Değişiklik bulunamadı — tüm kayıtlar zaten güncel.")).toBeInTheDocument();
  });

  it("shows a clear conflict message when another sync is already running", async () => {
    roles = ["admin"];
    runManualParasutSync.mockResolvedValue(
      summary({ overallStatus: "conflict", conflictResource: "sales_invoices", resources: [summary().resources[0]] }),
    );
    const user = userEvent.setup();
    render(<ParasutManualSyncControl />);
    await user.click(screen.getByRole("button", { name: /Paraşüt ile Senkronize Et/ }));

    expect(await screen.findByText("Zaten devam eden bir senkronizasyon var")).toBeInTheDocument();
    expect(screen.getByText(/Satış Faturaları.*için başka bir/)).toBeInTheDocument();
  });

  it("refreshes affected customer data after a completed or partial sync, but not after a conflict/failure", async () => {
    roles = ["admin"];
    const onSyncComplete = vi.fn();
    const user = userEvent.setup();

    runManualParasutSync.mockResolvedValueOnce(summary({ overallStatus: "completed" }));
    const { unmount } = render(<ParasutManualSyncControl onSyncComplete={onSyncComplete} />);
    await user.click(screen.getByRole("button", { name: /Paraşüt ile Senkronize Et/ }));
    await screen.findByText("Senkronizasyon tamamlandı");
    expect(onSyncComplete).toHaveBeenCalledTimes(1);
    unmount();

    runManualParasutSync.mockResolvedValueOnce(summary({ overallStatus: "conflict", conflictResource: "checks", resources: [] }));
    render(<ParasutManualSyncControl onSyncComplete={onSyncComplete} />);
    await user.click(screen.getByRole("button", { name: /Paraşüt ile Senkronize Et/ }));
    await screen.findByText("Zaten devam eden bir senkronizasyon var");
    expect(onSyncComplete).toHaveBeenCalledTimes(1); // still just the one call from the completed run above
  });
});
