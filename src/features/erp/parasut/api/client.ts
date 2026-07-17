import { supabase } from "@/integrations/supabase/client";

export type ParasutApiResult<T> = { data: T; error: null } | { data: null; error: string };

/**
 * Every Paraşüt mirror read goes through the `parasut-api` Supabase Edge
 * Function — the `parasut`/`integration` schemas are not PostgREST-exposed
 * and RLS revokes anon/authenticated access, so this is the only path the
 * browser has into that data. No write actions exist on this client; the
 * edge function itself has no insert/update/delete code path either.
 */
export async function callParasutApi<T>(action: string, params: Record<string, unknown> = {}): Promise<ParasutApiResult<T>> {
  const { data, error } = await supabase.functions.invoke("parasut-api", { body: { action, ...params } });

  if (error) {
    const message = (error as { message?: string })?.message ?? "Paraşüt verisi alınamadı.";
    return { data: null, error: message };
  }
  if (data && typeof data === "object" && "error" in data && data.error) {
    return { data: null, error: String((data as { error: unknown }).error) };
  }
  return { data: data as T, error: null };
}
