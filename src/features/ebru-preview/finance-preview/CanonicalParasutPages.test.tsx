import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { toast } from "sonner";
import { SyncButton, canonicalParasutPages } from "./CanonicalParasutPages";
import { callParasutWriteApi } from "@/features/erp/parasut/api/write-client";
import { useERPAuth } from "@/contexts/ERPAuthContext";

vi.mock("@/features/erp/parasut/api/write-client", () => ({ callParasutWriteApi: vi.fn() }));
vi.mock("@/contexts/ERPAuthContext", () => ({ useERPAuth: vi.fn() }));
vi.mock("sonner", () => ({ toast: { success: vi.fn(), error: vi.fn() } }));

const mockedCall = vi.mocked(callParasutWriteApi);
const mockedAuth = vi.mocked(useERPAuth);

function asAdmin() {
  mockedAuth.mockReturnValue({ roles: ["admin"] } as ReturnType<typeof useERPAuth>);
}
function asNonAdmin() {
  mockedAuth.mockReturnValue({ roles: ["sales"] } as ReturnType<typeof useERPAuth>);
}

function renderWithClient(ui: React.ReactElement) {
  const client = new QueryClient();
  const invalidateSpy = vi.spyOn(client, "invalidateQueries");
  const result = render(<QueryClientProvider client={client}>{ui}</QueryClientProvider>);
  return { ...result, client, invalidateSpy };
}

const customersConfig = canonicalParasutPages.customers;
const nonSyncableConfig = canonicalParasutPages.expenses; // resource: "bank_fees" — deliberately not in SYNCABLE_RESOURCES

describe("SyncButton", () => {
  it("is hidden for a non-admin user, even on a syncable resource", () => {
    asNonAdmin();
    const { container } = renderWithClient(<SyncButton config={customersConfig} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is hidden for an admin on a resource with no sync wrapper (e.g. bank_fees)", () => {
    asAdmin();
    const { container } = renderWithClient(<SyncButton config={nonSyncableConfig} />);
    expect(container).toBeEmptyDOMElement();
  });

  it("is visible for an admin on a syncable resource", () => {
    asAdmin();
    renderWithClient(<SyncButton config={customersConfig} />);
    expect(screen.getByRole("button", { name: /Senkronize Et/ })).toBeInTheDocument();
  });

  it("disables the button and shows a spinner while the request is in flight, and re-enables after", async () => {
    asAdmin();
    let resolveCall: (value: unknown) => void = () => {};
    mockedCall.mockReturnValueOnce(new Promise((resolve) => { resolveCall = resolve; }) as never);
    const user = userEvent.setup();
    renderWithClient(<SyncButton config={customersConfig} />);

    const button = screen.getByRole("button", { name: /Senkronize Et/ });
    await user.click(button);

    expect(screen.getByRole("button")).toBeDisabled();
    expect(screen.getByRole("button")).toHaveAttribute("aria-busy", "true");

    resolveCall({ data: { status: "completed", pages: 1, observed: 1, inserted: 0, updated: 0, unchanged: 1, errors: 0 }, error: null });
    await waitFor(() => expect(screen.getByRole("button")).not.toBeDisabled());
  });

  it("prevents a second concurrent click from issuing a second request", async () => {
    asAdmin();
    let resolveCall: (value: unknown) => void = () => {};
    mockedCall.mockReturnValueOnce(new Promise((resolve) => { resolveCall = resolve; }) as never);
    const user = userEvent.setup();
    renderWithClient(<SyncButton config={customersConfig} />);

    const button = screen.getByRole("button", { name: /Senkronize Et/ });
    await user.click(button);
    await user.click(button); // second click while disabled — should be a no-op
    await user.click(button);

    expect(mockedCall).toHaveBeenCalledTimes(1);
    resolveCall({ data: { status: "completed", pages: 1, observed: 1, inserted: 0, updated: 0, unchanged: 1, errors: 0 }, error: null });
  });

  it("calls resync with exactly the viewed resource, never a full sync", async () => {
    asAdmin();
    mockedCall.mockResolvedValueOnce({ data: { status: "completed", pages: 1, observed: 163, inserted: 2, updated: 5, unchanged: 156, errors: 0 }, error: null } as never);
    const user = userEvent.setup();
    renderWithClient(<SyncButton config={customersConfig} />);
    await user.click(screen.getByRole("button", { name: /Senkronize Et/ }));

    await waitFor(() => expect(mockedCall).toHaveBeenCalledWith("resync", { resource: "customers" }));
  });

  it("invalidates only this resource's list queries on success, with no page reload", async () => {
    asAdmin();
    mockedCall.mockResolvedValueOnce({ data: { status: "completed", pages: 1, observed: 163, inserted: 0, updated: 0, unchanged: 163, errors: 0 }, error: null } as never);
    const user = userEvent.setup();
    const { invalidateSpy } = renderWithClient(<SyncButton config={customersConfig} />);
    await user.click(screen.getByRole("button", { name: /Senkronize Et/ }));

    await waitFor(() => expect(invalidateSpy).toHaveBeenCalledWith({ queryKey: ["parasut", "list", "customers"] }));
  });

  it("shows a success message with the sync counters and archived count", async () => {
    asAdmin();
    mockedCall.mockResolvedValueOnce({
      data: { status: "completed", pages: 18, observed: 163, inserted: 0, updated: 1, unchanged: 162, errors: 0, reconciliation: { archivedCount: 1, skippedReason: null } },
      error: null,
    } as never);
    const user = userEvent.setup();
    renderWithClient(<SyncButton config={customersConfig} />);
    await user.click(screen.getByRole("button", { name: /Senkronize Et/ }));

    await waitFor(() =>
      expect(toast.success).toHaveBeenCalledWith("Senkronizasyon tamamlandı.", {
        description: "163 kayıt senkronize edildi. 1 arşivlendi. 0 hata.",
      }),
    );
  });

  it("shows the server's exact error message on failure", async () => {
    asAdmin();
    mockedCall.mockResolvedValueOnce({ data: null, error: "Bir senkronizasyon zaten devam ediyor." } as never);
    const user = userEvent.setup();
    renderWithClient(<SyncButton config={customersConfig} />);
    await user.click(screen.getByRole("button", { name: /Senkronize Et/ }));

    await waitFor(() =>
      expect(toast.error).toHaveBeenCalledWith("Senkronizasyon başarısız.", { description: "Bir senkronizasyon zaten devam ediyor." }),
    );
  });
});
