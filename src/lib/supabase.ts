import { isSupabaseConfigured, supabase as typedSupabase } from "@/integrations/supabase/client";

/**
 * @deprecated PHASE 4: import the canonical client directly from
 * `@/integrations/supabase/client` instead. This alias exists only for the
 * orphaned legacy quotation feature (`src/features/quotation/**`), which is
 * slated for removal in Phase 7 — when it goes, this file goes with it.
 *
 * Same underlying instance as the canonical client (a re-export widened to
 * the generic SupabaseClient shape), so no second browser client is created.
 */
export const supabase = typedSupabase as unknown as import("@supabase/supabase-js").SupabaseClient;
export { isSupabaseConfigured };
