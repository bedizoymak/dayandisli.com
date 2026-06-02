import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { getPaymentProvider, PaymentProviderId } from "../_shared/payment-providers.ts";

function env(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "Content-Type": "application/json" },
  });
}

function providerFromUrl(url: string): PaymentProviderId | null {
  const value = new URL(url).searchParams.get("provider");
  if (value === "iyzico" || value === "paytr" || value === "stripe") return value;
  return null;
}

async function sha256Hex(value: string) {
  const bytes = await crypto.subtle.digest("SHA-256", new TextEncoder().encode(value));
  return Array.from(new Uint8Array(bytes)).map((byte) => byte.toString(16).padStart(2, "0")).join("");
}

serve(async (req) => {
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);
  const provider = providerFromUrl(req.url);
  if (!provider) return json({ error: "Provider is required" }, 400);

  const rawBody = await req.text();
  const payloadHash = await sha256Hex(rawBody);
  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));

  let eventRecordId: string | null = null;
  try {
    const verified = await getPaymentProvider(provider).verifyWebhook(req, rawBody);
    if (!verified.eventId) throw new Error("Provider event id is missing");

    const { data: existing } = await supabase
      .from("payment_provider_events")
      .select("id")
      .eq("provider", provider)
      .eq("event_id", verified.eventId)
      .maybeSingle();

    if (existing) {
      await supabase.from("payment_provider_events").insert({
        provider,
        event_id: `${verified.eventId}-duplicate-${Date.now()}`,
        event_type: verified.eventType,
        signature_valid: true,
        duplicate_detected: true,
        processing_status: "ignored",
        payload: verified.raw,
        payload_hash: payloadHash,
        processed_at: new Date().toISOString(),
      });
      return json({ received: true, duplicate: true });
    }

    const { data: order } = verified.orderId
      ? await supabase.from("orders").select("*").eq("id", verified.orderId).maybeSingle()
      : await supabase.from("orders").select("*").eq("provider_payment_id", verified.providerPaymentId).maybeSingle();

    const { data: paymentStatus } = await supabase
      .from("shop_payment_statuses")
      .select("*")
      .eq("provider", provider)
      .eq("transaction_reference", verified.providerPaymentId)
      .maybeSingle();

    const { data: eventRecord } = await supabase
      .from("payment_provider_events")
      .insert({
        provider,
        event_id: verified.eventId,
        event_type: verified.eventType,
        order_id: order?.id ?? null,
        customer_user_id: order?.customer_user_id ?? verified.customerUserId,
        payment_status_id: paymentStatus?.id ?? null,
        signature_valid: true,
        duplicate_detected: false,
        processing_status: "received",
        payload: verified.raw,
        payload_hash: payloadHash,
      })
      .select("id")
      .single();
    eventRecordId = eventRecord?.id ?? null;

    if (verified.eventType === "payment_succeeded" && order?.id && paymentStatus?.id) {
      await supabase.rpc("ensure_commerce_payment_financial_records" as never, {
        p_order_id: order.id,
        p_payment_status_id: paymentStatus.id,
        p_provider: provider,
        p_provider_payment_id: verified.providerPaymentId,
        p_amount: verified.amount ?? Number(order.grand_total),
        p_currency: verified.currency ?? order.currency,
      } as never);
    } else if (verified.eventType === "payment_failed" && order?.id) {
      await supabase.from("orders").update({ payment_status: "failed", payment_reconciliation_status: "manual_review" }).eq("id", order.id);
      if (paymentStatus?.id) {
        await supabase.from("shop_payment_statuses").update({ status: "failed", lifecycle_status: "payment_failed", verification_status: "verified", reconciliation_status: "manual_review" }).eq("id", paymentStatus.id);
      }
    }

    if (verified.eventType === "refund_succeeded" && verified.providerRefundId) {
      await supabase
        .from("payment_refund_operations")
        .update({ status: "provider_verified", provider_refund_id: verified.providerRefundId, completed_at: new Date().toISOString() })
        .eq("provider", provider)
        .eq("provider_refund_id", verified.providerRefundId);
    }

    if (eventRecordId) {
      await supabase.from("payment_provider_events").update({ processing_status: "processed", processed_at: new Date().toISOString() }).eq("id", eventRecordId);
    }
    await supabase.from("payment_provider_health").upsert({ provider, status: "healthy", last_success_at: new Date().toISOString(), updated_at: new Date().toISOString() }, { onConflict: "provider" });
    return json({ received: true });
  } catch (error) {
    await supabase.from("payment_provider_events").insert({
      provider,
      event_id: `failed-${Date.now()}`,
      event_type: "webhook_failed",
      signature_valid: false,
      processing_status: "failed",
      error_message: error instanceof Error ? error.message : String(error),
      payload: {},
      payload_hash: payloadHash,
      processed_at: new Date().toISOString(),
    });
    await supabase.from("payment_provider_health").upsert({
      provider,
      status: "degraded",
      last_failure_at: new Date().toISOString(),
      failure_count: 1,
      last_error: error instanceof Error ? error.message : String(error),
      updated_at: new Date().toISOString(),
    }, { onConflict: "provider" });
    return json({ error: "Webhook doğrulaması başarısız." }, 400);
  }
});
