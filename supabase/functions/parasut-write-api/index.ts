// parasut-write-api — the ONLY Edge Function in this repository permitted to
// send a write request to Paraşüt. Deliberately separate from parasut-api
// (permanently read-only, see its own index.ts/handlers.ts/client.test.ts).
// See DAYANDISLI_PHASE_SYSTEM_V3.md §8.16 and
// BIDIRECTIONAL_CUSTOMER_CREATION_ARCHITECTURE.md.
//
// NOT YET DEPLOYED. The tables this function depends on
// (public.accounting_outbound_commands/_attempts/_provider_links/_audit_log,
// see docs/migration-proposals/20260716130000_accounting_outbound_commands.sql)
// do not exist in production yet — deploying this function before that
// migration is approved and applied would only ever produce failures. This
// file is prepared, complete, and unit-tested (via handlers.ts) code, per
// this project's "prepare everything required for irreversible actions,
// but do not perform them" policy.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { resolveCompanyScope, type ErpUserAuthzRow } from "../_shared/company-scope.ts";
import { SupabaseAttemptRepository, SupabaseAuditRepository, SupabaseCommandRepository, SupabaseProviderLinkRepository, type OutboundAdminLike } from "../_shared/accounting-outbound-repository.ts";
import { computeCustomerCreateAvailability, CreateCustomerRejectedError, handleCreateCustomer, handleResyncContacts } from "./handlers.ts";
import { syncContacts } from "../../../server/parasut/sync-contacts.ts";
import { CreateCustomerCommandHandler } from "../../../server/erp/commands/create-customer-command.ts";
import { ParasutCustomerWriteProvider } from "../../../server/erp/providers/parasut-customer-write-provider.ts";
import { ParasutContactVerifier, type MinimalParasutReadClient } from "../../../server/erp/providers/parasut-contact-verifier.ts";
import { ParasutContactsOnlySync, type MirrorContactLookup } from "../../../server/erp/providers/parasut-contacts-only-sync.ts";
import { ParasutContactWriteHttpClient } from "../../../server/parasut/write-client.ts";
import { TokenManager } from "../../../server/parasut/auth.ts";
import { ParaşütClient } from "../../../server/parasut/client.ts";
import type { MirrorDatabase, SyncContext } from "../../../server/parasut/types.ts";
import type { ProviderCapabilities } from "../../../server/erp/providers/accounting-provider.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
};

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

interface AccessContext {
  hasCreatePermission: boolean;
  companyScope: ReturnType<typeof resolveCompanyScope>;
}

/**
 * Permission rule (must match src/features/erp/shared/permissions.ts):
 * `accounting.contacts.create` — admin, OR the explicit
 * `accounting.contacts.create` permission, OR `system.manage`. The `finance`
 * role does NOT grant this on its own — see permissions.ts's
 * OUTBOUND_WRITE_ONLY_PERMISSIONS exclusion and its own test coverage.
 */
interface QueryBuilderLike {
  select(columns: string): QueryBuilderLike;
  eq(column: string, value: unknown): QueryBuilderLike;
  is(column: string, value: unknown): QueryBuilderLike;
  ilike(column: string, value: string): QueryBuilderLike;
  limit(count: number): QueryBuilderLike;
  maybeSingle(): Promise<{ data: Record<string, unknown> | null }>;
}
interface GenericAdminLike {
  from(table: string): QueryBuilderLike;
}

async function resolveAccess(admin: OutboundAdminLike & GenericAdminLike, authUserId: string, email: string, requestedCompanyId: string | null): Promise<AccessContext | null> {
  const linked = await admin.from("erp_users").select("id, role, roles, permissions, accessible_company_ids").eq("auth_user_id", authUserId).eq("is_active", true).limit(1).maybeSingle();
  const bootstrap = linked.data
    ? { data: null }
    : await admin.from("erp_users").select("id, role, roles, permissions, accessible_company_ids").is("auth_user_id", null).ilike("email", email).eq("is_active", true).limit(1).maybeSingle();
  const erpUser = linked.data ?? bootstrap.data;
  if (!erpUser) return null;

  const record = erpUser as Record<string, unknown>;
  const role = (record.role as string | null) ?? null;
  const roles = (record.roles as string[] | null) ?? [];
  const roleSet = new Set<string>([role, ...roles].filter((value): value is string => Boolean(value)));
  const permissions = new Set<string>((record.permissions as string[] | null) ?? []);
  const isAdmin = roleSet.has("admin");
  const hasCreatePermission = isAdmin || permissions.has("accounting.contacts.create") || permissions.has("system.manage");

  const authzRow: ErpUserAuthzRow = { role, roles, accessible_company_ids: (record.accessible_company_ids as string[] | null) ?? [] };
  const companyScope = resolveCompanyScope(authzRow, requestedCompanyId ?? undefined);

  return { hasCreatePermission, companyScope };
}

const PARASUT_CAPABILITIES: ProviderCapabilities = {
  accounts: true,
  contacts: { read: true, create: true, update: false, archive: false, delete: false },
  products: true,
  salesInvoices: true,
  purchaseBills: true,
  payments: true,
  dashboard: true,
  reports: true,
  syncStatus: true,
};

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  let body: Record<string, unknown>;
  try {
    body = await req.json();
  } catch {
    return json({ error: "Geçersiz istek gövdesi." }, 400);
  }

  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const admin = createClient(supabaseUrl, serviceRoleKey) as unknown as OutboundAdminLike & GenericAdminLike;

  const { data: userData } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
  const email = userData.user?.email;
  if (!email || !userData.user) return json({ error: "Yetkili kullanıcı gerekli." }, 401);

  const requestedCompanyId = typeof body.companyId === "string" && body.companyId ? body.companyId : null;
  const access = await resolveAccess(admin, userData.user.id, email, requestedCompanyId);
  if (!access) return json({ error: "Yetkili ERP kullanıcısı bulunamadı." }, 403);
  if (!access.companyScope.ok) return json({ error: access.companyScope.reason }, 403);
  const activeCompanyId = access.companyScope.companyId;

  const action = body.action;
  const featureFlagEnabled = Deno.env.get("ACCOUNTING_WRITE_ENABLED") === "true";

  // Read-only status check for the frontend's "Yeni Müşteri" visibility —
  // deliberately handled before any PARASUT_* credential is read, so it
  // never fails due to (and never requires) Paraşüt configuration. See
  // handlers.ts's computeCustomerCreateAvailability for what it does and
  // does not expose.
  if (action === "customer-create-availability") {
    return json(
      computeCustomerCreateAvailability({
        authenticated: true,
        companyScopeOk: access.companyScope.ok,
        hasPermission: access.hasCreatePermission,
        featureFlagEnabled,
        capabilities: PARASUT_CAPABILITIES,
      }),
    );
  }

  const parasutCompanyId = env("PARASUT_COMPANY_ID");

  // Read+mirror-reconcile only — never a Paraşüt write, so deliberately not
  // gated by ACCOUNTING_WRITE_ENABLED. See handlers.ts's handleResyncContacts
  // doc comment for why this exists.
  if (action === "resync-contacts") {
    try {
      const tokens = new TokenManager({
        clientId: env("PARASUT_CLIENT_ID"),
        clientSecret: env("PARASUT_CLIENT_SECRET"),
        username: env("PARASUT_USERNAME"),
        password: env("PARASUT_PASSWORD"),
      });
      const database = admin as unknown as MirrorDatabase;
      const context: SyncContext = { companyId: activeCompanyId, parasutCompanyId, database, client: new ParaşütClient(tokens) };
      const response = await handleResyncContacts(access.hasCreatePermission, () => syncContacts(context));
      return json(response);
    } catch (error) {
      if (error instanceof CreateCustomerRejectedError) return json({ error: error.message }, error.httpStatus);
      const message = error instanceof Error ? error.message : "Beklenmeyen hata";
      return json({ error: message }, 500);
    }
  }

  if (action !== "create-customer") return json({ error: "Bilinmeyen işlem." }, 400);

  try {
    // Composition root — everything below is real, tested code (see each
    // module's own test file); only the schema this depends on is not yet
    // live. Token acquisition reuses the exact same TokenManager/ParaşütClient
    // already proven by the GET sync engine — never a separate credential path.
    const tokens = new TokenManager({
      clientId: env("PARASUT_CLIENT_ID"),
      clientSecret: env("PARASUT_CLIENT_SECRET"),
      username: env("PARASUT_USERNAME"),
      password: env("PARASUT_PASSWORD"),
    });
    const readClient = new ParaşütClient(tokens) as unknown as MinimalParasutReadClient;
    const writeClient = new ParasutContactWriteHttpClient(await tokens.accessToken());

    const database = admin as unknown as MirrorDatabase;
    const buildSyncContext = (companyId: string, providerCompanyId: string): SyncContext => ({ companyId, parasutCompanyId: providerCompanyId, database, client: new ParaşütClient(tokens) });
    const schemaAdmin = admin as unknown as { schema(name: string): GenericAdminLike };
    const lookup: MirrorContactLookup = {
      existsByParasutId: async (companyId: string, parasutId: string) => {
        const result = await schemaAdmin.schema("parasut").from("contacts").select("parasut_id").eq("company_id", companyId).eq("parasut_id", parasutId).maybeSingle();
        return Boolean(result.data);
      },
    };

    const commandHandler = new CreateCustomerCommandHandler(
      new SupabaseCommandRepository(admin),
      new SupabaseAttemptRepository(admin),
      new SupabaseProviderLinkRepository(admin),
      new SupabaseAuditRepository(admin),
      new ParasutCustomerWriteProvider(writeClient),
      new ParasutContactVerifier(readClient),
      new ParasutContactsOnlySync(buildSyncContext, lookup),
    );

    const response = await handleCreateCustomer(
      commandHandler,
      activeCompanyId,
      parasutCompanyId,
      userData.user.id,
      { hasPermission: access.hasCreatePermission, featureFlagEnabled, capabilities: PARASUT_CAPABILITIES },
      body,
    );
    return json(response);
  } catch (error) {
    if (error instanceof CreateCustomerRejectedError) return json({ error: error.message }, error.httpStatus);
    const message = error instanceof Error ? error.message : "Beklenmeyen hata";
    return json({ error: message }, 500);
  }
});
