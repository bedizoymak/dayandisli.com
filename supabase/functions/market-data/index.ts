// Public, read-only aggregation endpoint for the three ERP dashboard rate
// cards + Istanbul weather widget. No ERP/Paraşüt/Supabase data is read or
// returned here — this is the one deliberate exception to this repo's
// "all external reads go through an authenticated edge function scoped to
// erp_users" pattern, because there is genuinely nothing tenant-scoped or
// sensitive in currency/gold/weather data. See handlers.ts for the actual
// provider logic (Deno-free, unit-tested with Vitest).
//
// GOLD_API_KEY (Supabase Edge Function secret, never a VITE_* variable) is
// read from Deno.env here and passed into handlers.ts — it is never logged,
// never included in the response, and this file has no code path that
// could leak it.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { buildMarketDataResponse, type MarketDataResponse } from "./handlers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const CACHE_TTL_MS = 5 * 60_000; // shortest of the recommended per-provider windows; each provider is still fetched fresh at this cadence
let cached: { body: MarketDataResponse; expiresAt: number } | null = null;

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const now = Date.now();
  if (cached && cached.expiresAt > now) {
    return json(cached.body);
  }

  try {
    const body = await buildMarketDataResponse({
      fetchImpl: fetch,
      now: () => new Date(),
      goldApiKey: Deno.env.get("GOLD_API_KEY") ?? null,
    });
    cached = { body, expiresAt: now + CACHE_TTL_MS };
    return json(body);
  } catch {
    // buildMarketDataResponse itself isolates per-provider failures via
    // Promise.allSettled and never throws; this catch only guards against
    // something unexpected (e.g. Date construction) and never echoes the
    // underlying error/stack to the client.
    return json({ error: "Piyasa verisi şu anda alınamadı." }, 502);
  }
});
