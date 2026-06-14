import { describe, expect, it, vi } from "vitest";
import { TokenManager } from "./auth.ts";
import { ParaşütClient } from "./client.ts";
import { syncCollection } from "./sync-base.ts";
import { canonicalResource, hashResource, upsertResource } from "./upsert-resource.ts";
import type {
  JsonApiResource,
  MirrorDatabase,
  SyncContext,
} from "./types.ts";

function response(body: unknown, status = 200, headers: HeadersInit = {}): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

describe("Paraşüt sync engine", () => {
  it("hashes resources canonically and ignores object key order", () => {
    const left: JsonApiResource = {
      id: "1",
      type: "contacts",
      attributes: { beta: 2, alpha: 1 },
      relationships: { category: { data: null } },
    };
    const right: JsonApiResource = {
      id: "1",
      type: "contacts",
      relationships: { category: { data: null } },
      attributes: { alpha: 1, beta: 2 },
    };

    expect(canonicalResource(left)).toBe(canonicalResource(right));
    expect(hashResource(left)).toBe(hashResource(right));
  });

  it("refreshes once after an unauthorized GET", async () => {
    const tokenFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(
        response({ access_token: "initial", refresh_token: "refresh", expires_in: 3600 }),
      )
      .mockResolvedValueOnce(
        response({ access_token: "renewed", refresh_token: "refresh", expires_in: 3600 }),
      );
    const apiFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ error: "expired" }, 401))
      .mockResolvedValueOnce(response({ data: [] }));
    const tokens = new TokenManager(
      { clientId: "client", clientSecret: "secret", username: "user", password: "pass" },
      "https://api.example",
      tokenFetch,
    );
    const client = new ParaşütClient(tokens, {
      baseUrl: "https://api.example",
      fetchImpl: apiFetch,
      baseDelayMs: 0,
    });

    await expect(client.get("/v4/test")).resolves.toEqual({ data: [] });
    expect(apiFetch).toHaveBeenCalledTimes(2);
    expect(tokenFetch).toHaveBeenCalledTimes(2);
  });

  it("retries rate limits and paginates until a short page", async () => {
    const tokenFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValue(
        response({ access_token: "token", refresh_token: "refresh", expires_in: 3600 }),
      );
    const apiFetch = vi
      .fn<typeof fetch>()
      .mockResolvedValueOnce(response({ error: "rate" }, 429, { "retry-after": "0" }))
      .mockResolvedValueOnce(
        response({ data: [{ id: "1", type: "contacts" }, { id: "2", type: "contacts" }] }),
      )
      .mockResolvedValueOnce(response({ data: [{ id: "3", type: "contacts" }] }));
    const client = new ParaşütClient(
      new TokenManager(
        { clientId: "client", clientSecret: "secret", username: "user", password: "pass" },
        "https://api.example",
        tokenFetch,
      ),
      {
        baseUrl: "https://api.example",
        fetchImpl: apiFetch,
        baseDelayMs: 0,
        pageSize: 2,
      },
    );

    const pages = [];
    for await (const page of client.getPaginated("/v4/contacts")) pages.push(page);

    expect(pages).toHaveLength(2);
    expect(apiFetch).toHaveBeenCalledTimes(3);
  });

  it("touches an unchanged mirror resource without replacing payload", async () => {
    const resource: JsonApiResource = {
      id: "contact-1",
      type: "contacts",
      attributes: { updated_at: "2026-06-13T10:00:00Z" },
      relationships: { category: { data: null } },
    };
    const payloadHash = hashResource(resource);
    const updates: unknown[] = [];
    const database = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({
            data: { id: "row-1", payload_hash: payloadHash },
            error: null,
          }),
          update(value: unknown) {
            updates.push(value);
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

    const result = await upsertResource(
      database,
      { resourceType: "contacts", table: "parasut_contacts" },
      resource,
      {
        companyId: "company",
        parasutCompanyId: "666034",
        now: new Date("2026-06-13T12:00:00Z"),
      },
    );

    expect(result.outcome).toBe("unchanged");
    expect(updates).toEqual([{ last_seen_at: "2026-06-13T12:00:00.000Z" }]);
  });

  it("replaces the stored snapshot when the source payload changes", async () => {
    const resource: JsonApiResource = {
      id: "contact-1",
      type: "contacts",
      attributes: {
        name: "Updated source value",
        updated_at: "2026-06-13T11:00:00Z",
      },
      relationships: { category: { data: null } },
    };
    const updates: unknown[] = [];
    const database = {
      from() {
        return {
          select() {
            return this;
          },
          eq() {
            return this;
          },
          maybeSingle: async () => ({
            data: { id: "row-1", payload_hash: "stale-hash" },
            error: null,
          }),
          update(value: unknown) {
            updates.push(value);
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

    const result = await upsertResource(
      database,
      { resourceType: "contacts", table: "parasut_contacts" },
      resource,
      {
        companyId: "company",
        parasutCompanyId: "666034",
        now: new Date("2026-06-13T12:00:00Z"),
      },
    );

    expect(result.outcome).toBe("updated");
    expect(updates).toEqual([
      expect.objectContaining({
        attributes: resource.attributes,
        relationships: resource.relationships,
        raw_payload: resource,
        payload_hash: hashResource(resource),
      }),
    ]);
  });

  it("initializes run metadata and checkpoints only after page persistence", async () => {
    const insertedRuns: Record<string, unknown>[] = [];
    const runUpdates: Record<string, unknown>[] = [];
    const database = {
      from(table: string) {
        const state = {
          value: null as Record<string, unknown> | null,
          insert(value: Record<string, unknown>) {
            this.value = value;
            if (table === "parasut_sync_runs") insertedRuns.push(value);
            return this;
          },
          update(value: Record<string, unknown>) {
            this.value = value;
            if (table === "parasut_sync_runs") runUpdates.push(value);
            return this;
          },
          select() {
            return this;
          },
          eq() {
            return this;
          },
          single: async () => ({
            data: { id: state.value?.id as string },
            error: null,
          }),
          maybeSingle: async () => ({ data: null, error: null }),
          then(resolve: (value: unknown) => unknown) {
            return Promise.resolve(resolve({ data: null, error: null }));
          },
        };
        return state;
      },
    } as unknown as MirrorDatabase;
    const context: SyncContext = {
      companyId: "company",
      parasutCompanyId: "666034",
      database,
      client: {
        async *getPaginated() {
          yield {
            pageNumber: 1,
            document: { data: [] },
          };
        },
      },
    };

    await syncCollection(context, {
      resourceType: "contacts",
      endpoint: "/v4/666034/contacts",
      table: "parasut_contacts",
      include: ["payments", "details"],
    });

    expect(insertedRuns[0]).toMatchObject({
      request_metadata: {
        endpoint: "/v4/666034/contacts",
        include: ["payments", "details"],
        resume: {
          contract_version: 1,
          source_run_id: insertedRuns[0].id,
          include: ["details", "payments"],
          page_size: 25,
          last_completed_page: 0,
        },
      },
    });
    expect(runUpdates[0]).toMatchObject({
      request_metadata: {
        resume: { last_completed_page: 1 },
      },
    });
  });

  it("does not advance a checkpoint when parent persistence fails", async () => {
    const runUpdates: Record<string, unknown>[] = [];
    const database = {
      from(table: string) {
        const state = {
          value: null as Record<string, unknown> | null,
          insert(value: Record<string, unknown>) {
            this.value = value;
            return this;
          },
          update(value: Record<string, unknown>) {
            this.value = value;
            if (table === "parasut_sync_runs") runUpdates.push(value);
            return this;
          },
          select() {
            return this;
          },
          eq() {
            return this;
          },
          single: async () => ({
            data: { id: state.value?.id as string },
            error: null,
          }),
          maybeSingle: async () => ({ data: null, error: null }),
          then(resolve: (value: unknown) => unknown) {
            const error =
              table === "parasut_contacts"
                ? { message: "Mirror insert failed" }
                : null;
            return Promise.resolve(resolve({ data: null, error }));
          },
        };
        return state;
      },
    } as unknown as MirrorDatabase;
    const context: SyncContext = {
      companyId: "company",
      parasutCompanyId: "666034",
      database,
      client: {
        async *getPaginated() {
          yield {
            pageNumber: 1,
            document: {
              data: [{ id: "contact-1", type: "contacts" }],
            },
          };
        },
      },
    };

    await syncCollection(context, {
      resourceType: "contacts",
      endpoint: "/v4/666034/contacts",
      table: "parasut_contacts",
    });

    expect(
      runUpdates.some((update) => "request_metadata" in update),
    ).toBe(false);
  });

  it("does not advance later pages after page one persistence fails", async () => {
    const checkpoints: number[] = [];
    let contactInsert = 0;
    const database = {
      from(table: string) {
        const state = {
          value: null as Record<string, unknown> | null,
          insert(value: Record<string, unknown>) {
            this.value = value;
            if (table === "parasut_contacts") contactInsert++;
            return this;
          },
          update(value: Record<string, unknown>) {
            this.value = value;
            if (table === "parasut_sync_runs" && value.request_metadata) {
              const resume = (value.request_metadata as Record<string, unknown>)
                .resume as Record<string, unknown>;
              checkpoints.push(resume.last_completed_page as number);
            }
            return this;
          },
          select() {
            return this;
          },
          eq() {
            return this;
          },
          single: async () => ({
            data: { id: state.value?.id as string },
            error: null,
          }),
          maybeSingle: async () => ({ data: null, error: null }),
          then(resolve: (value: unknown) => unknown) {
            const error =
              table === "parasut_contacts" && contactInsert === 1
                ? { message: "Page one persistence failed" }
                : null;
            return Promise.resolve(resolve({ data: null, error }));
          },
        };
        return state;
      },
    } as unknown as MirrorDatabase;

    const result = await syncCollection(
      {
        companyId: "company",
        parasutCompanyId: "666034",
        database,
        client: {
          async *getPaginated() {
            yield {
              pageNumber: 1,
              document: { data: [{ id: "one", type: "contacts" }] },
            };
            yield {
              pageNumber: 2,
              document: { data: [{ id: "two", type: "contacts" }] },
            };
          },
        },
      },
      {
        resourceType: "contacts",
        endpoint: "/v4/666034/contacts",
        table: "parasut_contacts",
      },
    );

    expect(result.status).toBe("partial");
    expect(checkpoints).toEqual([]);
  });

  it("keeps page one as the final checkpoint when page two fails", async () => {
    const checkpoints: number[] = [];
    let contactInsert = 0;
    const database = {
      from(table: string) {
        const state = {
          value: null as Record<string, unknown> | null,
          insert(value: Record<string, unknown>) {
            this.value = value;
            if (table === "parasut_contacts") contactInsert++;
            return this;
          },
          update(value: Record<string, unknown>) {
            this.value = value;
            if (table === "parasut_sync_runs" && value.request_metadata) {
              const resume = (value.request_metadata as Record<string, unknown>)
                .resume as Record<string, unknown>;
              checkpoints.push(resume.last_completed_page as number);
            }
            return this;
          },
          select() {
            return this;
          },
          eq() {
            return this;
          },
          single: async () => ({
            data: { id: state.value?.id as string },
            error: null,
          }),
          maybeSingle: async () => ({ data: null, error: null }),
          then(resolve: (value: unknown) => unknown) {
            const error =
              table === "parasut_contacts" && contactInsert === 2
                ? { message: "Page two persistence failed" }
                : null;
            return Promise.resolve(resolve({ data: null, error }));
          },
        };
        return state;
      },
    } as unknown as MirrorDatabase;

    await syncCollection(
      {
        companyId: "company",
        parasutCompanyId: "666034",
        database,
        client: {
          async *getPaginated() {
            yield {
              pageNumber: 1,
              document: { data: [{ id: "one", type: "contacts" }] },
            };
            yield {
              pageNumber: 2,
              document: { data: [{ id: "two", type: "contacts" }] },
            };
          },
        },
      },
      {
        resourceType: "contacts",
        endpoint: "/v4/666034/contacts",
        table: "parasut_contacts",
      },
    );

    expect(checkpoints).toEqual([1]);
  });

  it("prevents checkpoint advancement after included-resource failure", async () => {
    const checkpoints: number[] = [];
    const database = {
      from(table: string) {
        const state = {
          value: null as Record<string, unknown> | null,
          insert(value: Record<string, unknown>) {
            this.value = value;
            return this;
          },
          update(value: Record<string, unknown>) {
            this.value = value;
            if (table === "parasut_sync_runs" && value.request_metadata) {
              const resume = (value.request_metadata as Record<string, unknown>)
                .resume as Record<string, unknown>;
              checkpoints.push(resume.last_completed_page as number);
            }
            return this;
          },
          select() {
            return this;
          },
          eq() {
            return this;
          },
          single: async () => ({
            data: { id: state.value?.id as string },
            error: null,
          }),
          maybeSingle: async () => ({ data: null, error: null }),
          then(resolve: (value: unknown) => unknown) {
            const error =
              table === "parasut_payments"
                ? { message: "Included persistence failed" }
                : null;
            return Promise.resolve(resolve({ data: null, error }));
          },
        };
        return state;
      },
    } as unknown as MirrorDatabase;

    await syncCollection(
      {
        companyId: "company",
        parasutCompanyId: "666034",
        database,
        client: {
          async *getPaginated() {
            yield {
              pageNumber: 1,
              document: {
                data: [],
                included: [{ id: "payment-1", type: "payments" }],
              },
            };
          },
        },
      },
      {
        resourceType: "sales_invoices",
        endpoint: "/v4/666034/sales_invoices",
        table: "parasut_sales_invoices",
      },
    );

    expect(checkpoints).toEqual([]);
  });

  it("finalizes the run as failed when checkpoint persistence fails", async () => {
    const runUpdates: Record<string, unknown>[] = [];
    const database = {
      from(table: string) {
        const state = {
          value: null as Record<string, unknown> | null,
          insert(value: Record<string, unknown>) {
            this.value = value;
            return this;
          },
          update(value: Record<string, unknown>) {
            this.value = value;
            if (table === "parasut_sync_runs") runUpdates.push(value);
            return this;
          },
          select() {
            return this;
          },
          eq() {
            return this;
          },
          single: async () => ({
            data: { id: state.value?.id as string },
            error: null,
          }),
          maybeSingle: async () => ({ data: null, error: null }),
          then(resolve: (value: unknown) => unknown) {
            const isCheckpoint =
              table === "parasut_sync_runs" &&
              Boolean(state.value?.request_metadata);
            return Promise.resolve(
              resolve({
                data: null,
                error: isCheckpoint
                  ? { message: "Checkpoint persistence failed" }
                  : null,
              }),
            );
          },
        };
        return state;
      },
    } as unknown as MirrorDatabase;

    await expect(
      syncCollection(
        {
          companyId: "company",
          parasutCompanyId: "666034",
          database,
          client: {
            async *getPaginated() {
              yield { pageNumber: 1, document: { data: [] } };
            },
          },
        },
        {
          resourceType: "contacts",
          endpoint: "/v4/666034/contacts",
          table: "parasut_contacts",
        },
      ),
    ).rejects.toThrow("Checkpoint persistence failed");

    expect(runUpdates).toContainEqual(
      expect.objectContaining({ status: "failed" }),
    );
    expect(
      runUpdates.filter((update) => update.request_metadata),
    ).toHaveLength(1);
  });

  it("safely reprocesses persisted resources without duplicate inserts", async () => {
    const resource: JsonApiResource = {
      id: "contact-1",
      type: "contacts",
      attributes: { name: "Stable source value" },
    };
    const rows = new Map<string, { id: string; payload_hash: string }>();
    let inserts = 0;
    const database = {
      from(table: string) {
        const filters = new Map<string, unknown>();
        let operation: "select" | "insert" | "update" = "select";
        let value: Record<string, unknown> | null = null;
        const state = {
          select() {
            operation = "select";
            return this;
          },
          insert(input: Record<string, unknown>) {
            operation = "insert";
            value = input;
            return this;
          },
          update(input: Record<string, unknown>) {
            operation = "update";
            value = input;
            return this;
          },
          eq(column: string, input: unknown) {
            filters.set(column, input);
            return this;
          },
          maybeSingle: async () => ({
            data:
              table === "parasut_contacts"
                ? rows.get(filters.get("parasut_id") as string) ?? null
                : null,
            error: null,
          }),
          single: async () => ({
            data: { id: value?.id as string },
            error: null,
          }),
          then(resolve: (result: unknown) => unknown) {
            if (table === "parasut_contacts" && operation === "insert" && value) {
              inserts++;
              rows.set(value.parasut_id as string, {
                id: `row-${inserts}`,
                payload_hash: value.payload_hash as string,
              });
            }
            return Promise.resolve(resolve({ data: null, error: null }));
          },
        };
        return state;
      },
    } as unknown as MirrorDatabase;
    const run = () =>
      syncCollection(
        {
          companyId: "company",
          parasutCompanyId: "666034",
          database,
          client: {
            async *getPaginated() {
              yield { pageNumber: 1, document: { data: [resource] } };
            },
          },
        },
        {
          resourceType: "contacts",
          endpoint: "/v4/666034/contacts",
          table: "parasut_contacts",
        },
      );

    await run();
    await run();

    expect(inserts).toBe(1);
    expect(rows.size).toBe(1);
  });

  it("emits one structured summary after a completed run", async () => {
    const summaries: unknown[] = [];
    const database = lifecycleDatabase();

    const result = await syncCollection(
      {
        companyId: "company",
        parasutCompanyId: "666034",
        database,
        client: {
          async *getPaginated() {
            yield { pageNumber: 1, document: { data: [] } };
          },
        },
        observability: {
          emitSyncSummary(summary) {
            summaries.push(summary);
          },
        },
      },
      {
        resourceType: "contacts",
        endpoint: "/v4/666034/contacts",
        table: "parasut_contacts",
      },
    );

    expect(result.status).toBe("completed");
    expect(summaries).toEqual([
      expect.objectContaining({
        resource_type: "contacts",
        status: "completed",
        pages: 1,
        last_completed_page: 1,
      }),
    ]);
    expect(summaries[0]).not.toHaveProperty("request_metadata");
    expect(summaries[0]).not.toHaveProperty("raw_payload");
    expect(Object.keys(summaries[0] as object)).toEqual([
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
    expect(JSON.stringify(summaries[0])).not.toMatch(
      /access_token|refresh_token|api[_-]?key|user@example\.com|\+90 555/i,
    );
  });

  it("emits sanitized errors and one summary after a partial run", async () => {
    const errors: unknown[] = [];
    const summaries: unknown[] = [];
    const database = lifecycleDatabase({
      contactError: {
        message:
          "Bearer private-token email person@example.com phone +90 555 123 45 67",
      },
    });

    const result = await syncCollection(
      {
        companyId: "company",
        parasutCompanyId: "666034",
        database,
        client: {
          async *getPaginated() {
            yield {
              pageNumber: 1,
              document: { data: [{ id: "contact-1", type: "contacts" }] },
            };
          },
        },
        observability: {
          emitErrorSummary(summary) {
            errors.push(summary);
          },
          emitSyncSummary(summary) {
            summaries.push(summary);
          },
        },
      },
      {
        resourceType: "contacts",
        endpoint: "/v4/666034/contacts",
        table: "parasut_contacts",
      },
    );

    expect(result.status).toBe("partial");
    expect(errors).toHaveLength(1);
    expect(JSON.stringify(errors[0])).not.toMatch(
      /private-token|person@example\.com|555/,
    );
    expect(summaries).toEqual([
      expect.objectContaining({
        status: "partial",
        errors: 1,
        last_completed_page: 0,
      }),
    ]);
  });

  it("emits a failed summary while observability failures stay non-blocking", async () => {
    const summaries: unknown[] = [];
    const database = lifecycleDatabase({
      checkpointError: { message: "Checkpoint persistence failed" },
    });
    const emitErrorSummary = vi.fn().mockRejectedValue(new Error("sink failed"));
    const emitSyncSummary = vi.fn((summary: unknown) => {
      summaries.push(summary);
      return Promise.reject(new Error("sink failed"));
    });

    await expect(
      syncCollection(
        {
          companyId: "company",
          parasutCompanyId: "666034",
          database,
          client: {
            async *getPaginated() {
              yield { pageNumber: 1, document: { data: [] } };
            },
          },
          observability: { emitErrorSummary, emitSyncSummary },
        },
        {
          resourceType: "contacts",
          endpoint: "/v4/666034/contacts",
          table: "parasut_contacts",
        },
      ),
    ).rejects.toThrow("Checkpoint persistence failed");

    expect(emitErrorSummary).toHaveBeenCalledOnce();
    expect(emitSyncSummary).toHaveBeenCalledOnce();
    expect(summaries).toEqual([
      expect.objectContaining({
        status: "failed",
        last_completed_page: 0,
      }),
    ]);
  });
});

function lifecycleDatabase(options?: {
  contactError?: { message: string };
  checkpointError?: { message: string };
}): MirrorDatabase {
  return {
    from(table: string) {
      const state = {
        value: null as Record<string, unknown> | null,
        insert(value: Record<string, unknown>) {
          this.value = value;
          return this;
        },
        update(value: Record<string, unknown>) {
          this.value = value;
          return this;
        },
        select() {
          return this;
        },
        eq() {
          return this;
        },
        single: async () => ({
          data: { id: state.value?.id as string },
          error: null,
        }),
        maybeSingle: async () => ({ data: null, error: null }),
        then(resolve: (value: unknown) => unknown) {
          const checkpoint =
            table === "parasut_sync_runs" &&
            Boolean(state.value?.request_metadata);
          const error =
            table === "parasut_contacts"
              ? options?.contactError ?? null
              : checkpoint
                ? options?.checkpointError ?? null
                : null;
          return Promise.resolve(resolve({ data: null, error }));
        },
      };
      return state;
    },
  } as unknown as MirrorDatabase;
}
