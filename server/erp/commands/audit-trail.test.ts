import { describe, expect, it } from "vitest";
import { redactForAudit } from "./audit-trail.ts";

describe("redactForAudit", () => {
  it("redacts a Bearer token appearing anywhere in a string value", () => {
    expect(redactForAudit({ message: "request failed: Authorization Bearer abc123.def456 was rejected" })).toEqual({
      message: "request failed: Authorization Bearer [REDACTED] was rejected",
    });
  });

  it("redacts a leaked sb_secret_ style Supabase key appearing in a string value", () => {
    expect(redactForAudit({ note: "connected with sb_secret_FAKE_TEST_FIXTURE_DO_NOT_USE" })).toEqual({ note: "connected with [REDACTED]" });
  });

  it("redacts the entire value of any key that looks credential-shaped, regardless of casing", () => {
    const input = { accessToken: "real-token-value", REFRESH_TOKEN: "real-refresh", password: "hunter2", apiKey: "key-123", Authorization: "Bearer x" };
    const result = redactForAudit(input);
    expect(result).toEqual({
      accessToken: "[REDACTED]",
      REFRESH_TOKEN: "[REDACTED]",
      password: "[REDACTED]",
      apiKey: "[REDACTED]",
      Authorization: "[REDACTED]",
    });
  });

  it("recurses into nested objects and arrays", () => {
    const input = { provider: { raw: { headers: { authorization: "Bearer nested-secret" } } }, list: [{ token: "in-array" }] };
    const result = redactForAudit(input);
    expect(result).toEqual({ provider: { raw: { headers: { authorization: "[REDACTED]" } } }, list: [{ token: "[REDACTED]" }] });
  });

  it("leaves ordinary non-secret data untouched", () => {
    const input = { name: "Acme Co", email: "a@b.com", count: 5, active: true, tags: ["a", "b"] };
    expect(redactForAudit(input)).toEqual(input);
  });

  it("handles null and undefined without throwing", () => {
    expect(redactForAudit(null)).toBeNull();
    expect(redactForAudit(undefined)).toBeUndefined();
  });
});
