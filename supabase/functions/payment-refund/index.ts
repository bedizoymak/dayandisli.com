import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { getPaymentProvider, PaymentProviderId } from "../_shared/payment-providers.ts";

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

function isProvider(value: unknown): value is PaymentProviderId {
  return value === "iyzico" || value === "paytr" || value === "stripe";
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = env("SUPABASE_URL");
  const anonKey = env("SUPABASE_ANON_KEY");
  const serviceRoleKey = env("SUPABASE_SERVICE_ROLE_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  const userClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
  const email = userData.user?.email;
  if (!email) return json({ error: "Yetkili kullanıcı gerekli." }, 401);

  const linkedResult = await adminClient
    .from("erp_users")
    .select("id, role, roles, permissions")
    .eq("auth_user_id", userData.user.id)
    .eq("is_active", true)
    .limit(1)
    .maybeSingle();
  const bootstrapResult = linkedResult.data
    ? { data: null }
    : await adminClient
        .from("erp_users")
        .select("id, role, roles, permissions")
        .is("auth_user_id", null)
        .ilike("email", email)
        .eq("is_active", true)
        .limit(1)
        .maybeSingle();
  const erpUser = linkedResult.data ?? bootstrapResult.data;
  const roles = new Set([erpUser?.role, ...(erpUser?.roles ?? [])].filter(Boolean));
  const permissions = new Set(erpUser?.permissions ?? []);
  const canReviewRefund =
    roles.has("admin") ||
    roles.has("finance") ||
    permissions.has("finance.edit") ||
    permissions.has("system.manage");
  if (!erpUser || !canReviewRefund) return json({ error: "Bu işlem için ERP yetkisi gerekli." }, 403);

  const body = await req.json();
  if (!isProvider(body.provider)) return json({ error: "Geçersiz ödeme sağlayıcısı." }, 400);
  if (!body.returnRequestId) return json({ error: "İade talebi eksik." }, 400);

  const { data: refundOperation, error } = await adminClient
    .from("payment_refund_operations")
    .select("*")
    .eq("return_request_id", body.returnRequestId)
    .maybeSingle();
  if (error || !refundOperation) return json({ error: "İade operasyonu bulunamadı." }, 404);

  const result = await getPaymentProvider(body.provider).verifyRefund({
    refundId: String(body.providerRefundId || refundOperation.provider_refund_id || refundOperation.id),
    paymentId: refundOperation.payment_status_id,
    amount: Number(body.amount || refundOperation.approved_amount || refundOperation.requested_amount),
    currency: refundOperation.currency,
  });

  await adminClient
    .from("payment_refund_operations")
    .update({
      provider: body.provider,
      provider_refund_id: String(body.providerRefundId || refundOperation.provider_refund_id || refundOperation.id),
      approved_amount: Number(body.amount || refundOperation.approved_amount || refundOperation.requested_amount),
      status: result.verified ? "provider_verified" : "failed",
      reviewed_by: email,
      reviewed_at: new Date().toISOString(),
      completed_at: result.verified ? new Date().toISOString() : null,
      metadata: result.raw,
    })
    .eq("id", refundOperation.id);

  return json({ verified: result.verified });
});
