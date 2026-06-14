import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { ERPUser } from "./types";

type ERPUserLookupResult = {
  data: ERPUser | null;
  error: unknown;
};

async function lookupERPUser(column: "auth_user_id" | "email", value: string, requireUnlinked = false): Promise<ERPUserLookupResult> {
  let query = supabase
    .from("erp_users" as never)
    .select("*")
    .eq(column, value)
    .eq("is_active", true);

  if (requireUnlinked) query = query.is("auth_user_id", null);

  return (await query.limit(1).maybeSingle()) as unknown as ERPUserLookupResult;
}

export async function resolveERPUserForAuthUser(user: Pick<User, "id" | "email">): Promise<ERPUserLookupResult> {
  if (!user.email) return { data: null, error: null };

  const linked = await lookupERPUser("auth_user_id", user.id);
  if (linked.error || linked.data) return linked;

  return lookupERPUser("email", user.email.toLocaleLowerCase("en-US"), true);
}

