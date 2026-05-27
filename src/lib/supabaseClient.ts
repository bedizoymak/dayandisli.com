import { isSupabaseConfigured, supabase as typedSupabase } from "@/integrations/supabase/client";

// Legacy utility pages query tables that are not represented in the generated Database type yet.
export const supabase = typedSupabase as any;
export { isSupabaseConfigured };
