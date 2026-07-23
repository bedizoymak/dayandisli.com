import { describe, expect, it, vi } from "vitest";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

// Imported after the mock so callParasutWriteApi picks up the mocked client.
const { callParasutWriteApi } = await import("./write-client.ts");

function jsonResponse(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), { status, headers: { "content-type": "application/json" } });
}

describe("callParasutWriteApi", () => {
  it("returns data unchanged on success", async () => {
    invoke.mockResolvedValueOnce({ data: { status: "completed", observed: 163 }, error: null });
    const result = await callParasutWriteApi<{ status: string; observed: number }>("resync", { resource: "customers" });
    expect(result).toEqual({ data: { status: "completed", observed: 163 }, error: null });
  });

  it("extracts the Edge Function's own error message from a non-2xx response instead of the generic supabase-js message", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: jsonResponse({ error: "Bir senkronizasyon zaten devam ediyor." }, 409),
      },
    });
    const result = await callParasutWriteApi("resync", { resource: "customers" });
    expect(result).toEqual({ data: null, error: "Bir senkronizasyon zaten devam ediyor." });
  });

  it("falls back to the generic supabase-js message when the response body isn't the expected JSON shape", async () => {
    invoke.mockResolvedValueOnce({
      data: null,
      error: {
        name: "FunctionsHttpError",
        message: "Edge Function returned a non-2xx status code",
        context: new Response("not json", { status: 500 }),
      },
    });
    const result = await callParasutWriteApi("resync", { resource: "customers" });
    expect(result).toEqual({ data: null, error: "Edge Function returned a non-2xx status code" });
  });

  it("falls back to a Turkish default message when there is no context and no message at all", async () => {
    invoke.mockResolvedValueOnce({ data: null, error: {} });
    const result = await callParasutWriteApi("resync", { resource: "customers" });
    expect(result).toEqual({ data: null, error: "İşlem gerçekleştirilemedi." });
  });

  it("surfaces a 200-status body's own error field (the create-customer 'failed' status convention)", async () => {
    invoke.mockResolvedValueOnce({ data: { error: "Doğrulama hatası." }, error: null });
    const result = await callParasutWriteApi("create-customer", {});
    expect(result).toEqual({ data: null, error: "Doğrulama hatası." });
  });
});
