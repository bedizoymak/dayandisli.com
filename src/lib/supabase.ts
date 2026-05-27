import { isSupabaseConfigured, supabase as typedSupabase } from "@/integrations/supabase/client";

// Legacy ERP/quotation modules still use tables and RPCs that are ahead of the generated Database type.
export const supabase = typedSupabase as any;
export { isSupabaseConfigured };
