import { supabase } from "@/integrations/supabase/client";

export type ParasutWriteApiResult<T> = { data: T; error: null } | { data: null; error: string };

/**
 * The ONLY client-side path to the write-capable `parasut-write-api` Edge
 * Function — deliberately a separate function/client from the read-only
 * `parasut-api`/`callParasutApi`. Never sends a request to Paraşüt directly;
 * never contains a Paraşüt JSON:API payload shape — only the provider-neutral
 * `CreateCustomerInput` fields. See BIDIRECTIONAL_CUSTOMER_CREATION_ARCHITECTURE.md.
 */
export async function callParasutWriteApi<T>(action: string, params: Record<string, unknown> = {}): Promise<ParasutWriteApiResult<T>> {
  const { data, error } = await supabase.functions.invoke("parasut-write-api", { body: { action, ...params } });

  if (error) {
    const message = (error as { message?: string })?.message ?? "İşlem gerçekleştirilemedi.";
    return { data: null, error: message };
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    return { data: null, error: String((data as { error: unknown }).error) };
  }
  return { data: data as T, error: null };
}
