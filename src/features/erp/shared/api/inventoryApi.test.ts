import { beforeEach, describe, expect, it, vi } from "vitest";
import type { InventoryItem, InventoryMovement, InventoryMovementType } from "../types";

const { fromMock, createAuditLogMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  createAuditLogMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("./internal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./internal")>();
  return {
    ...actual,
    createAuditLog: createAuditLogMock,
  };
});

import { createInventoryMovement } from "./inventoryApi";

type QueryResult<T> = { data: T | null; error: unknown };

function query<T>(result: QueryResult<T>) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    single: vi.fn(async () => result),
  };
  return builder;
}

const inventoryItem: InventoryItem = {
  id: "item-1",
  item_type: "raw_material",
  code: "HM-1",
  name: "Test Malzeme",
  description: null,
  unit: "adet",
  current_stock: 10,
  min_stock: 2,
  location: null,
  supplier_id: null,
  unit_cost: 5,
  is_active: true,
  created_at: "2026-06-13T00:00:00.000Z",
};

function movement(type: InventoryMovementType, quantity: number): InventoryMovement {
  return {
    id: `movement-${type}`,
    inventory_item_id: inventoryItem.id,
    movement_type: type,
    quantity,
    source_type: "manual",
    source_id: null,
    movement_date: "2026-06-13",
    notes: null,
    created_at: "2026-06-13T00:00:00.000Z",
  };
}

function queueFrom(...builders: ReturnType<typeof query>[]) {
  for (const builder of builders) fromMock.mockReturnValueOnce(builder);
}

function successfulStockUpdate(currentStock: number) {
  return query({
    data: { ...inventoryItem, current_stock: currentStock },
    error: null,
  });
}

describe("Inventory API", () => {
  beforeEach(() => {
    fromMock.mockReset();
    createAuditLogMock.mockReset();
    createAuditLogMock.mockResolvedValue({ data: { id: "audit-1" }, error: null });
  });

  it("increases stock for an incoming movement", async () => {
    const updateQuery = successfulStockUpdate(14);
    queueFrom(
      query({ data: inventoryItem, error: null }),
      query({ data: movement("in", 4), error: null }),
      updateQuery,
    );

    const result = await createInventoryMovement({
      inventory_item_id: inventoryItem.id,
      movement_type: "in",
      quantity: 4,
    });

    expect(updateQuery.update).toHaveBeenCalledWith({ current_stock: 14 });
    expect(result.data?.movement_type).toBe("in");
    expect(createAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
      old_status: "10",
      new_status: "14",
    }));
  });

  it("decreases stock for an outgoing movement", async () => {
    const updateQuery = successfulStockUpdate(7);
    queueFrom(
      query({ data: inventoryItem, error: null }),
      query({ data: movement("out", 3), error: null }),
      updateQuery,
    );

    const result = await createInventoryMovement({
      inventory_item_id: inventoryItem.id,
      movement_type: "out",
      quantity: 3,
    });

    expect(updateQuery.update).toHaveBeenCalledWith({ current_stock: 7 });
    expect(result.error).toBeNull();
  });

  it("rejects an outgoing movement when stock is insufficient", async () => {
    queueFrom(query({ data: inventoryItem, error: null }));

    const result = await createInventoryMovement({
      inventory_item_id: inventoryItem.id,
      movement_type: "out",
      quantity: 11,
    });

    expect(result).toEqual({
      data: null,
      error: "Stok eksiye düşemez.",
      missingTable: false,
    });
    expect(fromMock).toHaveBeenCalledTimes(1);
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });

  it("does not update current stock for a reservation movement", async () => {
    const reservation = movement("reservation", 2);
    queueFrom(
      query({ data: inventoryItem, error: null }),
      query({ data: reservation, error: null }),
    );

    const result = await createInventoryMovement({
      inventory_item_id: inventoryItem.id,
      movement_type: "reservation",
      quantity: 2,
    });

    expect(result.data).toBe(reservation);
    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(createAuditLogMock).toHaveBeenCalledWith(expect.objectContaining({
      old_status: "10",
      new_status: "10",
    }));
  });

  it("stops before stock update when movement insertion fails", async () => {
    queueFrom(
      query({ data: inventoryItem, error: null }),
      query<InventoryMovement>({ data: null, error: { message: "Hareket eklenemedi" } }),
    );

    const result = await createInventoryMovement({
      inventory_item_id: inventoryItem.id,
      movement_type: "in",
      quantity: 2,
    });

    expect(result).toEqual({
      data: null,
      error: "Hareket eklenemedi",
      missingTable: false,
    });
    expect(fromMock).toHaveBeenCalledTimes(2);
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });

  it("returns a deterministic error when stock update fails", async () => {
    queueFrom(
      query({ data: inventoryItem, error: null }),
      query({ data: movement("out", 2), error: null }),
      query<InventoryItem>({ data: null, error: { message: "Stok güncellenemedi" } }),
    );

    const result = await createInventoryMovement({
      inventory_item_id: inventoryItem.id,
      movement_type: "out",
      quantity: 2,
    });

    expect(result).toEqual({
      data: null,
      error: "Stok güncellenemedi",
      missingTable: false,
    });
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });

  it("keeps audit failure non-blocking after critical writes succeed", async () => {
    const insertedMovement = movement("in", 1);
    queueFrom(
      query({ data: inventoryItem, error: null }),
      query({ data: insertedMovement, error: null }),
      successfulStockUpdate(11),
    );
    createAuditLogMock.mockResolvedValue({ data: null, error: "Audit kaydı oluşturulamadı" });

    const result = await createInventoryMovement({
      inventory_item_id: inventoryItem.id,
      movement_type: "in",
      quantity: 1,
    });

    expect(result).toEqual({ data: insertedMovement, error: null });
    expect(createAuditLogMock).toHaveBeenCalledOnce();
  });
});
