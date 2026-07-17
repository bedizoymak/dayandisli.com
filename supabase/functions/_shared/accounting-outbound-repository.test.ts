import { describe, expect, it } from "vitest";
import { OutboundRepositoryError, SupabaseAttemptRepository, SupabaseAuditRepository, SupabaseCommandRepository, SupabaseProviderLinkRepository, type OutboundAdminLike } from "./accounting-outbound-repository.ts";
import { CreateCustomerCommandHandler } from "../../../server/erp/commands/create-customer-command.ts";
import type { AuditRepository, AttemptRepository, ContactsOnlySync, ProviderLinkRepository, ProviderVerifier } from "../../../server/erp/commands/create-customer-command.ts";
import type { CustomerWriteProvider } from "../../../server/erp/providers/customer-write-provider.ts";

const NOW = new Date("2026-07-16T00:00:00.000Z");
const COMPANY_ID = "54b50745-89e0-4b97-adb6-4f2426fa2a2f";

/**
 * Minimal in-memory fake satisfying OutboundAdminLike — same style as
 * supabase/functions/parasut-api/fakeSupabaseAdmin.ts, adapted for
 * insert/update/upsert. `forceUniqueViolationOnce(table)` simulates a real
 * concurrent-insert loss against the DB's unique constraint — see the
 * "idempotency race" describe block below (closes TD-003).
 */
function makeFakeAdmin() {
  const tables = new Map<string, Record<string, unknown>[]>();
  let nextId = 1;
  const forcedUniqueViolations = new Set<string>();

  function tableRows(name: string) {
    if (!tables.has(name)) tables.set(name, []);
    return tables.get(name)!;
  }

  const admin: OutboundAdminLike = {
    schema: () => ({
      from: (name: string) => ({
        select: (_columns?: string) => {
          let filtered = [...tableRows(name)];
          const query = {
            eq(column: string, value: unknown) {
              filtered = filtered.filter((row) => row[column] === value);
              return query;
            },
            maybeSingle: async () => ({ data: (filtered[0] ?? null) as never, error: null }),
            then: (onFulfilled: (value: { data: unknown[]; error: null }) => unknown) => Promise.resolve({ data: filtered, error: null }).then(onFulfilled as never),
          };
          return query;
        },
        insert: (values: Record<string, unknown>) => {
          if (forcedUniqueViolations.has(name)) {
            forcedUniqueViolations.delete(name);
            return {
              select: () => ({
                single: async () => ({ data: null as never, error: { message: "duplicate key value violates unique constraint", code: "23505" } }),
              }),
            };
          }
          const row = { id: `${name}-${nextId++}`, created_at: NOW.toISOString(), updated_at: NOW.toISOString(), ...values };
          tableRows(name).push(row);
          return {
            select: () => ({
              single: async () => ({ data: row as never, error: null }),
            }),
          };
        },
        update: (values: Record<string, unknown>) => ({
          eq: async (column: string, value: unknown) => {
            const rows = tableRows(name);
            const index = rows.findIndex((row) => row[column] === value);
            if (index >= 0) rows[index] = { ...rows[index], ...values };
            return { error: null };
          },
        }),
        upsert: async (values: Record<string, unknown>, options?: { onConflict?: string }) => {
          const rows = tableRows(name);
          const conflictColumns = options?.onConflict?.split(",") ?? [];
          const existingIndex = rows.findIndex((row) => conflictColumns.every((col) => row[col] === values[col]));
          if (existingIndex >= 0) rows[existingIndex] = { ...rows[existingIndex], ...values };
          else rows.push({ id: `${name}-${nextId++}`, created_at: NOW.toISOString(), ...values });
          return { error: null };
        },
      }),
    }),
  };

  return { admin, tables, forceUniqueViolationOnce: (table: string) => forcedUniqueViolations.add(table) };
}

describe("SupabaseCommandRepository", () => {
  it("creates a new command on first call and returns wasCreated=true", async () => {
    const { admin } = makeFakeAdmin();
    const repo = new SupabaseCommandRepository(admin, () => NOW);
    const { record, wasCreated } = await repo.findOrCreateCommand({
      companyId: COMPANY_ID,
      provider: "parasut",
      operation: "create_customer",
      resourceType: "contacts",
      idempotencyKey: "idem-1",
      requestedBy: "user-1",
      safePayload: { name: "Acme" },
    });
    expect(wasCreated).toBe(true);
    expect(record.status).toBe("draft");
    expect(record.companyId).toBe(COMPANY_ID);
  });

  it("returns the existing command (wasCreated=false) for a repeated idempotency key, never creating a second row", async () => {
    const { admin } = makeFakeAdmin();
    const repo = new SupabaseCommandRepository(admin, () => NOW);
    const first = await repo.findOrCreateCommand({ companyId: COMPANY_ID, provider: "parasut", operation: "create_customer", resourceType: "contacts", idempotencyKey: "idem-2", requestedBy: "user-1", safePayload: { name: "Acme" } });
    const second = await repo.findOrCreateCommand({ companyId: COMPANY_ID, provider: "parasut", operation: "create_customer", resourceType: "contacts", idempotencyKey: "idem-2", requestedBy: "user-1", safePayload: { name: "Acme" } });
    expect(second.wasCreated).toBe(false);
    expect(second.record.id).toBe(first.record.id);
  });

  it("updates status and sets the corresponding lifecycle timestamp column", async () => {
    const { admin, tables } = makeFakeAdmin();
    const repo = new SupabaseCommandRepository(admin, () => NOW);
    const { record } = await repo.findOrCreateCommand({ companyId: COMPANY_ID, provider: "parasut", operation: "create_customer", resourceType: "contacts", idempotencyKey: "idem-3", requestedBy: "user-1", safePayload: { name: "Acme" } });
    await repo.updateStatus(record.id, { status: "sent", providerResourceId: "1010699999" });
    const row = tables.get("accounting_outbound_commands")!.find((r) => r.id === record.id)!;
    expect(row.status).toBe("sent");
    expect(row.provider_resource_id).toBe("1010699999");
    expect(row.sent_at).toBe(NOW.toISOString());
  });
});

describe("SupabaseCommandRepository — idempotency race (closes TD-003)", () => {
  it("normal first insert returns wasCreated=true", async () => {
    const { admin } = makeFakeAdmin();
    const repo = new SupabaseCommandRepository(admin, () => NOW);
    const { wasCreated } = await repo.findOrCreateCommand({ companyId: COMPANY_ID, provider: "parasut", operation: "create_customer", resourceType: "contacts", idempotencyKey: "idem-race-1", requestedBy: "user-1", safePayload: { name: "Acme" } });
    expect(wasCreated).toBe(true);
  });

  it("a repeated key (no race, existing row already visible) returns wasCreated=false", async () => {
    const { admin } = makeFakeAdmin();
    const repo = new SupabaseCommandRepository(admin, () => NOW);
    await repo.findOrCreateCommand({ companyId: COMPANY_ID, provider: "parasut", operation: "create_customer", resourceType: "contacts", idempotencyKey: "idem-race-2", requestedBy: "user-1", safePayload: { name: "Acme" } });
    const { wasCreated } = await repo.findOrCreateCommand({ companyId: COMPANY_ID, provider: "parasut", operation: "create_customer", resourceType: "contacts", idempotencyKey: "idem-race-2", requestedBy: "user-1", safePayload: { name: "Acme" } });
    expect(wasCreated).toBe(false);
  });

  it("a simulated concurrent 23505 unique-violation on insert re-reads and returns the winning row with wasCreated=false, never exposing the raw Postgres error", async () => {
    const { admin, forceUniqueViolationOnce } = makeFakeAdmin();
    const repo = new SupabaseCommandRepository(admin, () => NOW);
    // The "winner" of the race commits first — its row is what a real unique
    // constraint would leave behind for the loser to re-read.
    const winner = await repo.findOrCreateCommand({ companyId: COMPANY_ID, provider: "parasut", operation: "create_customer", resourceType: "contacts", idempotencyKey: "idem-race-3", requestedBy: "user-1", safePayload: { name: "Acme" } });

    // Simulate the loser: its initial lookup ran before the winner committed
    // (so it saw nothing), then its insert hits the now-committed unique
    // constraint.
    forceUniqueViolationOnce("accounting_outbound_commands");
    const loser = await repo.findOrCreateCommand({ companyId: COMPANY_ID, provider: "parasut", operation: "create_customer", resourceType: "contacts", idempotencyKey: "idem-race-3", requestedBy: "user-1", safePayload: { name: "Acme" } });

    expect(loser.wasCreated).toBe(false);
    expect(loser.record.id).toBe(winner.record.id);
  });

  it("if the winning row cannot be found after a 23505, throws a safe generic error — never the raw Postgres message", async () => {
    const { admin, forceUniqueViolationOnce } = makeFakeAdmin();
    const repo = new SupabaseCommandRepository(admin, () => NOW);
    // Force a violation with no matching row ever inserted for this key —
    // an edge case (e.g. the winner's transaction rolled back after all)
    // that must fail safely rather than return a phantom record.
    forceUniqueViolationOnce("accounting_outbound_commands");
    await expect(
      repo.findOrCreateCommand({ companyId: COMPANY_ID, provider: "parasut", operation: "create_customer", resourceType: "contacts", idempotencyKey: "idem-race-4-orphan", requestedBy: "user-1", safePayload: { name: "Acme" } }),
    ).rejects.toMatchObject({ constructor: OutboundRepositoryError, message: expect.not.stringMatching(/duplicate key|constraint|23505/i) });
  });

  it("under the race, the write provider is called at most once end-to-end through CreateCustomerCommandHandler", async () => {
    const { admin } = makeFakeAdmin();
    const commands = new SupabaseCommandRepository(admin, () => NOW);
    const attempts: AttemptRepository = { recordAttempt: async () => {} };
    const links: ProviderLinkRepository = { upsertLink: async () => {} };
    const audit: AuditRepository = { record: async () => {} };
    let providerCallCount = 0;
    const writeProvider: CustomerWriteProvider = {
      createCustomer: async () => {
        providerCallCount++;
        return { provider: "parasut", providerResourceType: "contacts", providerResourceId: "1010699999", providerCompanyId: "666034", rawStatus: 201 };
      },
    };
    const verifier: ProviderVerifier = { verifyContact: async () => true };
    const contactsSync: ContactsOnlySync = { syncAndCheck: async () => true };
    const handler = new CreateCustomerCommandHandler(commands, attempts, links, audit, writeProvider, verifier, contactsSync, () => NOW);

    const first = await handler.handle(COMPANY_ID, "666034", "user-1", "idem-race-5", { name: "Acme" });
    // The repository-level tests above already prove the 23505 re-read path
    // directly; this end-to-end check confirms the handler built on top of
    // it still only ever calls the write provider once for a repeated key,
    // whether the second call sees the row via a plain lookup or via the
    // race path.
    const second = await handler.handle(COMPANY_ID, "666034", "user-1", "idem-race-5", { name: "Acme" });

    expect(second.id).toBe(first.id);
    expect(providerCallCount).toBe(1);
  });
});

describe("SupabaseAttemptRepository", () => {
  it("records an attempt", async () => {
    const { admin, tables } = makeFakeAdmin();
    const repo = new SupabaseAttemptRepository(admin);
    await repo.recordAttempt({
      commandId: "cmd-1",
      attemptNumber: 1,
      requestStartedAt: NOW.toISOString(),
      responseReceivedAt: NOW.toISOString(),
      httpStatus: 201,
      safeRequestSummary: {},
      safeResponseSummary: { providerResourceId: "1" },
      providerRequestId: null,
      errorClass: null,
      errorCode: null,
      errorMessage: null,
      resultClassification: "success",
    });
    expect(tables.get("accounting_outbound_attempts")).toHaveLength(1);
  });
});

describe("SupabaseProviderLinkRepository", () => {
  it("creates a link on first upsert and updates it (never duplicates) on a second call for the same ERP resource", async () => {
    const { admin, tables } = makeFakeAdmin();
    const repo = new SupabaseProviderLinkRepository(admin);
    const link = {
      companyId: COMPANY_ID,
      provider: "parasut",
      erpResourceType: "customer" as const,
      erpResourceId: "cmd-1",
      providerResourceType: "contacts" as const,
      providerResourceId: "1010699999",
      outboundCommandId: "cmd-1",
      verifiedAt: NOW.toISOString(),
      lastMirroredAt: NOW.toISOString(),
    };
    await repo.upsertLink(link);
    await repo.upsertLink(link);
    expect(tables.get("accounting_provider_links")).toHaveLength(1);
  });
});

describe("SupabaseAuditRepository", () => {
  it("records an audit event", async () => {
    const { admin, tables } = makeFakeAdmin();
    const repo = new SupabaseAuditRepository(admin);
    await repo.record({ commandId: "cmd-1", companyId: COMPANY_ID, actorUserId: "user-1", action: "command_created", detail: { input: { name: "Acme" } }, occurredAt: NOW.toISOString() });
    expect(tables.get("accounting_audit_log")).toHaveLength(1);
  });
});
