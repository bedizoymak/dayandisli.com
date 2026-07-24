import { describe, expect, it, vi } from "vitest";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { renderHook, waitFor } from "@testing-library/react";
import type { ReactNode } from "react";

const invoke = vi.fn();
vi.mock("@/integrations/supabase/client", () => ({
  supabase: { functions: { invoke: (...args: unknown[]) => invoke(...args) } },
}));

const { useMarketData } = await import("./useMarketData.ts");

const VALID_PAYLOAD = {
  currency: { usdTry: 47.23, eurTry: 53.9, rateDate: "2026-07-24", source: "TCMB" },
  gold: { gramTry: 4850.32, updatedAt: "2026-07-24T04:15:00.000Z", source: "goldapi.io" },
  weather: {
    temperatureC: 29,
    apparentTemperatureC: 31.2,
    weatherCode: 0,
    condition: "Açık",
    isDay: true,
    location: "İstanbul",
    updatedAt: "2026-07-24T04:15:00.000Z",
    source: "Open-Meteo",
  },
  fetchedAt: "2026-07-24T04:15:00.000Z",
  errors: { currency: null, gold: null, weather: null },
};

function wrapper(client: QueryClient) {
  return ({ children }: { children: ReactNode }) => (
    <QueryClientProvider client={client}>{children}</QueryClientProvider>
  );
}

describe("useMarketData", () => {
  it("starts in a loading state before resolving", async () => {
    invoke.mockResolvedValueOnce({ data: VALID_PAYLOAD, error: null });
    const client = new QueryClient();
    const { result } = renderHook(() => useMarketData(), { wrapper: wrapper(client) });

    expect(result.current.isLoading).toBe(true);
    await waitFor(() => expect(result.current.isSuccess).toBe(true));
    expect(result.current.data).toEqual(VALID_PAYLOAD);
  });

  it("surfaces an unavailable/error state with no fabricated data when the edge function fails", async () => {
    invoke.mockResolvedValue({ data: null, error: { message: "Edge Function returned a non-2xx status code" } });
    const client = new QueryClient();
    const { result } = renderHook(() => useMarketData(), { wrapper: wrapper(client) });

    await waitFor(() => expect(result.current.isError).toBe(true), { timeout: 10_000 });
    expect(result.current.data).toBeUndefined();
  });
});
