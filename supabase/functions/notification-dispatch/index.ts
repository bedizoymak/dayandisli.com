import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import { getNotificationProvider } from "../_shared/notification-providers.ts";

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

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabase = createClient(env("SUPABASE_URL"), env("SUPABASE_SERVICE_ROLE_KEY"));
  const body = await req.json();
  const ids = Array.isArray(body.notificationIds) ? body.notificationIds : [];
  const query = supabase.from("shop_customer_notifications").select("*, orders(email, order_number)").eq("status", "pending").limit(25);
  const { data: rows, error } = ids.length ? await query.in("id", ids) : await query;
  if (error) return json({ error: "Bildirimler alınamadı." }, 500);

  const provider = getNotificationProvider();
  const results = [];
  for (const row of rows ?? []) {
    const to = row.orders?.email;
    if (!to) continue;
    try {
      const result = await provider.send({
        to,
        subject: row.title,
        html: `<p>${row.message ?? row.title}</p><p>Sipariş: ${row.orders?.order_number ?? "-"}</p>`,
        eventType: row.event_type,
      });
      await supabase.from("shop_customer_notifications").update({ status: "sent", metadata: { ...(row.metadata ?? {}), provider: provider.id, providerMessageId: result.providerMessageId } }).eq("id", row.id);
      results.push({ id: row.id, status: "sent" });
    } catch (error) {
      await supabase.from("shop_customer_notifications").update({ status: "failed", metadata: { ...(row.metadata ?? {}), error: error instanceof Error ? error.message : String(error) } }).eq("id", row.id);
      results.push({ id: row.id, status: "failed" });
    }
  }

  return json({ results });
});
