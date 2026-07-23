import type { ApiResult, ERPDatabaseStatus } from "./types";

// Production ERP routes must never substitute fabricated records when a table
// or provider is unavailable. Keep these compatibility helpers until callers
// are renamed, but always return their explicit empty fallback.
export const DEMO_FALLBACK_ACTIVE = false;

export function getDemoDatabaseStatus(): ERPDatabaseStatus {
  return {
    overall: "missing_migration",
    label: "Veri kaynağı kullanılamıyor",
    tables: [],
  };
}

export function demoFallbackForScope<T>(_scope: string, fallback: T): T {
  return fallback;
}

export function demoResult<T>(_scope: string, fallback: T): ApiResult<T> {
  return {
    data: fallback,
    error: "Veri kaynağı kullanılamıyor",
    missingTable: true,
    demoFallback: false,
  };
}
