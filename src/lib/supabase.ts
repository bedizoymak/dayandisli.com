import type { SupabaseClient } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase as typedSupabase } from "@/integrations/supabase/client";

// Legacy ERP/quotation modules still use tables and RPCs that are ahead of the generated Database type.
// Typed as the generic (unparameterized) SupabaseClient — deliberately NOT `any` (lint), while still
// widening away the generated table map.
export const supabase = typedSupabase as unknown as SupabaseClient;
export { isSupabaseConfigured };
