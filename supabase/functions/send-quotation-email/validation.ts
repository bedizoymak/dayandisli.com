// Pure validation/authorization-decision logic for the send-quotation-email
// edge function. Deliberately free of Deno-specific imports so it runs under
// Vitest unchanged (same pattern as parasut-api/handlers.ts): the exact code
// that decides whether a send is allowed in production is the exact code
// under test here.
//
// PHASE 1C remediation: this function was an unauthenticated, CORS-*
// SMTP relay (arbitrary recipients, arbitrary HTML body, arbitrary
// attachments). Quotation sending is an authenticated ERP action, so the
// function now requires (1) gateway JWT (config.toml verify_jwt = true),
// (2) an active erp_users row for the caller, and (3) every payload below
// to pass validateQuotationEmailRequest.

export const MAX_SUBJECT_LENGTH = 200;
/** Decoded PDF size ceiling: 10 MB. */
export const MAX_PDF_BYTES = 10 * 1024 * 1024;
/** Combined html + subject + metadata ceiling for the JSON body. */
export const MAX_BODY_JSON_BYTES = 12 * 1024 * 1024;
export const MAX_BCC_ADDRESSES = 5;
/** Per-user sends per rolling window (per-instance; raises the abuse bar — documented limitation). */
export const RATE_LIMIT_MAX_SENDS = 20;
export const RATE_LIMIT_WINDOW_MS = 5 * 60 * 1000;

const EMAIL_PATTERN = /^[^\s@]+@[^\s@]+\.[^\s@]{2,}$/;

export interface QuotationEmailRequest {
  to?: unknown;
  bcc?: unknown;
  subject?: unknown;
  html?: unknown;
  pdfBase64?: unknown;
  pdfFileName?: unknown;
}

export interface ValidatedQuotationEmail {
  to: string[];
  bcc: string[];
  subject: string;
  html: string;
  attachment: { filename: string; contentBase64: string } | null;
}

export type ValidationResult =
  | { ok: true; value: ValidatedQuotationEmail }
  | { ok: false; reason: string };

function parseAddressList(value: unknown, field: string, maxCount: number): string[] | string {
  if (value === undefined || value === null) return [];
  const rawList = Array.isArray(value) ? value : [value];
  if (rawList.length > maxCount) return `${field}: en fazla ${maxCount} adres.`;
  const addresses: string[] = [];
  for (const entry of rawList) {
    if (typeof entry !== "string") return `${field}: geçersiz adres.`;
    // nodemailer accepts "Name <a@b.c>" forms — strip a display name if present.
    const angled = entry.match(/<([^>]+)>/);
    const address = (angled ? angled[1] : entry).trim();
    if (!EMAIL_PATTERN.test(address)) return `${field}: geçersiz e-posta adresi.`;
    addresses.push(address);
  }
  return addresses;
}

function sanitizeFilename(name: string): string | null {
  const base = name.split(/[\\/]/).pop() ?? "";
  const cleaned = base.replace(/[^A-Za-z0-9._-]/g, "_").trim();
  // Require a non-empty stem before the extension (rejects ".pdf", ".", "..").
  if (!/^[A-Za-z0-9][A-Za-z0-9._-]{0,115}\.pdf$/i.test(cleaned)) return null;
  return cleaned;
}

export function validateQuotationEmailRequest(body: unknown): ValidationResult {
  if (!body || typeof body !== "object" || Array.isArray(body)) {
    return { ok: false, reason: "Geçersiz istek gövdesi." };
  }
  const request = body as QuotationEmailRequest;

  const to = parseAddressList(request.to, "to", 10);
  if (typeof to === "string") return { ok: false, reason: to };
  if (to.length === 0) return { ok: false, reason: "Alıcı (to) zorunlu." };

  const bcc = parseAddressList(request.bcc, "bcc", MAX_BCC_ADDRESSES);
  if (typeof bcc === "string") return { ok: false, reason: bcc };

  let subject = "DAYAN Dişli - Fiyat Teklifi";
  if (request.subject !== undefined && request.subject !== null) {
    if (typeof request.subject !== "string") return { ok: false, reason: "subject: metin olmalı." };
    subject = request.subject.replace(/[\r\n]+/g, " ").trim().slice(0, MAX_SUBJECT_LENGTH) || subject;
  }

  let html = "<p>Merhaba, fiyat teklifimiz ekte PDF olarak iletilmiştir.</p>";
  if (request.html !== undefined && request.html !== null) {
    if (typeof request.html !== "string") return { ok: false, reason: "html: metin olmalı." };
    if (request.html.length > MAX_BODY_JSON_BYTES) return { ok: false, reason: "html: içerik çok büyük." };
    html = request.html;
  }

  let attachment: ValidatedQuotationEmail["attachment"] = null;
  if (request.pdfBase64 !== undefined && request.pdfBase64 !== null && request.pdfFileName !== undefined && request.pdfFileName !== null) {
    if (typeof request.pdfFileName !== "string") return { ok: false, reason: "pdfFileName: metin olmalı." };
    const filename = sanitizeFilename(request.pdfFileName);
    if (!filename) return { ok: false, reason: "pdfFileName: yalnızca .pdf dosya adı kabul edilir." };

    if (typeof request.pdfBase64 !== "string" || request.pdfBase64.length === 0) {
      return { ok: false, reason: "pdfBase64: boş olamaz." };
    }
    // Reject whitespace/base64url variants up front; strict alphabet only.
    if (!/^[A-Za-z0-9+/]+={0,2}$/.test(request.pdfBase64)) {
      return { ok: false, reason: "pdfBase64: geçersiz base64." };
    }
    const decodedBytes = Math.floor((request.pdfBase64.length * 3) / 4);
    if (decodedBytes > MAX_PDF_BYTES) {
      return { ok: false, reason: `pdf: dosya ${(decodedBytes / (1024 * 1024)).toFixed(1)} MB — üst sınır 10 MB.` };
    }
    // PDF magic header ("%PDF-") after decode of the first bytes.
    const head = atobSubstring(request.pdfBase64, 8);
    if (!head.startsWith("%PDF-")) {
      return { ok: false, reason: "pdf: içerik bir PDF değil." };
    }
    attachment = { filename, contentBase64: request.pdfBase64 };
  }

  return { ok: true, value: { to, bcc, subject, html, attachment } };
}

/** Decode the first `chars` base64 characters without materializing the whole payload. */
function atobSubstring(base64: string, chars: number): string {
  const slice = base64.slice(0, chars - (chars % 4));
  try {
    return typeof atob === "function" ? atob(slice) : Buffer.from(slice, "base64").toString("binary");
  } catch {
    return "";
  }
}

/**
 * Rolling-window per-user rate limiter state. Callers keep one Map per
 * isolate instance; entries expire lazily.
 */
export function checkRateLimit(
  bucket: Map<string, number[]>,
  key: string,
  nowMs: number,
): boolean {
  const windowStart = nowMs - RATE_LIMIT_WINDOW_MS;
  const previous = bucket.get(key) ?? [];
  const recent = previous.filter((timestamp) => timestamp > windowStart);
  if (recent.length >= RATE_LIMIT_MAX_SENDS) return false;
  recent.push(nowMs);
  bucket.set(key, recent);
  return true;
}
