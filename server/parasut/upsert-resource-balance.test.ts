import { describe, expect, it } from "vitest";
import { hashResource, upsertResource } from "./upsert-resource.ts";
import type { JsonApiResource, MirrorDatabase } from "./types.ts";

/**
 * Guards the exact mapping the customer-balance bug traced back to:
 * upsertResource must write Paraşüt's `trl_balance` attribute through to the
 * mirror verbatim, as the JSON number/canonical-decimal-string Paraşüt sent
 * — never reformatted, never reinterpreted with Turkish locale rules (which
 * would corrupt a value like "70800.5" by treating the "." as a thousands
 * separator).
 */
describe("upsertResource — trl_balance sync mapping", () => {
  function fakeInsertDatabase(captured: { inserted: Record<string, unknown> | null }): MirrorDatabase {
    return {
      schema() {
        return this;
      },
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({ data: null, error: null }),
          insert(value: Record<string, unknown>) {
            captured.inserted = value;
            return this;
          },
          update() {
            return this;
          },
          then(resolve: (value: unknown) => unknown) {
            return Promise.resolve(resolve({ data: null, error: null }));
          },
        };
      },
    } as unknown as MirrorDatabase;
  }

  function fakeUpdateDatabase(
    existingHash: string,
    captured: { updated: Record<string, unknown> | null },
  ): MirrorDatabase {
    return {
      schema() {
        return this;
      },
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({
            data: { id: "row-1", payload_hash: existingHash },
            error: null,
          }),
          update(value: Record<string, unknown>) {
            captured.updated = value;
            return this;
          },
          insert() {
            return this;
          },
          then(resolve: (value: unknown) => unknown) {
            return Promise.resolve(resolve({ data: null, error: null }));
          },
        };
      },
    } as unknown as MirrorDatabase;
  }

  it("writes an API-native canonical decimal trl_balance through unchanged on insert", async () => {
    const resource: JsonApiResource = {
      id: "contact-1",
      type: "contacts",
      attributes: { name: "Metin İbrahim Sermet", trl_balance: "173120.00" },
      relationships: {},
    };
    const captured: { inserted: Record<string, unknown> | null } = { inserted: null };
    await upsertResource(
      fakeInsertDatabase(captured),
      { resourceType: "contacts", table: "contacts" },
      resource,
      { companyId: "company", parasutCompanyId: "666034", now: new Date("2026-07-25T00:00:00Z") },
    );
    const attributes = captured.inserted?.attributes as Record<string, unknown>;
    expect(attributes.trl_balance).toBe("173120.00");
  });

  it("preserves a JSON-number trl_balance as-is (no string coercion, no locale parsing)", async () => {
    const resource: JsonApiResource = {
      id: "contact-2",
      type: "contacts",
      attributes: { name: "Pino", trl_balance: 1127109.11 },
      relationships: {},
    };
    const captured: { inserted: Record<string, unknown> | null } = { inserted: null };
    await upsertResource(
      fakeInsertDatabase(captured),
      { resourceType: "contacts", table: "contacts" },
      resource,
      { companyId: "company", parasutCompanyId: "666034", now: new Date("2026-07-25T00:00:00Z") },
    );
    const attributes = captured.inserted?.attributes as Record<string, unknown>;
    expect(attributes.trl_balance).toBe(1127109.11);
  });

  it("also writes numericAttributeFields to their own typed columns for real-column numeric ordering", async () => {
    const resource: JsonApiResource = {
      id: "contact-5",
      type: "contacts",
      attributes: { name: "Pino", trl_balance: "1127109.11", usd_balance: "0", eur_balance: null },
      relationships: {},
    };
    const captured: { inserted: Record<string, unknown> | null } = { inserted: null };
    await upsertResource(
      fakeInsertDatabase(captured),
      { resourceType: "contacts", table: "contacts", numericAttributeFields: ["trl_balance", "usd_balance", "eur_balance", "gbp_balance"] },
      resource,
      { companyId: "company", parasutCompanyId: "666034", now: new Date("2026-07-25T00:00:00Z") },
    );
    expect(captured.inserted?.trl_balance).toBe(1127109.11);
    expect(captured.inserted?.usd_balance).toBe(0);
    expect(captured.inserted?.eur_balance).toBeNull();
    expect(captured.inserted?.gbp_balance).toBeNull(); // absent from attributes entirely
    // The JSON blob keeps the original string form for display purposes.
    expect((captured.inserted?.attributes as Record<string, unknown>).trl_balance).toBe("1127109.11");
  });

  it("does not add any typed-column keys when numericAttributeFields is omitted (every other resource type)", async () => {
    const resource: JsonApiResource = {
      id: "invoice-1",
      type: "sales_invoices",
      attributes: { gross_total: "1200.00" },
      relationships: {},
    };
    const captured: { inserted: Record<string, unknown> | null } = { inserted: null };
    await upsertResource(
      fakeInsertDatabase(captured),
      { resourceType: "sales_invoices", table: "sales_invoices" },
      resource,
      { companyId: "company", parasutCompanyId: "666034", now: new Date("2026-07-25T00:00:00Z") },
    );
    expect(captured.inserted).not.toHaveProperty("gross_total");
  });

  it("overwrites a stale mirrored trl_balance with the fresh value on a legitimate resync (the Metin İbrahim Sermet case)", async () => {
    const staleResource: JsonApiResource = {
      id: "contact-3",
      type: "contacts",
      attributes: { name: "Metin İbrahim Sermet", trl_balance: "35120.00" },
      relationships: {},
    };
    const staleHash = hashResource(staleResource);

    const freshResource: JsonApiResource = {
      id: "contact-3",
      type: "contacts",
      attributes: { name: "Metin İbrahim Sermet", trl_balance: "173120.00" },
      relationships: {},
    };
    const captured: { updated: Record<string, unknown> | null } = { updated: null };
    const result = await upsertResource(
      fakeUpdateDatabase(staleHash, captured),
      { resourceType: "contacts", table: "contacts", numericAttributeFields: ["trl_balance", "usd_balance", "eur_balance", "gbp_balance"] },
      freshResource,
      { companyId: "company", parasutCompanyId: "666034", now: new Date("2026-07-25T00:00:00Z") },
    );
    expect(result.outcome).toBe("updated");
    const attributes = captured.updated?.attributes as Record<string, unknown>;
    expect(attributes.trl_balance).toBe("173120.00");
    // The typed column that ordering actually reads must reflect the fresh
    // value too, not just the display-only JSON blob.
    expect(captured.updated?.trl_balance).toBe(173120);
  });

  it("skips the write (touch-only) when the payload hash is unchanged, never silently dropping a real balance change", async () => {
    const resource: JsonApiResource = {
      id: "contact-4",
      type: "contacts",
      attributes: { name: "Unchanged Co", trl_balance: "5000.00" },
      relationships: {},
    };
    const sameHash = hashResource(resource);
    const captured: { updated: Record<string, unknown> | null } = { updated: null };
    const result = await upsertResource(
      fakeUpdateDatabase(sameHash, captured),
      { resourceType: "contacts", table: "contacts" },
      resource,
      { companyId: "company", parasutCompanyId: "666034", now: new Date("2026-07-25T00:00:00Z") },
    );
    expect(result.outcome).toBe("unchanged");
    // Touch-only update must not include an `attributes` key at all — proves
    // this path can never accidentally overwrite a fresh balance with a
    // reformatted/reinterpreted copy of itself.
    expect(captured.updated).toEqual({ last_seen_at: "2026-07-25T00:00:00.000Z" });
  });

  it("writes sales_invoices' gross_total (Tutar) to its own typed column the same way, reusing the same numericAttributeFields mechanism", async () => {
    const resource: JsonApiResource = {
      id: "invoice-1",
      type: "sales_invoices",
      attributes: { invoice_no: "A-1", gross_total: "1127109.11" },
      relationships: {},
    };
    const captured: { inserted: Record<string, unknown> | null } = { inserted: null };
    await upsertResource(
      fakeInsertDatabase(captured),
      { resourceType: "sales_invoices", table: "sales_invoices", numericAttributeFields: ["gross_total"] },
      resource,
      { companyId: "company", parasutCompanyId: "666034", now: new Date("2026-07-25T00:00:00Z") },
    );
    expect(captured.inserted?.gross_total).toBe(1127109.11);
    expect((captured.inserted?.attributes as Record<string, unknown>).gross_total).toBe("1127109.11");
  });
});
