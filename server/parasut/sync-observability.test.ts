import { describe, expect, it } from "vitest";
import {
  createErrorSummary,
  createSyncSummary,
  sanitizeObservabilityText,
} from "./sync-observability.ts";

function summary(status: "completed" | "partial" | "failed") {
  return createSyncSummary({
    runId: "run-1",
    resourceType: "contacts",
    status,
    pages: 3,
    observed: 10,
    inserted: 4,
    updated: 2,
    unchanged: 3,
    errors: status === "completed" ? 0 : 1,
    lastCompletedPage: status === "failed" ? 2 : 3,
    startedAt: new Date("2026-06-14T00:00:00.000Z"),
    completedAt: new Date("2026-06-14T00:00:01.250Z"),
  });
}

describe("createSyncSummary", () => {
  it.each(["completed", "partial", "failed"] as const)(
    "creates a structured %s run summary",
    (status) => {
      expect(summary(status)).toMatchObject({
        run_id: "run-1",
        resource_type: "contacts",
        status,
        pages: 3,
        duration_ms: 1250,
      });
    },
  );

  it("reports checkpoint progress", () => {
    expect(summary("failed").last_completed_page).toBe(2);
  });

  it("does not expose arbitrary metadata or payloads", () => {
    const output = summary("completed") as unknown as Record<string, unknown>;
    expect(output).not.toHaveProperty("raw_payload");
    expect(output).not.toHaveProperty("request_metadata");
    expect(Object.keys(output)).toEqual([
      "run_id",
      "resource_type",
      "status",
      "pages",
      "observed",
      "inserted",
      "updated",
      "unchanged",
      "errors",
      "last_completed_page",
      "duration_ms",
    ]);
  });
});

describe("sanitizeObservabilityText", () => {
  it("redacts tokens and query secrets", () => {
    const sanitized = sanitizeObservabilityText(
      "Bearer abc123 access_token=secret https://x.test?a=1&refresh_token=hidden",
    );

    expect(sanitized).not.toContain("abc123");
    expect(sanitized).not.toContain("secret");
    expect(sanitized).not.toContain("hidden");
    expect(sanitized).toContain("[REDACTED]");
  });

  it("redacts email addresses and phone numbers", () => {
    const sanitized = sanitizeObservabilityText(
      "Contact person@example.com or +90 (555) 123 45 67",
    );

    expect(sanitized).not.toContain("person@example.com");
    expect(sanitized).not.toContain("555");
    expect(sanitized.match(/\[REDACTED\]/g)).toHaveLength(2);
  });

  it("truncates deterministically", () => {
    const input = "x".repeat(100);
    expect(sanitizeObservabilityText(input, 20)).toBe("x".repeat(17) + "...");
    expect(sanitizeObservabilityText(input, 20)).toHaveLength(20);
  });

  it.each([
    ["bearer token", "Bearer abc.def.ghi", "abc.def.ghi"],
    ["access token", "access_token=xyz123", "xyz123"],
    ["refresh token", "refresh_token=abc456", "abc456"],
    ["API key", "api_key=secret", "secret"],
    ["client secret", "client_secret=topsecret", "topsecret"],
    ["password", "password=hunter2", "hunter2"],
    ["email", "email: user@example.com", "user@example.com"],
    ["phone", "phone: +90 555 123 45 67", "+90 555 123 45 67"],
  ])("redacts an adversarial %s", (_label, input, forbidden) => {
    const sanitized = sanitizeObservabilityText(input);

    expect(sanitized).not.toContain(forbidden);
    expect(sanitized).toContain("[REDACTED]");
  });

  it("redacts nested JSON and mixed secret formats", () => {
    const sanitized = sanitizeObservabilityText(
      JSON.stringify({
        auth: {
          access_token: "xyz123",
          refresh_token: "abc456",
          password: "hunter2",
        },
        contact: {
          email: "user@example.com",
          phone: "+90 555 123 45 67",
        },
        authorization: "Bearer abc.def.ghi",
      }),
    );

    for (const forbidden of [
      "xyz123",
      "abc456",
      "hunter2",
      "user@example.com",
      "+90 555 123 45 67",
      "abc.def.ghi",
    ]) {
      expect(sanitized).not.toContain(forbidden);
    }
  });

  it("redacts URL-encoded query secrets", () => {
    const sanitized = sanitizeObservabilityText(
      "https://example.test/callback%3Faccess_token%3Dxyz123%26refresh_token%3Dabc456%26api_key%3Dsecret",
    );

    expect(sanitized).not.toContain("xyz123");
    expect(sanitized).not.toContain("abc456");
    expect(sanitized).not.toContain("secret");
  });

  it("normalizes multiline errors", () => {
    expect(
      sanitizeObservabilityText("Error: failed\n    at first\r\n\tat second"),
    ).toBe("Error: failed at first at second");
  });

  it.each([
    [1, "."],
    [2, ".."],
    [3, "..."],
    [4, "a..."],
  ])("keeps truncated output within a short limit of %i", (limit, expected) => {
    expect(sanitizeObservabilityText("abcdef", limit)).toBe(expected);
  });
});

describe("createErrorSummary", () => {
  it("creates a sanitized retryable error summary", () => {
    expect(
      createErrorSummary({
        code: "HTTP_429",
        message: "api_key=private-key for person@example.com",
        retryable: true,
      }),
    ).toEqual({
      code: "HTTP_429",
      message: "api_key=[REDACTED] for [REDACTED]",
      retryable: true,
    });
  });

  it("does not serialize raw payload objects", () => {
    const result = createErrorSummary({
      code: null,
      message: new Error("Request failed"),
      retryable: false,
    });

    expect(result).toEqual({
      code: null,
      message: "Request failed",
      retryable: false,
    });
    expect(result).not.toHaveProperty("payload");
  });

  it("prevents error codes from leaking secrets or personal data", () => {
    const result = createErrorSummary({
      code: "access_token=xyz123 user@example.com +90 555 123 45 67",
      message:
        "Bearer abc.def.ghi refresh_token=abc456 api_key=secret password=hunter2",
      retryable: false,
    });
    const serialized = JSON.stringify(result);

    for (const forbidden of [
      "xyz123",
      "user@example.com",
      "+90 555 123 45 67",
      "abc.def.ghi",
      "abc456",
      "secret",
      "hunter2",
    ]) {
      expect(serialized).not.toContain(forbidden);
    }
  });
});
