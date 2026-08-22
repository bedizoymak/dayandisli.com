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
// SUPABASE_URL/SUPABASE_SERVICE_ROLE_KEY (auto-provisioned for every edge
// function, never set manually) back two Postgres-backed repositories:
//  - market_rate_history: day-over-day change for the FX/gold tiles. Holds
//    daily closing values only — never caller coordinates or tenant data.
//  - metalprice_api_state: the MetalpriceAPI 8-hour/99-per-month call
//    budget (last call time, monthly count, last successful EUR/XAU/XAG
//    rates). A single shared row, claimed atomically via the
//    claim_metalprice_refresh/record_metalprice_result SQL functions so
//    concurrent requests/instances never cause more than one upstream call
//    at a time. See supabase/migrations/20260822100000_metalprice_api_state.sql.
// Neither table has RLS policies, so only the service role can reach them.
//
// PRIVACY: an optional ?lat=&lon= query pair (the caller's browser
// geolocation) is parsed here, rounded, and used only as the weather cache's
// key, held in an in-memory Map (cleared on cold start, never persisted,
// never logged) — never the full response body keyed by anything more
// precise. Currency/gold are location-independent and cached separately
// under one fixed key shared by every caller (see ratesCache below).
import { serve } from "https://deno.land/std@0.224.0/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";
import {
  fetchRatesData,
  fetchWeatherData,
  noopHistoryRepository,
  noopMetalPriceCacheRepository,
  roundCoordinate,
  type Coordinates,
  type MarketDataResponse,
  type MarketHistoryRepository,
  type MarketInstrument,
  type MetalPriceCacheRepository,
  type MetalPriceClaim,
  type MetalRates,
  type RatesData,
  type WeatherData,
} from "./handlers.ts";

/** Reads/writes market_rate_history for the day-over-day change shown on
 * each FX/gold tile. Uses the service role because the table has no RLS
 * policies (see the migration) — anon/authenticated access is intentionally
 * denied. Falls back to a no-op repository (previousClose always null,
 * writes silently skipped) if the service role credential is unavailable,
 * so a misconfigured secret degrades to "no change shown" rather than
 * breaking the rate/gold response. */
function createHistoryRepository(): MarketHistoryRepository {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return noopHistoryRepository;

  const client = createClient(supabaseUrl, serviceRoleKey);
  return {
    async getPreviousClose(instrument: MarketInstrument, beforeDateIso: string): Promise<number | null> {
      const { data, error } = await client
        .from("market_rate_history")
        .select("value")
        .eq("instrument", instrument)
        .lt("rate_date", beforeDateIso)
        .order("rate_date", { ascending: false })
        .limit(1)
        .maybeSingle();
      if (error || !data) return null;
      return typeof data.value === "number" ? data.value : Number(data.value);
    },
    async recordClose(instrument: MarketInstrument, dateIso: string, value: number, source: string): Promise<void> {
      await client
        .from("market_rate_history")
        .upsert({ instrument, rate_date: dateIso, value, source }, { onConflict: "instrument,rate_date" });
    },
  };
}

// Policy constants for the MetalpriceAPI call budget — the single source of
// truth for the 8-hour interval and 99/month cap; the SQL functions below
// only provide the generic atomic claim/record mechanics, parameterized by
// these values, so the actual policy stays here and is easy to review.
const METALPRICE_MIN_INTERVAL_SECONDS = 8 * 60 * 60; // 8 hours -> at most 3 calls/day
const METALPRICE_MONTHLY_CAP = 99;
const METALPRICE_STALE_LOCK_SECONDS = 5 * 60; // recover from a claim whose instance crashed mid-fetch

function metalpriceMonthKey(date: Date): string {
  return `${date.getUTCFullYear()}-${String(date.getUTCMonth() + 1).padStart(2, "0")}`;
}

function isValidMetalRates(value: unknown): value is MetalRates {
  if (typeof value !== "object" || value === null) return false;
  const r = value as Record<string, unknown>;
  return (
    typeof r.eurPerUsd === "number" && Number.isFinite(r.eurPerUsd) && r.eurPerUsd > 0 &&
    typeof r.xauPerUsd === "number" && Number.isFinite(r.xauPerUsd) && r.xauPerUsd > 0 &&
    typeof r.xagPerUsd === "number" && Number.isFinite(r.xagPerUsd) && r.xagPerUsd > 0
  );
}

/** Backs the MetalpriceAPI 8-hour/99-per-month call budget via the
 * metalprice_api_state singleton row (see the migration for the atomic
 * claim/record functions and why a single UPDATE...WHERE...RETURNING is
 * race-safe across concurrent requests/instances with no explicit lock).
 * Falls back to the fail-closed noop repository (never claims) if the
 * service role credential is unavailable — see noopMetalPriceCacheRepository's
 * doc comment for why this degrades to "no calls" rather than "call anyway". */
function createMetalPriceCacheRepository(): MetalPriceCacheRepository {
  const supabaseUrl = Deno.env.get("SUPABASE_URL");
  const serviceRoleKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY");
  if (!supabaseUrl || !serviceRoleKey) return noopMetalPriceCacheRepository;

  const client = createClient(supabaseUrl, serviceRoleKey);
  return {
    async claimRefresh(now: Date): Promise<MetalPriceClaim> {
      const { data, error } = await client.rpc("claim_metalprice_refresh", {
        p_now: now.toISOString(),
        p_month: metalpriceMonthKey(now),
        p_min_interval_seconds: METALPRICE_MIN_INTERVAL_SECONDS,
        p_monthly_cap: METALPRICE_MONTHLY_CAP,
        p_stale_lock_seconds: METALPRICE_STALE_LOCK_SECONDS,
      });
      if (error || !Array.isArray(data) || data.length === 0) {
        console.error("[market-data] metalprice claim_metalprice_refresh RPC failed:", error?.message ?? "no rows returned");
        return { claimed: false, cachedRates: null };
      }
      const row = data[0] as { claimed: boolean; last_rates: unknown; calls_this_month: number };
      console.log(
        `[market-data] metalprice claim result: claimed=${row.claimed} lastCallAttemptAt=${now.toISOString()} callsThisMonth=${row.calls_this_month}`,
      );
      return { claimed: row.claimed, cachedRates: isValidMetalRates(row.last_rates) ? row.last_rates : null };
    },
    async recordResult(now: Date, success: boolean, rates: MetalRates | null, errorMessage: string | null): Promise<void> {
      const { error } = await client.rpc("record_metalprice_result", {
        p_now: now.toISOString(),
        p_success: success,
        p_rates: rates,
        p_error: errorMessage,
      });
      if (error) {
        console.error("[market-data] metalprice record_metalprice_result RPC failed:", error.message);
      } else {
        console.log(`[market-data] metalprice call recorded: success=${success} at=${now.toISOString()}`);
      }
    },
  };
}

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
  "Access-Control-Allow-Methods": "GET, OPTIONS",
};

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), { status, headers: { ...corsHeaders, "Content-Type": "application/json" } });
}

const CACHE_TTL_MS = 15 * 60_000; // upstream providers are never called more often than this, per cache key
// Currency and gold do not depend on the caller's coordinates, so they share
// one global cache entry across every caller — only weather is cached
// per-coordinate. Keeping gold bundled into the per-coordinate cache
// previously meant every distinct visitor location re-hit MetalpriceAPI,
// which is what exhausted its monthly request quota well ahead of what the
// 15-minute TTL alone would predict.
const RATES_CACHE_KEY = "rates";
const ratesCache = new Map<string, { data: RatesData; expiresAt: number }>();
const weatherCache = new Map<string, { data: WeatherData; expiresAt: number }>();
const FALLBACK_CACHE_KEY = "fallback";
const historyRepository = createHistoryRepository();
const metalPriceCacheRepository = createMetalPriceCacheRepository();

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
  const weatherCacheKey = coordinates ? `${coordinates.latitude},${coordinates.longitude}` : FALLBACK_CACHE_KEY;

  const now = Date.now();
  const deps = {
    fetchImpl: fetch,
    now: () => new Date(),
    goldApiKey: Deno.env.get("GOLD_API_KEY") ?? null,
    weatherApiKey: Deno.env.get("TOMORROW_API_KEY") ?? null,
    coordinates,
    history: historyRepository,
    metalPriceCache: metalPriceCacheRepository,
  };

  try {
    let ratesEntry = ratesCache.get(RATES_CACHE_KEY);
    if (!ratesEntry || ratesEntry.expiresAt <= now) {
      ratesEntry = { data: await fetchRatesData(deps), expiresAt: now + CACHE_TTL_MS };
      ratesCache.set(RATES_CACHE_KEY, ratesEntry);
    }

    let weatherEntry = weatherCache.get(weatherCacheKey);
    if (!weatherEntry || weatherEntry.expiresAt <= now) {
      weatherEntry = { data: await fetchWeatherData(deps), expiresAt: now + CACHE_TTL_MS };
      weatherCache.set(weatherCacheKey, weatherEntry);
    }

    const body: MarketDataResponse = {
      currency: ratesEntry.data.currency,
      gold: ratesEntry.data.gold,
      weather: weatherEntry.data.weather,
      fetchedAt: new Date().toISOString(),
      errors: {
        currency: ratesEntry.data.errors.currency,
        gold: ratesEntry.data.errors.gold,
        weather: weatherEntry.data.errors.weather,
      },
    };
    return json(body);
  } catch {
    // fetchRatesData/fetchWeatherData themselves isolate per-provider
    // failures via Promise.allSettled and never throw; this catch only
    // guards against something unexpected (e.g. Date construction) and
    // never echoes the underlying error/stack to the client.
    return json({ error: "Piyasa verisi şu anda alınamadı." }, 502);
  }
});
