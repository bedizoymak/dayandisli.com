// Public, read-only aggregation endpoint for the three ERP dashboard rate
// cards + weather widget. No ERP/Paraşüt/Supabase data is read or returned
// here — this is the one deliberate exception to this repo's "all external
// reads go through an authenticated edge function scoped to erp_users"
// pattern, because there is genuinely nothing tenant-scoped or sensitive in
// currency/gold/weather data. See handlers.ts for the actual provider logic
// (Deno-free, unit-tested with Vitest).
//
// GOLD_API_KEY and TOMORROW_API_KEY (Supabase Edge Function secrets, never
// VITE_* variables) are read from Deno.env here and passed into
// handlers.ts — neither is ever logged, included in the response, or
// reachable by any code path in this file.
//
// PRIVACY: an optional ?lat=&lon= query pair (the caller's browser
// geolocation) is parsed here, rounded, and cached only in this in-memory
// Map (cleared on cold start, never persisted, never logged). The cache
// key is the rounded coordinate pair itself, never the full response body
// keyed by anything more precise.
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { buildMarketDataResponse, roundCoordinate, type Coordinates, type MarketDataResponse } from "./handlers.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const CACHE_TTL_MS = 5 * 60_000; // shortest of the recommended per-provider windows; each provider is still fetched fresh at this cadence
const responseCache = new Map<string, { body: MarketDataResponse; expiresAt: number }>();
const FALLBACK_CACHE_KEY = "fallback";

function parseCoordinates(url: URL): Coordinates | null {
  const latParam = url.searchParams.get("lat");
  const lonParam = url.searchParams.get("lon");
  if (!latParam || !lonParam) return null;
  const latitude = Number(latParam);
  const longitude = Number(lonParam);
  if (!Number.isFinite(latitude) || latitude < -90 || latitude > 90) return null;
  if (!Number.isFinite(longitude) || longitude < -180 || longitude > 180) return null;
  return { latitude: roundCoordinate(latitude), longitude: roundCoordinate(longitude) };
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response("ok", { headers: corsHeaders });
  if (req.method !== "GET") return json({ error: "Method not allowed" }, 405);

  const coordinates = parseCoordinates(new URL(req.url));
  const cacheKey = coordinates ? `${coordinates.latitude},${coordinates.longitude}` : FALLBACK_CACHE_KEY;

  const now = Date.now();
  const cached = responseCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return json(cached.body);
  }

  try {
    const body = await buildMarketDataResponse({
      fetchImpl: fetch,
      now: () => new Date(),
      goldApiKey: Deno.env.get("GOLD_API_KEY") ?? null,
      weatherApiKey: Deno.env.get("TOMORROW_API_KEY") ?? null,
      coordinates,
    });
    responseCache.set(cacheKey, { body, expiresAt: now + CACHE_TTL_MS });
    return json(body);
  } catch {
    // buildMarketDataResponse itself isolates per-provider failures via
    // Promise.allSettled and never throws; this catch only guards against
    // something unexpected (e.g. Date construction) and never echoes the
    // underlying error/stack to the client.
    return json({ error: "Piyasa verisi şu anda alınamadı." }, 502);
  }
});
