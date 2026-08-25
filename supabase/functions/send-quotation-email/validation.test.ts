// PHASE 1C abuse/security tests for the quotation-email payload validator.
// These run the exact production validation module (no Deno imports) —
// see validation.ts's header for the threat model this closes.
import { describe, expect, it } from "vitest";
import {
  MAX_BCC_ADDRESSES,
  MAX_PDF_BYTES,
  RATE_LIMIT_MAX_SENDS,
  RATE_LIMIT_WINDOW_MS,
  checkRateLimit,
  validateQuotationEmailRequest,
} from "./validation.ts";

/** Minimal valid PDF header, base64 of "%PDF-1.4\n". */
const PDF_HEAD = btoa("%PDF-1.4\n");

function validBody(overrides: Record<string, unknown> = {}) {
  return {
    to: "customer@example.com",
    subject: "Teklif",
    html: "<p>Merhaba</p>",
    pdfBase64: PDF_HEAD + Buffer.from("x".repeat(64)).toString("base64"),
    pdfFileName: "TKL-2026-001.pdf",
    ...overrides,
  };
}

describe("validateQuotationEmailRequest — legitimate path", () => {
  it("accepts a well-formed request with a real PDF attachment", () => {
    const result = validateQuotationEmailRequest(validBody());
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.to).toEqual(["customer@example.com"]);
      expect(result.value.attachment?.filename).toBe("TKL-2026-001.pdf");
      expect(result.value.subject).toBe("Teklif");
    }
  });

  it("accepts display-name address forms and normalizes them", () => {
    const result = validateQuotationEmailRequest(validBody({ to: ["Ali Veli <ali@ornek.com>"] }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.to).toEqual(["ali@ornek.com"]);
  });

  it("supplies safe defaults for optional fields", () => {
    const result = validateQuotationEmailRequest({ to: "a@b.co" });
    expect(result.ok).toBe(true);
    if (result.ok) {
      expect(result.value.attachment).toBeNull();
      expect(result.value.bcc).toEqual([]);
      expect(result.value.subject.length).toBeGreaterThan(0);
    }
  });
});

describe("validateQuotationEmailRequest — recipient abuse", () => {
  it("rejects missing and malformed recipients", () => {
    for (const bad of [undefined, null, "", "not-an-email", "a@b", ["x@y.com", "junk"]]) {
      const result = validateQuotationEmailRequest(validBody({ to: bad }));
      expect(result.ok, `expected rejection for ${JSON.stringify(bad)}`).toBe(false);
    }
  });

  it("rejects excess recipients and bcc beyond its cap", () => {
    const many = Array.from({ length: 11 }, (_, i) => `u${i}@example.com`);
    expect(validateQuotationEmailRequest(validBody({ to: many })).ok).toBe(false);
    const tooManyBcc = Array.from({ length: MAX_BCC_ADDRESSES + 1 }, (_, i) => `u${i}@example.com`);
    expect(validateQuotationEmailRequest(validBody({ bcc: tooManyBcc })).ok).toBe(false);
  });
});

describe("validateQuotationEmailRequest — attachment hardening", () => {
  it("neutralizes path traversal by reducing to a bare sanitized basename", () => {
    // Traversal input can never become a path — nodemailer uses the value
    // purely as the attachment's display filename.
    const unix = validateQuotationEmailRequest(validBody({ pdfFileName: "../../etc/passwd.pdf" }));
    expect(unix.ok).toBe(true);
    if (unix.ok) expect(unix.value.attachment?.filename).toBe("passwd.pdf");
    const win = validateQuotationEmailRequest(validBody({ pdfFileName: "..\\..\\win.pdf" }));
    expect(win.ok).toBe(true);
    if (win.ok) expect(win.value.attachment?.filename).toBe("win.pdf");
  });

  it("rejects non-PDF and degenerate filenames outright", () => {
    for (const name of ["invoice.html", "invoice.exe", ".pdf", "", "   "].map((n) => ({ pdfFileName: n }))) {
      const result = validateQuotationEmailRequest(validBody(name));
      expect(result.ok, `expected rejection for ${JSON.stringify(name)}`).toBe(false);
    }
  });

  it("sanitizes hostile-but-legal filenames instead of passing them through", () => {
    const result = validateQuotationEmailRequest(validBody({ pdfFileName: 'cümle "tırnak" <script>.pdf' }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.attachment?.filename).toMatch(/^[A-Za-z0-9._-]+\.pdf$/);
  });

  it("rejects payloads whose decoded size exceeds the ceiling", () => {
    // ~11 MB of base64 without even needing real entropy.
    const hugeBase64 = Buffer.alloc(0).buffer ? btoa("A".repeat(Math.ceil((MAX_PDF_BYTES * 1.1 * 4) / 3))) : "";
    const result = validateQuotationEmailRequest(validBody({ pdfBase64: hugeBase64 }));
    expect(result.ok).toBe(false);
  });

  it("rejects non-base64 junk and files that are not actually PDFs", () => {
    expect(validateQuotationEmailRequest(validBody({ pdfBase64: "not base64!!!" })).ok).toBe(false);
    expect(validateQuotationEmailRequest(validBody({ pdfBase64: btoa("<html>not a pdf</html>") })).ok).toBe(false);
  });
});

describe("validateQuotationEmailRequest — body/subject hardening", () => {
  it("strips CR/LF from subjects (header-injection surface)", () => {
    const result = validateQuotationEmailRequest(validBody({ subject: "Teklif\r\nBcc: victim@ornek.com" }));
    expect(result.ok).toBe(true);
    if (result.ok) expect(result.value.subject).not.toMatch(/[\r\n]/);
  });

  it("enforces the subject length cap and rejects wrong types", () => {
    expect(validateQuotationEmailRequest(validBody({ subject: "x".repeat(500) })).ok).toBe(true); // truncated, not rejected
    expect(validateQuotationEmailRequest(validBody({ subject: 42 })).ok).toBe(false);
    expect(validateQuotationEmailRequest(validBody({ html: { evil: true } })).ok).toBe(false);
    expect(validateQuotationEmailRequest(null).ok).toBe(false);
    expect(validateQuotationEmailRequest("string").ok).toBe(false);
  });
});

describe("checkRateLimit", () => {
  it("allows up to the cap inside the window and then refuses", () => {
    const bucket = new Map<string, number[]>();
    for (let i = 0; i < RATE_LIMIT_MAX_SENDS; i++) {
      expect(checkRateLimit(bucket, "user-1", 1000 + i * 1000)).toBe(true);
    }
    expect(checkRateLimit(bucket, "user-1", 1000 + RATE_LIMIT_MAX_SENDS * 1000)).toBe(false);
  });

  it("frees capacity as the window slides and isolates users", () => {
    const bucket = new Map<string, number[]>();
    for (let i = 0; i < RATE_LIMIT_MAX_SENDS; i++) checkRateLimit(bucket, "user-1", i * 1000);
    // Everything aged out of the 5-minute window.
    expect(checkRateLimit(bucket, "user-1", RATE_LIMIT_WINDOW_MS + 10_000)).toBe(true);
    expect(checkRateLimit(bucket, "user-2", 0)).toBe(true);
  });
});
