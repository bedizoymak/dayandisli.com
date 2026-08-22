import { describe, expect, it } from "vitest";
import {
  ChecksApiError,
  handleChecksDetail,
  handleChecksList,
  handleCreateCheck,
  handleLinkParty,
  handleSetCheckStatus,
  handleUnlinkParty,
  handleUpdateCheck,
  normalizeLocalCheck,
  normalizeMirrorCheck,
  type ChecksRepository,
  type MirrorCheckRow,
  type MirrorContactRow,
  type PaymentInstrumentEventRow,
  type PaymentInstrumentRow,
} from "./handlers.ts";

const COMPANY_A = "11111111-1111-4111-8111-111111111111";
const COMPANY_B = "22222222-2222-4222-8222-222222222222";
const TODAY = "2026-08-15";

function mirror(id: string, attributes: Record<string, unknown> = {}, companyId = COMPANY_A): MirrorCheckRow {
  return {
    parasut_id: id,
    company_id: companyId,
    attributes: {
      is_in: true,
      is_out: false,
      currency: "TRL",
      net_total: "1000",
      remaining: "1000",
      issue_date: "2026-08-01",
      due_date: "2026-08-20",
      serial_number: `P-${id}`,
      ...attributes,
    },
    relationships: {},
    source_archived: null,
    synced_at: "2026-08-15T00:00:00Z",
  };
}

function local(overrides: Partial<PaymentInstrumentRow> = {}): PaymentInstrumentRow {
  return {
    id: "local-1",
    company_id: COMPANY_A,
    source: "erp_local",
    external_parasut_id: null,
    instrument_type: "check",
    direction: "received",
    contact_parasut_id: null,
    local_quote_customer_id: null,
    contact_snapshot_name: null,
    bank_name: "Ziraat",
    check_number: "ERP-1",
    issue_date: "2026-08-01",
    due_date: "2026-08-21",
    currency: "TRY",
    original_amount: 500,
    remaining_amount: 500,
    settlement_status: "open",
    paid_at: null,
    notes: null,
    created_at: "2026-08-15T00:00:00Z",
    updated_at: "2026-08-15T00:00:00Z",
    ...overrides,
  };
}

class FakeRepository implements ChecksRepository {
  mirrors: MirrorCheckRow[] = [];
  locals: PaymentInstrumentRow[] = [];
  contacts: MirrorContactRow[] = [];
  events: PaymentInstrumentEventRow[] = [];
  latestSyncAt: string | null = "2026-08-15T00:05:00Z";
  lastInsert: Record<string, unknown> | null = null;
  lastUpdate: Record<string, unknown> | null = null;
  lastTransition: { id: string; status: "paid" | "cancelled" | "returned"; note: string | null } | null = null;

  async listMirrorChecks(companyId: string) {
    return this.mirrors.filter((row) => row.company_id === companyId && row.source_archived !== true);
  }

  async listLocalInstruments(companyId: string) {
    return this.locals.filter((row) => row.company_id === companyId);
  }

  async getMirrorCheck(companyId: string, parasutId: string) {
    return this.mirrors.find((row) => row.company_id === companyId && row.parasut_id === parasutId && row.source_archived !== true) ?? null;
  }

  async getLocalInstrument(companyId: string, id: string) {
    return this.locals.find((row) => row.company_id === companyId && row.id === id) ?? null;
  }

  async getMirrorOverlay(companyId: string, parasutId: string) {
    return this.locals.find((row) => row.company_id === companyId && row.source === "parasut_mirror" && row.external_parasut_id === parasutId) ?? null;
  }

  async listMirrorContacts(companyId: string, parasutIds: string[]) {
    const requestedIds = new Set(parasutIds);
    return this.contacts.filter((row) => row.company_id === companyId && row.source_archived !== true && requestedIds.has(row.parasut_id));
  }

  async getMirrorContact(companyId: string, parasutId: string) {
    return this.contacts.find((row) => row.company_id === companyId && row.parasut_id === parasutId && row.source_archived !== true) ?? null;
  }

  async getLatestSuccessfulChecksSyncAt() {
    return this.latestSyncAt;
  }

  async listEvents(companyId: string, instrumentId: string) {
    return this.events.filter((row) => row.company_id === companyId && row.payment_instrument_id === instrumentId);
  }

  async insertInstrument(values: Record<string, unknown>) {
    this.lastInsert = values;
    const paid = values.settlement_status === "paid";
    const row = local({
      ...(values as Partial<PaymentInstrumentRow>),
      id: `created-${this.locals.length + 1}`,
      remaining_amount: paid ? 0 : Number(values.original_amount),
      paid_at: paid ? "2026-08-15T12:00:00Z" : null,
      created_at: "2026-08-15T12:00:00Z",
      updated_at: "2026-08-15T12:00:00Z",
    });
    this.locals.push(row);
    return row;
  }

  async updateInstrument(companyId: string, id: string, values: Record<string, unknown>) {
    this.lastUpdate = values;
    const index = this.locals.findIndex((row) => row.company_id === companyId && row.id === id);
    if (index < 0) throw new Error("not found");
    const next = { ...this.locals[index], ...values, updated_at: "2026-08-15T13:00:00Z" } as PaymentInstrumentRow;
    if (values.original_amount !== undefined) next.remaining_amount = Number(values.original_amount);
    this.locals[index] = next;
    return next;
  }

  async transitionInstrument(id: string, status: "paid" | "cancelled" | "returned", note: string | null) {
    this.lastTransition = { id, status, note };
    const index = this.locals.findIndex((row) => row.id === id);
    if (index < 0) throw new Error("not found");
    const next = {
      ...this.locals[index],
      settlement_status: status,
      remaining_amount: status === "paid" ? 0 : this.locals[index].remaining_amount,
      paid_at: status === "paid" ? "2026-08-15T14:00:00Z" : null,
    } as PaymentInstrumentRow;
    this.locals[index] = next;
    return next;
  }
}

function contact(id: string, accountType: "customer" | "supplier", companyId = COMPANY_A): MirrorContactRow {
  return {
    parasut_id: id,
    company_id: companyId,
    attributes: { name: `${accountType}-${id}`, account_type: accountType },
    source_archived: null,
  };
}

describe("checks-api normalization", () => {
  it("uses the mirror's nominal amounts, TRL->TRY and bank_identifier when bank_name is blank", () => {
    const row = normalizeMirrorCheck(
      mirror("1", {
        bank_name: "",
        bank_identifier: "ISBANK",
        net_total: "1250.50",
        remaining: "750.25",
        remaining_in_trl: "999999.00",
      }),
      null,
      TODAY,
    );
    expect(row.bankName).toBe("ISBANK");
    expect(row.currency).toBe("TRY");
    expect(row.originalAmount).toBe(1250.5);
    expect(row.remainingAmount).toBe(750.25);
  });

  it("never guesses a party when the mirror has no explicit ERP overlay", () => {
    const row = normalizeMirrorCheck(mirror("1", { description: "Acme maybe" }), null, TODAY);
    expect(row.party).toEqual({ parasutId: null, localQuoteCustomerId: null, name: null, assigned: false });
  });

  it("uses an exact Paraşüt contact relationship when present and does not expose it as an ERP override", () => {
    const source = mirror("1");
    source.relationships = { issued_by: { data: { type: "contacts", id: "customer-42" } } };
    const row = normalizeMirrorCheck(source, null, TODAY, contact("customer-42", "customer"));
    expect(row.party).toEqual({
      parasutId: "customer-42",
      localQuoteCustomerId: null,
      name: "customer-customer-42",
      assigned: true,
    });
    expect(row.partyLinkEditable).toBe(false);
  });

  it("30. an issued check resolves to the correct supplier contact via the given_to relationship — the sync-checks.ts include=issued_by,given_to fix's exact consumer", () => {
    const source = mirror("issued-1", { is_in: false, is_out: true });
    source.relationships = { given_to: { data: { type: "contacts", id: "supplier-7" } } };
    const row = normalizeMirrorCheck(source, null, TODAY, contact("supplier-7", "supplier"));
    expect(row.direction).toBe("issued");
    expect(row.party).toEqual({
      parasutId: "supplier-7",
      localQuoteCustomerId: null,
      name: "supplier-supplier-7",
      assigned: true,
    });
  });

  it("30b. a received check resolves via issued_by only, never given_to, and vice versa for an issued check", () => {
    const received = mirror("r-1");
    received.relationships = { issued_by: { data: { type: "contacts", id: "cust-1" } }, given_to: { data: { type: "contacts", id: "supp-1" } } };
    const receivedRow = normalizeMirrorCheck(received, null, TODAY, contact("cust-1", "customer"));
    expect(receivedRow.party.parasutId).toBe("cust-1");

    const issued = mirror("i-1", { is_in: false, is_out: true });
    issued.relationships = { issued_by: { data: { type: "contacts", id: "cust-1" } }, given_to: { data: { type: "contacts", id: "supp-1" } } };
    const issuedRow = normalizeMirrorCheck(issued, null, TODAY, contact("supp-1", "supplier"));
    expect(issuedRow.party.parasutId).toBe("supp-1");
  });

  it("an unmatched contact never falls back to a guessed name — the check still carries its real, ID-verified party id but no name until that contact resolves", () => {
    const source = mirror("2");
    source.relationships = { issued_by: { data: { type: "contacts", id: "customer-99" } } };
    const row = normalizeMirrorCheck(source, null, TODAY, null);
    expect(row.party).toEqual({ parasutId: "customer-99", localQuoteCustomerId: null, name: null, assigned: true });
  });
});

describe("handleChecksList — checks do not appear for unrelated contacts", () => {
  it("a contactParasutId filter never returns a check whose real party id differs", async () => {
    const repo = new FakeRepository();
    const checkForContactA = mirror("1");
    checkForContactA.relationships = { issued_by: { data: { type: "contacts", id: "customer-A" } } };
    const checkForContactB = mirror("2");
    checkForContactB.relationships = { issued_by: { data: { type: "contacts", id: "customer-B" } } };
    repo.mirrors = [checkForContactA, checkForContactB];
    repo.contacts = [contact("customer-A", "customer"), contact("customer-B", "customer")];

    const result = await handleChecksList(repo, COMPANY_A, { filters: { contactParasutId: "customer-A" } }, TODAY);

    expect(result.rows).toHaveLength(1);
    expect(result.rows[0].party.parasutId).toBe("customer-A");
  });
});

describe("handleChecksList", () => {
  it("keeps all 40 NULL-archived mirror rows and unions one ERP row without rendering an overlay twice", async () => {
    const repo = new FakeRepository();
    repo.mirrors = Array.from({ length: 40 }, (_, index) => mirror(String(index + 1)));
    repo.locals = [
      local(),
      local({ id: "overlay-1", source: "parasut_mirror", external_parasut_id: "1", contact_parasut_id: "customer-1", contact_snapshot_name: "Customer One" }),
    ];
    const result = await handleChecksList(repo, COMPANY_A, { pageSize: 100 }, TODAY);

    expect(result.total).toBe(41);
    expect(result.rows).toHaveLength(41);
    expect(result.latestSyncAt).toBe(repo.latestSyncAt);
    expect(result.rows.find((row) => row.id === "parasut:1")?.party.name).toBe("Customer One");
    expect(result.rows.filter((row) => row.source === "erp")).toHaveLength(1);
  });

  it("applies the exact global default buckets before pagination: next 7 days, overdue, later open, terminal", async () => {
    const repo = new FakeRepository();
    repo.mirrors = [
      mirror("future-8", { due_date: "2026-08-23" }),
      mirror("overdue-old", { due_date: "2026-08-01" }),
      mirror("terminal", { due_date: "2026-08-16", remaining: "0", payment_status: "paid" }),
      mirror("near-7", { due_date: "2026-08-22" }),
      mirror("overdue-near", { due_date: "2026-08-14" }),
      mirror("today", { due_date: TODAY }),
    ];

    const result = await handleChecksList(repo, COMPANY_A, { pageSize: 100 }, TODAY);
    expect(result.rows.map((row) => row.id)).toEqual([
      "parasut:today",
      "parasut:near-7",
      "parasut:overdue-near",
      "parasut:overdue-old",
      "parasut:future-8",
      "parasut:terminal",
    ]);
  });

  it("supports exact direction and partyId/contactParasutId aliases plus party-name search", async () => {
    const repo = new FakeRepository();
    repo.mirrors = [mirror("1"), mirror("2", { is_in: false, is_out: true })];
    repo.locals = [
      local({ id: "overlay-1", source: "parasut_mirror", external_parasut_id: "1", contact_parasut_id: "c1", contact_snapshot_name: "Ali Veli" }),
      local({ id: "overlay-2", source: "parasut_mirror", external_parasut_id: "2", direction: "issued", contact_parasut_id: "s1", contact_snapshot_name: "Tedarikçi A" }),
    ];

    const byAlias = await handleChecksList(repo, COMPANY_A, { filters: { partyId: "s1", direction: "issued" } }, TODAY);
    const byName = await handleChecksList(repo, COMPANY_A, { filters: { partySearch: "ali" } }, TODAY);
    expect(byAlias.rows.map((row) => row.id)).toEqual(["parasut:2"]);
    expect(byName.rows.map((row) => row.id)).toEqual(["parasut:1"]);
  });

  it("caps pageSize at 100", async () => {
    const repo = new FakeRepository();
    repo.mirrors = Array.from({ length: 120 }, (_, index) => mirror(String(index + 1)));
    const result = await handleChecksList(repo, COMPANY_A, { pageSize: 1000 }, TODAY);
    expect(result.pageSize).toBe(100);
    expect(result.rows).toHaveLength(100);
    expect(result.total).toBe(120);
  });
});

describe("checks-api detail and mutations", () => {
  it("returns company-scoped detail with normalized camelCase history", async () => {
    const repo = new FakeRepository();
    repo.locals = [local(), local({ id: "foreign", company_id: COMPANY_B })];
    repo.events = [{
      id: "event-1",
      payment_instrument_id: "local-1",
      company_id: COMPANY_A,
      event_type: "marked_paid",
      previous_settlement_status: "open",
      new_settlement_status: "paid",
      actor_user_id: "user-1",
      note: "Tahsil edildi",
      changes: {},
      occurred_at: "2026-08-15T10:00:00Z",
    }];
    const result = await handleChecksDetail(repo, COMPANY_A, "erp:local-1", TODAY);
    expect(result.history).toEqual([{
      id: "event-1",
      eventType: "marked_paid",
      fromStatus: "open",
      toStatus: "paid",
      note: "Tahsil edildi",
      createdAt: "2026-08-15T10:00:00Z",
    }]);
    await expect(handleChecksDetail(repo, COMPANY_A, "erp:foreign", TODAY)).rejects.toMatchObject({ httpStatus: 404 });
  });

  it("creates paid locally in one atomic insert shape and rejects unsafe local quote linkage", async () => {
    const repo = new FakeRepository();
    repo.contacts = [contact("customer-1", "customer")];
    const result = await handleCreateCheck(repo, COMPANY_A, {
      direction: "received",
      contactParasutId: "customer-1",
      dueDate: "2026-09-01",
      currency: "TRY",
      originalAmount: 1500,
      settlementStatus: "paid",
    }, TODAY);
    expect(repo.lastInsert).toMatchObject({
      source: "erp_local",
      settlement_status: "paid",
      original_amount: 1500,
      remaining_amount: 0,
      contact_snapshot_name: "customer-customer-1",
    });
    expect(repo.lastTransition).toBeNull();
    expect(result.record.effectiveStatus).toBe("paid");

    await expect(handleCreateCheck(repo, COMPANY_A, {
      direction: "received",
      localQuoteCustomerId: "33333333-3333-4333-8333-333333333333",
      dueDate: "2026-09-01",
      currency: "TRY",
      originalAmount: 1,
    }, TODAY)).rejects.toMatchObject({ httpStatus: 422 });
  });

  it("enforces customer/supplier direction on create and party link", async () => {
    const repo = new FakeRepository();
    repo.contacts = [contact("supplier-1", "supplier")];
    await expect(handleCreateCheck(repo, COMPANY_A, {
      direction: "received",
      contactParasutId: "supplier-1",
      dueDate: "2026-09-01",
      currency: "TRY",
      originalAmount: 1,
    }, TODAY)).rejects.toMatchObject({ httpStatus: 422 });
  });

  it("updates only local editable fields and relies on the DB trigger for remaining_amount alignment", async () => {
    const repo = new FakeRepository();
    repo.locals = [local()];
    await handleUpdateCheck(repo, COMPANY_A, "erp:local-1", { originalAmount: 750, bankName: "Yeni Banka" }, TODAY);
    expect(repo.lastUpdate).toMatchObject({ original_amount: 750, bank_name: "Yeni Banka" });
    expect(repo.lastUpdate).not.toHaveProperty("remaining_amount");
    await expect(handleUpdateCheck(repo, COMPANY_A, "parasut:1", { bankName: "x" }, TODAY)).rejects.toMatchObject({ httpStatus: 409 });
    await expect(handleUpdateCheck(repo, COMPANY_A, "erp:local-1", { settlementStatus: "paid" }, TODAY)).rejects.toBeInstanceOf(ChecksApiError);
    repo.locals = [local({ settlement_status: "paid", remaining_amount: 0 })];
    await expect(handleUpdateCheck(repo, COMPANY_A, "erp:local-1", { bankName: "x" }, TODAY)).rejects.toMatchObject({ httpStatus: 409 });
  });

  it("validates and atomically sets or clears a local party during update", async () => {
    const repo = new FakeRepository();
    repo.locals = [local()];
    repo.contacts = [contact("customer-1", "customer"), contact("supplier-1", "supplier")];

    const linked = await handleUpdateCheck(repo, COMPANY_A, "erp:local-1", {
      contactParasutId: "customer-1",
      contactSnapshotName: "Caller supplied name is ignored",
    }, TODAY);
    expect(repo.lastUpdate).toMatchObject({
      contact_parasut_id: "customer-1",
      contact_snapshot_name: "customer-customer-1",
    });
    expect(linked.record.party).toMatchObject({
      parasutId: "customer-1",
      name: "customer-customer-1",
      assigned: true,
    });

    await expect(handleUpdateCheck(repo, COMPANY_A, "erp:local-1", {
      direction: "issued",
      contactParasutId: "customer-1",
    }, TODAY)).rejects.toMatchObject({ httpStatus: 422 });

    const cleared = await handleUpdateCheck(repo, COMPANY_A, "erp:local-1", { contactParasutId: null }, TODAY);
    expect(repo.lastUpdate).toMatchObject({
      contact_parasut_id: null,
      contact_snapshot_name: null,
    });
    expect(cleared.record.party.assigned).toBe(false);
  });

  it("marks terminal local rows non-editable", () => {
    expect(normalizeLocalCheck(local({ settlement_status: "paid", remaining_amount: 0 }), TODAY)).toMatchObject({
      editable: false,
      statusEditable: false,
    });
  });

  it("uses only the transition RPC port and requires a note for cancel/return", async () => {
    const repo = new FakeRepository();
    repo.locals = [local()];
    await expect(handleSetCheckStatus(repo, COMPANY_A, "erp:local-1", "returned", "", TODAY)).rejects.toBeInstanceOf(ChecksApiError);
    const result = await handleSetCheckStatus(repo, COMPANY_A, "erp:local-1", "returned", "Müşteriye iade", TODAY);
    expect(repo.lastTransition).toEqual({ id: "local-1", status: "returned", note: "Müşteriye iade" });
    expect(result.record.effectiveStatus).toBe("returned");
  });

  it("materializes only a validated party overlay for a Paraşüt cheque and keeps mirror finance authoritative", async () => {
    const repo = new FakeRepository();
    repo.mirrors = [mirror("p1", { bank_name: "", bank_identifier: "HALKBANK", net_total: "2000", remaining: "1200" })];
    repo.contacts = [contact("customer-1", "customer")];
    const linked = await handleLinkParty(repo, COMPANY_A, "parasut:p1", "customer-1", TODAY);
    expect(repo.lastInsert).toMatchObject({
      source: "parasut_mirror",
      external_parasut_id: "p1",
      contact_parasut_id: "customer-1",
      bank_name: "HALKBANK",
      original_amount: 2000,
      remaining_amount: 1200,
    });
    expect(linked.record.party.name).toBe("customer-customer-1");
    expect(linked.record.originalAmount).toBe(2000);

    const unlinked = await handleUnlinkParty(repo, COMPANY_A, "parasut:p1", TODAY);
    expect(repo.lastUpdate).toMatchObject({ contact_parasut_id: null, contact_snapshot_name: null });
    expect(unlinked.record.party.assigned).toBe(false);
  });

  it("does not override or unlink an authoritative Paraşüt party relationship", async () => {
    const repo = new FakeRepository();
    const source = mirror("p1");
    source.relationships = { issued_by: { data: { type: "contacts", id: "customer-source" } } };
    repo.mirrors = [source];
    repo.contacts = [contact("customer-1", "customer")];

    await expect(handleLinkParty(repo, COMPANY_A, "parasut:p1", "customer-1", TODAY)).rejects.toMatchObject({ httpStatus: 409 });
    await expect(handleUnlinkParty(repo, COMPANY_A, "parasut:p1", TODAY)).rejects.toMatchObject({ httpStatus: 409 });
    expect(repo.lastInsert).toBeNull();
    expect(repo.lastUpdate).toBeNull();
  });
});
