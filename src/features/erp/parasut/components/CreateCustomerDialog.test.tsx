import { describe, expect, it, vi } from "vitest";
import { render, screen, waitFor, within } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { CreateCustomerDialog } from "./CreateCustomerDialog";
import { callParasutWriteApi } from "../api/write-client";
import { useERPAuth } from "@/contexts/ERPAuthContext";

vi.mock("../api/write-client", () => ({ callParasutWriteApi: vi.fn() }));
vi.mock("@/contexts/ERPAuthContext", () => ({ useERPAuth: vi.fn() }));

const mockedCall = vi.mocked(callParasutWriteApi);
const mockedAuth = vi.mocked(useERPAuth);

function allowPermission() {
  mockedAuth.mockReturnValue({ hasPermission: () => true } as ReturnType<typeof useERPAuth>);
}

/**
 * The dialog now calls two distinct actions: the read-only
 * "customer-create-availability" check on mount, and "create-customer" on
 * submit. `mockedCall.mockResolvedValueOnce` can't distinguish between them
 * (it consumes in call order regardless of args), so this dispatches by
 * action name instead — the availability check always answers from
 * `available` (the server-side gate itself is covered in handlers.test.ts),
 * and every "create-customer" call is answered by a queue each test can push
 * onto via `queueCreateCustomerResponse`.
 */
let createCustomerResponses: unknown[] = [];
function queueCreateCustomerResponse(response: unknown) {
  createCustomerResponses.push(response);
}
function mockAvailability(available = true) {
  createCustomerResponses = [];
  mockedCall.mockImplementation(async (action: string) => {
    if (action === "customer-create-availability") return { data: { available }, error: null } as never;
    if (action === "create-customer") {
      if (createCustomerResponses.length === 0) throw new Error("no queued create-customer response — call queueCreateCustomerResponse first");
      return (createCustomerResponses.length > 1 ? createCustomerResponses.shift() : createCustomerResponses[0]) as never;
    }
    throw new Error(`unmocked action in test: ${action}`);
  });
}

async function openDialogAndFillName(name = "Acme Co") {
  const user = userEvent.setup();
  await screen.findByRole("button", { name: "Yeni Müşteri" });
  await user.click(screen.getByRole("button", { name: "Yeni Müşteri" }));
  await user.type(screen.getByLabelText(/Ad \/ Ünvan/), name);
  await user.click(screen.getByRole("checkbox"));
  return user;
}

describe("CreateCustomerDialog", () => {
  it("renders nothing when the user lacks accounting.contacts.create", () => {
    mockedAuth.mockReturnValue({ hasPermission: () => false } as ReturnType<typeof useERPAuth>);
    const { container } = render(<CreateCustomerDialog />);
    expect(container).toBeEmptyDOMElement();
  });

  it("renders nothing while the server availability check has not yet resolved, and nothing when it resolves unavailable", async () => {
    allowPermission();
    mockAvailability(false);
    const { container } = render(<CreateCustomerDialog />);
    expect(container).toBeEmptyDOMElement();
    await waitFor(() => expect(mockedCall).toHaveBeenCalledWith("customer-create-availability"));
    expect(container).toBeEmptyDOMElement();
  });

  it("shows the confirmation checkbox with the exact required text, and disables submit until it and the name are both provided", async () => {
    allowPermission();
    mockAvailability(true);
    const user = userEvent.setup();
    render(<CreateCustomerDialog />);
    await screen.findByRole("button", { name: "Yeni Müşteri" });
    await user.click(screen.getByRole("button", { name: "Yeni Müşteri" }));

    expect(screen.getByText("Bu müşterinin Paraşüt hesabında gerçek bir cari kaydı olarak oluşturulacağını onaylıyorum.")).toBeInTheDocument();
    expect(screen.getByRole("button", { name: "Oluştur" })).toBeDisabled();

    await user.type(screen.getByLabelText(/Ad \/ Ünvan/), "Acme Co");
    expect(screen.getByRole("button", { name: "Oluştur" })).toBeDisabled(); // still unconfirmed

    await user.click(screen.getByRole("checkbox"));
    expect(screen.getByRole("button", { name: "Oluştur" })).not.toBeDisabled();
  });

  it("shows a loading state while the request is in flight", async () => {
    allowPermission();
    mockAvailability(true);
    let resolveCreate: (value: unknown) => void = () => {};
    render(<CreateCustomerDialog />);
    const user = await openDialogAndFillName();
    mockedCall.mockImplementationOnce(async (action: string) => {
      if (action === "customer-create-availability") return { data: { available: true }, error: null } as never;
      return new Promise((resolve) => { resolveCreate = resolve; }) as never;
    });
    await user.click(screen.getByRole("button", { name: "Oluştur" }));

    expect(screen.getByText("Gönderiliyor...")).toBeInTheDocument();
    resolveCreate({ data: { commandId: "cmd-1", status: "mirrored_back", provider: "parasut", providerResourceId: "1", mirroredParasutId: "1", message: "Müşteri başarıyla oluşturuldu ve ERP'ye yansıdı." }, error: null });
    await waitFor(() => expect(screen.queryByText("Gönderiliyor...")).not.toBeInTheDocument());
  });

  it("shows the success state for mirrored_back", async () => {
    allowPermission();
    mockAvailability(true);
    queueCreateCustomerResponse({ data: { commandId: "cmd-1", status: "mirrored_back", provider: "parasut", providerResourceId: "1", mirroredParasutId: "1", message: "Müşteri başarıyla oluşturuldu ve ERP'ye yansıdı." }, error: null });

    render(<CreateCustomerDialog />);
    const user = await openDialogAndFillName();
    await user.click(screen.getByRole("button", { name: "Oluştur" }));

    expect(await screen.findByText("Başarılı")).toBeInTheDocument();
    expect(screen.getByText("Müşteri başarıyla oluşturuldu ve ERP'ye yansıdı.")).toBeInTheDocument();
  });

  it("shows the unknown-result warning distinctly from success or failure", async () => {
    allowPermission();
    mockAvailability(true);
    queueCreateCustomerResponse({ data: { commandId: "cmd-1", status: "unknown_result", provider: "parasut", providerResourceId: "1", message: "Sonuç doğrulanamadı — operatör incelemesi gerekiyor. Kayıt Paraşüt'te oluşmuş olabilir; tekrar denemeyin." }, error: null });

    render(<CreateCustomerDialog />);
    const user = await openDialogAndFillName();
    await user.click(screen.getByRole("button", { name: "Oluştur" }));

    expect(await screen.findByText("Sonuç Doğrulanamadı")).toBeInTheDocument();
  });

  it("shows a partial-verification state for an in-progress (not yet mirrored) status", async () => {
    allowPermission();
    mockAvailability(true);
    queueCreateCustomerResponse({ data: { commandId: "cmd-1", status: "verified_in_provider", provider: "parasut", providerResourceId: "1", message: "Paraşüt'te doğrulandı, aynaya senkronize ediliyor." }, error: null });

    render(<CreateCustomerDialog />);
    const user = await openDialogAndFillName();
    await user.click(screen.getByRole("button", { name: "Oluştur" }));

    expect(await screen.findByText("İşlem Devam Ediyor")).toBeInTheDocument();
  });

  it("shows the failure state and lets the user retry without losing the idempotency key", async () => {
    allowPermission();
    mockAvailability(true);
    queueCreateCustomerResponse({ data: null, error: "Müşteri yazma özelliği şu anda devre dışı (ACCOUNTING_WRITE_ENABLED=false)." });

    render(<CreateCustomerDialog />);
    const user = await openDialogAndFillName();
    await user.click(screen.getByRole("button", { name: "Oluştur" }));

    expect(await screen.findByText("Hata")).toBeInTheDocument();
    expect(screen.getByText("Müşteri yazma özelliği şu anda devre dışı (ACCOUNTING_WRITE_ENABLED=false).")).toBeInTheDocument();

    // Retry re-uses the same idempotencyKey (first argument's idempotencyKey field is stable across calls).
    queueCreateCustomerResponse({ data: { commandId: "cmd-1", status: "mirrored_back", provider: "parasut", providerResourceId: "1", mirroredParasutId: "1", message: "ok" }, error: null });
    await user.click(screen.getByRole("button", { name: "Oluştur" }));
    const createCustomerCalls = () => mockedCall.mock.calls.filter(([action]) => action === "create-customer");
    await waitFor(() => expect(createCustomerCalls()).toHaveLength(2));
    const [firstCallParams] = createCustomerCalls()[0].slice(1) as [Record<string, unknown>];
    const [secondCallParams] = createCustomerCalls()[1].slice(1) as [Record<string, unknown>];
    expect(firstCallParams.idempotencyKey).toBe(secondCallParams.idempotencyKey);
  });

  it("never renders a secret/token-like string anywhere in the DOM", async () => {
    allowPermission();
    mockAvailability(true);
    queueCreateCustomerResponse({ data: { commandId: "cmd-1", status: "mirrored_back", provider: "parasut", providerResourceId: "1", mirroredParasutId: "1", message: "ok" }, error: null });
    const { container } = render(<CreateCustomerDialog />);
    const user = await openDialogAndFillName();
    await user.click(screen.getByRole("button", { name: "Oluştur" }));
    await screen.findByText("Başarılı");
    expect(container.innerHTML).not.toMatch(/bearer|sb_secret_|service_role/i);
  });
});
