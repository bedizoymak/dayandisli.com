import { supabase } from "@/integrations/supabase/client";

export type ParasutWriteApiResult<T> = { data: T; error: null } | { data: null; error: string };

/**
 * The ONLY client-side path to the write-capable `parasut-write-api` Edge
 * Function — deliberately a separate function/client from the read-only
 * `parasut-api`/`callParasutApi`. Never sends a request to Paraşüt directly;
 * never contains a Paraşüt JSON:API payload shape — only the provider-neutral
 * `CreateCustomerInput` fields. See BIDIRECTIONAL_CUSTOMER_CREATION_ARCHITECTURE.md.
 */
/**
 * On a non-2xx response, supabase-js's `error.message` is always the same
 * generic string ("Edge Function returned a non-2xx status code") — never
 * the Edge Function's own `{ error: "..." }` JSON body, which instead lands
 * on `error.context` (the raw fetch `Response`). Confirmed empirically
 * 2026-07-23 against the real deployed parasut-write-api. Without reading
 * this, every specific server message (permission denied, "a sync is
 * already in progress", validation errors, ...) would be silently replaced
 * by that one generic string in the UI.
 */
async function extractServerErrorMessage(error: unknown): Promise<string> {
  const context = (error as { context?: unknown })?.context;
  if (context && typeof (context as Response).json === "function") {
    try {
      const body = await (context as Response).clone().json();
      if (body && typeof body === "object" && typeof (body as { error?: unknown }).error === "string") {
        return (body as { error: string }).error;
      }
    } catch {
      // Body wasn't JSON (or already consumed) — fall through to the generic message below.
    }
  }
  return (error as { message?: string })?.message ?? "İşlem gerçekleştirilemedi.";
}

export async function callParasutWriteApi<T>(action: string, params: Record<string, unknown> = {}): Promise<ParasutWriteApiResult<T>> {
  const { data, error } = await supabase.functions.invoke("parasut-write-api", { body: { action, ...params } });

  if (error) {
    return { data: null, error: await extractServerErrorMessage(error) };
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    return { data: null, error: String((data as { error: unknown }).error) };
  }
  return { data: data as T, error: null };
}
