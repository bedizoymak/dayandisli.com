export type SupabaseErrorKind = "missing_table" | "permission" | "network" | "unknown";

export const ERP_TABLES_MISSING_MESSAGE =
  "ERP veritabanı tabloları henüz oluşturulmamış. Supabase SQL migration dosyasını çalıştırın.";

export const ERP_PERMISSION_MESSAGE =
  "Veritabanına erişim izni alınamadı. Supabase RLS politikalarını kontrol edin.";

export const SUPABASE_CONNECTION_MESSAGE =
  "Supabase bağlantısı kurulamadı. Ortam değişkenlerini kontrol edin.";

export function toSupabaseErrorMessage(error: unknown) {
  if (!error) return "Bilinmeyen hata";
  if (error instanceof Error) return error.message;
  if (typeof error === "string") return error;
  if (typeof error === "object" && error && "message" in error) {
    return String((error as { message: unknown }).message);
  }
  return String(error);
}

export function classifySupabaseError(error: unknown): SupabaseErrorKind {
  if (!error || typeof error !== "object") {
    const text = toSupabaseErrorMessage(error).toLowerCase();
    if (text.includes("failed to fetch") || text.includes("network") || text.includes("supabase")) return "network";
    return "unknown";
  }

  const err = error as { code?: string; message?: string; details?: string; hint?: string; status?: number };
  const text = `${err.message ?? ""} ${err.details ?? ""} ${err.hint ?? ""}`.toLowerCase();

  if (
    err.code === "42P01" ||
    err.code === "PGRST205" ||
    text.includes("does not exist") ||
    text.includes("could not find the table") ||
    text.includes("schema cache")
  ) {
    return "missing_table";
  }

  if (
    err.code === "42501" ||
    err.status === 401 ||
    err.status === 403 ||
    text.includes("permission denied") ||
    text.includes("row-level security") ||
    text.includes("rls") ||
    text.includes("jwt")
  ) {
    return "permission";
  }

  if (text.includes("failed to fetch") || text.includes("network") || text.includes("fetch")) return "network";

  return "unknown";
}

export function getFriendlySupabaseError(error: unknown) {
  const kind = classifySupabaseError(error);
  if (kind === "missing_table") return ERP_TABLES_MISSING_MESSAGE;
  if (kind === "permission") return ERP_PERMISSION_MESSAGE;
  if (kind === "network") return SUPABASE_CONNECTION_MESSAGE;
  return toSupabaseErrorMessage(error);
}
