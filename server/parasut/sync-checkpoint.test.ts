import { describe, expect, it, vi } from "vitest";
import {
  advanceCheckpointMetadata,
  initializeCheckpointMetadata,
  normalizeInclude,
  persistPageThenCheckpoint,
} from "./sync-checkpoint.ts";

const request = {
  resourceType: "sales_invoices",
  endpoint: "/v4/666034/sales_invoices",
  include: ["payments", "contact", "payments", "details"],
  pageSize: 25,
};

function initialized(): Record<string, unknown> {
  return initializeCheckpointMetadata(
    { trigger: "local_manual", trace: { attempt: 1 } },
    "run-1",
    request,
  );
}

describe("sync checkpoint foundation", () => {
  it("initializes versioned resume metadata", () => {
    expect(initialized()).toMatchObject({
      trigger: "local_manual",
      resume: {
        contract_version: 1,
        eligible: true,
        source_run_id: "run-1",
        resource_type: "sales_invoices",
        endpoint: "/v4/666034/sales_invoices",
        include: ["contact", "details", "payments"],
        page_size: 25,
        last_completed_page: 0,
      },
    });
  });

  it("preserves existing unrelated and resume metadata", () => {
    const result = initializeCheckpointMetadata(
      {
        endpoint_label: "sales",
        resume: { diagnostic: "preserve-me", last_completed_page: 9 },
      },
      "new-run",
      request,
    );

    expect(result).toMatchObject({
      endpoint_label: "sales",
      resume: {
        diagnostic: "preserve-me",
        source_run_id: "new-run",
        last_completed_page: 0,
      },
    });
  });

  it("normalizes include values deterministically", () => {
    expect(normalizeInclude([" payments ", "details", "", "payments"])).toEqual([
      "details",
      "payments",
    ]);
  });

  it("advances the checkpoint after successful page persistence", async () => {
    const order: string[] = [];
    const result = await persistPageThenCheckpoint(initialized(), 1, {
      persistPage: async () => {
        order.push("page");
      },
      persistCheckpoint: async () => {
        order.push("checkpoint");
      },
    });

    expect(order).toEqual(["page", "checkpoint"]);
    expect(result).toMatchObject({
      resume: { last_completed_page: 1 },
    });
  });

  it("does not write a checkpoint before page persistence completes", async () => {
    let releasePage: (() => void) | undefined;
    const persistCheckpoint = vi.fn(async () => undefined);
    const operation = persistPageThenCheckpoint(initialized(), 1, {
      persistPage: () =>
        new Promise<void>((resolve) => {
          releasePage = resolve;
        }),
      persistCheckpoint,
    });

    await Promise.resolve();
    expect(persistCheckpoint).not.toHaveBeenCalled();

    releasePage?.();
    await operation;
    expect(persistCheckpoint).toHaveBeenCalledOnce();
  });

  it("allows a repeated checkpoint update without removing metadata", () => {
    const first = advanceCheckpointMetadata(initialized(), 2);
    const repeated = advanceCheckpointMetadata(first, 2);

    expect(repeated).toEqual(first);
    expect(repeated).toMatchObject({
      trace: { attempt: 1 },
      resume: {
        endpoint: "/v4/666034/sales_invoices",
        last_completed_page: 2,
      },
    });
  });

  it("prevents checkpoint regression", () => {
    const current = advanceCheckpointMetadata(initialized(), 3);

    expect(() => advanceCheckpointMetadata(current, 2)).toThrow(
      "Checkpoint regression is not allowed",
    );
  });

  it("does not advance when mirror persistence fails", async () => {
    const persistCheckpoint = vi.fn(async () => undefined);

    await expect(
      persistPageThenCheckpoint(initialized(), 1, {
        persistPage: async () => {
          throw new Error("Mirror persistence failed");
        },
        persistCheckpoint,
      }),
    ).rejects.toThrow("Mirror persistence failed");

    expect(persistCheckpoint).not.toHaveBeenCalled();
  });
});
