import type { User } from "@supabase/supabase-js";
import { supabase } from "@/integrations/supabase/client";
import type { ApiResult } from "./types";
import { failure, isMissingTableError, success } from "./api/internal";
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

/**
 * PHASE 5A: relocated verbatim from erpApi.ts — the auth domain owns this
 * function; the god-module re-export remains only for its (dying) legacy
 * consumers. Resolves the signed-in Supabase user's active erp_users row.
 */
export async function getCurrentERPUser(): Promise<ApiResult<ERPUser | null>> {
  const { data: authData, error: authError } = await supabase.auth.getUser();
  if (authError || !authData.user) return success(null);

  const { data, error } = await resolveERPUserForAuthUser(authData.user);
  if (error && !isMissingTableError(error)) return failure("getCurrentERPUser", error, null);
  return success(data);
}

