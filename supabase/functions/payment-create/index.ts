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
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
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
  const { data: userData, error: userError } = await userClient.auth.getUser(authHeader.replace("Bearer ", ""));
  const user = userData.user;
  if (userError || !user?.id || !user.email) return json({ error: "Ödeme başlatmak için müşteri girişi gerekli." }, 401);

  const body = await req.json();
  if (!isProvider(body.provider)) return json({ error: "Geçersiz ödeme sağlayıcısı." }, 400);
  if (!body.orderId) return json({ error: "Sipariş bilgisi eksik." }, 400);

  const { data: order, error: orderError } = await adminClient
    .from("orders")
    .select("*")
    .eq("id", body.orderId)
    .eq("customer_user_id", user.id)
    .maybeSingle();

  if (orderError || !order) return json({ error: "Sipariş bulunamadı." }, 404);
  if (order.payment_status === "paid") return json({ error: "Bu sipariş zaten ödenmiş." }, 409);

  const adapter = getPaymentProvider(body.provider);
  try {
    const result = await adapter.createPayment({
      orderId: order.id,
      orderNumber: order.order_number,
      customerUserId: user.id,
      customerName: order.customer_name,
      email: user.email,
      amount: Number(order.grand_total),
      currency: order.currency,
      callbackUrl: String(body.callbackUrl || ""),
    });

    const { data: paymentStatus, error: paymentError } = await adminClient
      .from("shop_payment_statuses")
      .insert({
        order_id: order.id,
        customer_user_id: user.id,
        status: "authorized",
        lifecycle_status: "payment_pending",
        future_provider: result.provider,
        provider: result.provider,
        transaction_reference: result.providerPaymentId,
        amount: Number(order.grand_total),
        currency: order.currency,
        notes: "Ödeme sağlayıcısı ile oturum oluşturuldu.",
        provider_payload: result.raw,
        verification_status: "pending",
        reconciliation_status: "pending",
      })
      .select("*")
      .single();

    if (paymentError || !paymentStatus) throw paymentError || new Error("Payment status could not be created");

    await adminClient
      .from("orders")
      .update({
        payment_provider: result.provider,
        payment_method: result.provider,
        provider_payment_id: result.providerPaymentId,
        provider_payment_url: result.paymentUrl,
        payment_status: "authorized",
        payment_reconciliation_status: "pending",
      })
      .eq("id", order.id);

    await adminClient.from("payment_provider_events").insert({
      provider: result.provider,
      event_id: `create-${result.providerPaymentId}`,
      event_type: "payment_session_created",
      order_id: order.id,
      customer_user_id: user.id,
      payment_status_id: paymentStatus.id,
      signature_valid: true,
      processing_status: "processed",
      payload: result.raw,
      payload_hash: result.providerPaymentId,
      processed_at: new Date().toISOString(),
    });

    await adminClient.from("payment_provider_health").upsert({
      provider: result.provider,
      status: "healthy",
      last_success_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider" });

    return json({ paymentUrl: result.paymentUrl, providerPaymentId: result.providerPaymentId, provider: result.provider });
  } catch (error) {
    await adminClient.from("payment_provider_health").upsert({
      provider: body.provider,
      status: "degraded",
      last_failure_at: new Date().toISOString(),
      failure_count: 1,
      last_error: error instanceof Error ? error.message : String(error),
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider" });
    return json({ error: "Ödeme sağlayıcısı başlatılamadı." }, 500);
  }
});
