import { describe, expect, it } from "vitest";
import {
  CreateCustomerCommandHandler,
  validateCreateCustomerInput,
  type AttemptRecord,
  type AttemptRepository,
  type AuditEvent,
  type AuditRepository,
  type CommandRepository,
  type ContactsOnlySync,
  type CreateCustomerCommandRecord,
  type ProviderLinkRepository,
  type ProviderVerifier,
} from "./create-customer-command.ts";
import { ProviderWriteError } from "../providers/customer-write-provider.ts";
import type { CustomerWriteProvider } from "../providers/customer-write-provider.ts";

const NOW = new Date("2026-07-16T00:00:00.000Z");
const COMPANY_ID = "54b50745-89e0-4b97-adb6-4f2426fa2a2f";
const PROVIDER_COMPANY_ID = "666034";
const ACTOR_ID = "user-1";

function makeCommandRepository() {
  const records = new Map<string, CreateCustomerCommandRecord>();
  const byKey = new Map<string, string>();
  let nextId = 1;
  const repository: CommandRepository = {
    async findOrCreateCommand(input) {
      const key = `${input.companyId}|${input.provider}|${input.operation}|${input.idempotencyKey}`;
      const existingId = byKey.get(key);
      if (existingId) return { record: records.get(existingId)!, wasCreated: false };

      const id = `cmd-${nextId++}`;
      const full: CreateCustomerCommandRecord = {
        id,
        companyId: input.companyId,
        provider: input.provider,
        operation: input.operation,
        resourceType: input.resourceType,
        status: "draft",
        idempotencyKey: input.idempotencyKey,
        requestedBy: input.requestedBy,
        safePayload: input.safePayload,
        providerResourceId: null,
        verificationStatus: null,
        mirrorStatus: null,
        errorCode: null,
        errorMessage: null,
        createdAt: NOW.toISOString(),
        updatedAt: NOW.toISOString(),
      };
      records.set(id, full);
      byKey.set(key, id);
      return { record: full, wasCreated: true };
    },
    async updateStatus(commandId, patch) {
      const existing = records.get(commandId);
      if (!existing) throw new Error("not found");
      records.set(commandId, { ...existing, ...patch, updatedAt: NOW.toISOString() });
    },
  };
  return { repository, records };
}

function makeAuditRepository() {
  const events: AuditEvent[] = [];
  const repository: AuditRepository = { async record(event) { events.push(event); } };
  return { repository, events };
}

function makeAttemptRepository() {
  const attempts: AttemptRecord[] = [];
  const repository: AttemptRepository = { async recordAttempt(attempt) { attempts.push(attempt); } };
  return { repository, attempts };
}

function makeLinkRepository() {
  const links: unknown[] = [];
  const repository: ProviderLinkRepository = { async upsertLink(link) { links.push(link); } };
  return { repository, links };
}

const alwaysVerified: ProviderVerifier = { verifyContact: async () => true };
const neverVerified: ProviderVerifier = { verifyContact: async () => false };
const alwaysMirrored: ContactsOnlySync = { syncAndCheck: async () => true };
const neverMirrored: ContactsOnlySync = { syncAndCheck: async () => false };

function makeHandler(overrides: {
  writeProvider?: CustomerWriteProvider;
  verifier?: ProviderVerifier;
  contactsSync?: ContactsOnlySync;
}) {
  const commandRepo = makeCommandRepository();
  const auditRepo = makeAuditRepository();
  const attemptRepo = makeAttemptRepository();
  const linkRepo = makeLinkRepository();
  const writeProvider = overrides.writeProvider ?? { createCustomer: async () => ({ provider: "parasut", providerResourceType: "contacts" as const, providerResourceId: "1010699999", providerCompanyId: PROVIDER_COMPANY_ID, rawStatus: 201 }) };

  const handler = new CreateCustomerCommandHandler(
    commandRepo.repository,
    attemptRepo.repository,
    linkRepo.repository,
    auditRepo.repository,
    writeProvider,
    overrides.verifier ?? alwaysVerified,
    overrides.contactsSync ?? alwaysMirrored,
    () => NOW,
  );

  return { handler, ...commandRepo, ...auditRepo, ...attemptRepo, ...linkRepo };
}

describe("validateCreateCustomerInput", () => {
  it("requires a non-blank name", () => {
    expect(validateCreateCustomerInput({ name: "" })).toContain("Müşteri adı zorunludur.");
    expect(validateCreateCustomerInput({ name: "Acme" })).toEqual([]);
  });

  it("rejects a malformed email but allows a missing one", () => {
    expect(validateCreateCustomerInput({ name: "Acme", email: "not-an-email" })).toContain("E-posta adresi geçersiz.");
    expect(validateCreateCustomerInput({ name: "Acme" })).toEqual([]);
  });

  it("rejects a negative payment term", () => {
    expect(validateCreateCustomerInput({ name: "Acme", paymentTermDays: -1 })).toContain("Vade günü negatif olamaz.");
    expect(validateCreateCustomerInput({ name: "Acme", paymentTermDays: 30 })).toEqual([]);
  });
});

describe("CreateCustomerCommandHandler.handle — full success path", () => {
  it("walks the complete lifecycle to mirrored_back, recording every step and creating the provider link", async () => {
    const { handler, records, events, attempts, links } = makeHandler({});
    const result = await handler.handle(COMPANY_ID, PROVIDER_COMPANY_ID, ACTOR_ID, "idem-1", { name: "Acme Co" });

    expect(result.status).toBe("mirrored_back");
    expect(result.providerResourceId).toBe("1010699999");
    expect(records.get(result.id)?.status).toBe("mirrored_back");
    expect(events.map((e) => e.action)).toEqual(["command_created", "validated", "sending", "sent", "verified_in_provider", "mirrored_back"]);
    expect(attempts).toHaveLength(1);
    expect(attempts[0].resultClassification).toBe("success");
    expect(links).toHaveLength(1);
  });
});

describe("CreateCustomerCommandHandler.handle — validation failure", () => {
  it("fails fast without ever calling the write provider", async () => {
    let providerCalled = false;
    const { handler, records, events, attempts } = makeHandler({
      writeProvider: { createCustomer: async () => { providerCalled = true; return { provider: "parasut", providerResourceType: "contacts", providerResourceId: "x", providerCompanyId: PROVIDER_COMPANY_ID, rawStatus: 201 }; } },
    });

    const result = await handler.handle(COMPANY_ID, PROVIDER_COMPANY_ID, ACTOR_ID, "idem-2", { name: "" });

    expect(result.status).toBe("failed");
    expect(providerCalled).toBe(false);
    expect(records.get(result.id)?.status).toBe("failed");
    expect(events.map((e) => e.action)).toEqual(["command_created", "failed"]);
    expect(attempts).toHaveLength(0);
  });
});

describe("CreateCustomerCommandHandler.handle — provider write failure", () => {
  it("marks the command failed with a safe message for a validation-shaped provider error", async () => {
    const { handler, records } = makeHandler({
      writeProvider: { createCustomer: async () => { throw new ProviderWriteError("tax_number is invalid", true); } },
    });
    const result = await handler.handle(COMPANY_ID, PROVIDER_COMPANY_ID, ACTOR_ID, "idem-3", { name: "Acme", taxNumber: "bad" });
    expect(result.status).toBe("failed");
    expect(result.errorMessage).toBe("tax_number is invalid");
    expect(records.get(result.id)?.status).toBe("failed");
  });

  it("marks the command unknown_result — never failed — for an unknown-outcome (timeout) provider error", async () => {
    const { handler, records, events } = makeHandler({
      writeProvider: { createCustomer: async () => { throw new ProviderWriteError("timed out", false, true); } },
    });
    const result = await handler.handle(COMPANY_ID, PROVIDER_COMPANY_ID, ACTOR_ID, "idem-4", { name: "Acme" });
    expect(result.status).toBe("unknown_result");
    expect(records.get(result.id)?.status).toBe("unknown_result");
    expect(events.map((e) => e.action)).not.toContain("failed");
  });
});

describe("CreateCustomerCommandHandler.handle — GET verification failure", () => {
  it("preserves the provider id, marks unknown_result, and never reaches mirrored_back", async () => {
    const { handler, records } = makeHandler({ verifier: neverVerified });
    const result = await handler.handle(COMPANY_ID, PROVIDER_COMPANY_ID, ACTOR_ID, "idem-5", { name: "Acme" });
    expect(result.status).toBe("unknown_result");
    expect(result.providerResourceId).toBe("1010699999");
    expect(records.get(result.id)?.status).toBe("unknown_result");
  });
});

describe("CreateCustomerCommandHandler.handle — mirror sync failure", () => {
  it("marks unknown_result when the contacts-only sync does not find the record, never mirrored_back", async () => {
    const { handler, records, links } = makeHandler({ contactsSync: neverMirrored });
    const result = await handler.handle(COMPANY_ID, PROVIDER_COMPANY_ID, ACTOR_ID, "idem-6", { name: "Acme" });
    expect(result.status).toBe("unknown_result");
    expect(result.providerResourceId).toBe("1010699999");
    expect(records.get(result.id)?.status).toBe("unknown_result");
    expect(links).toHaveLength(0); // never link an unconfirmed mirror
  });
});

describe("CreateCustomerCommandHandler.handle — idempotency", () => {
  it("returns the existing command state and never calls the write provider again for a repeated idempotency key", async () => {
    let callCount = 0;
    const { handler, events } = makeHandler({
      writeProvider: { createCustomer: async () => { callCount++; return { provider: "parasut", providerResourceType: "contacts", providerResourceId: "1010699999", providerCompanyId: PROVIDER_COMPANY_ID, rawStatus: 201 }; } },
    });

    const first = await handler.handle(COMPANY_ID, PROVIDER_COMPANY_ID, ACTOR_ID, "idem-7", { name: "Acme" });
    const second = await handler.handle(COMPANY_ID, PROVIDER_COMPANY_ID, ACTOR_ID, "idem-7", { name: "Acme" });

    expect(callCount).toBe(1);
    expect(second.id).toBe(first.id);
    expect(second.status).toBe(first.status);
    expect(events.filter((e) => e.action === "idempotent_replay")).toHaveLength(1);
  });

  it("treats the same idempotency key from a different company as a distinct command (tenant-scoped uniqueness)", async () => {
    let callCount = 0;
    const { handler } = makeHandler({
      writeProvider: { createCustomer: async () => { callCount++; return { provider: "parasut", providerResourceType: "contacts", providerResourceId: "1010699999", providerCompanyId: PROVIDER_COMPANY_ID, rawStatus: 201 }; } },
    });
    await handler.handle(COMPANY_ID, PROVIDER_COMPANY_ID, ACTOR_ID, "idem-shared", { name: "Acme" });
    await handler.handle("11111111-1111-4111-8111-111111111111", PROVIDER_COMPANY_ID, ACTOR_ID, "idem-shared", { name: "Acme" });
    expect(callCount).toBe(2);
  });

  it("under two truly concurrent submissions with the same idempotency key, the write provider is invoked at most once — the surviving duplicate replays the winner's result", async () => {
    // Simulates the real race window: two requests both read "not found" from
    // findOrCreateCommand before either has written its row (an artificial
    // await forces interleaving, since the plain in-memory Map used elsewhere
    // in this file has no await point between check and set and so can never
    // demonstrate a race). The actual safety net for this race in production
    // is the database's unique constraint on
    // (company_id, provider, operation, idempotency_key) — see
    // docs/migration-proposals/20260716130000_accounting_outbound_commands.sql
    // — this test documents the expected behavior when that constraint wins:
    // the loser's insert fails and it must re-read the winner's row rather
    // than proceed, which is exactly what findOrCreateCommand's contract requires.
    const records = new Map<string, CreateCustomerCommandRecord>();
    let winnerId: string | null = null;
    let nextId = 1;
    const repository: CommandRepository = {
      async findOrCreateCommand(input) {
        await new Promise((resolve) => setTimeout(resolve, 1));
        if (winnerId) return { record: records.get(winnerId)!, wasCreated: false };
        const id = `cmd-${nextId++}`;
        winnerId = id;
        const full: CreateCustomerCommandRecord = {
          id,
          companyId: input.companyId,
          provider: input.provider,
          operation: input.operation,
          resourceType: input.resourceType,
          status: "draft",
          idempotencyKey: input.idempotencyKey,
          requestedBy: input.requestedBy,
          safePayload: input.safePayload,
          providerResourceId: null,
          verificationStatus: null,
          mirrorStatus: null,
          errorCode: null,
          errorMessage: null,
          createdAt: NOW.toISOString(),
          updatedAt: NOW.toISOString(),
        };
        records.set(id, full);
        return { record: full, wasCreated: true };
      },
      async updateStatus(commandId, patch) {
        const existing = records.get(commandId);
        if (!existing) throw new Error("not found");
        records.set(commandId, { ...existing, ...patch, updatedAt: NOW.toISOString() });
      },
    };

    let callCount = 0;
    const writeProvider: CustomerWriteProvider = {
      createCustomer: async () => {
        callCount++;
        return { provider: "parasut", providerResourceType: "contacts", providerResourceId: "1010699999", providerCompanyId: PROVIDER_COMPANY_ID, rawStatus: 201 };
      },
    };
    const auditRepo: AuditRepository = { record: async () => {} };
    const attemptRepo: AttemptRepository = { recordAttempt: async () => {} };
    const linkRepo: ProviderLinkRepository = { upsertLink: async () => {} };
    const handler = new CreateCustomerCommandHandler(repository, attemptRepo, linkRepo, auditRepo, writeProvider, alwaysVerified, alwaysMirrored, () => NOW);

    const [first, second] = await Promise.all([
      handler.handle(COMPANY_ID, PROVIDER_COMPANY_ID, ACTOR_ID, "idem-concurrent", { name: "Acme" }),
      handler.handle(COMPANY_ID, PROVIDER_COMPANY_ID, ACTOR_ID, "idem-concurrent", { name: "Acme" }),
    ]);

    expect(callCount).toBe(1);
    expect(first.id).toBe(second.id);
  });
});

describe("CreateCustomerCommandHandler — no direct mirror write", () => {
  it("has no injectable mirror-table dependency at all — structurally cannot write parasut.contacts", () => {
    const { handler } = makeHandler({});
    expect(handler).not.toHaveProperty("mirrorRepository");
    expect(handler).not.toHaveProperty("database");
  });
});
