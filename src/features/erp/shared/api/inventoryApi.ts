import { supabase } from "@/integrations/supabase/client";
import type {
  ApiResult,
  InventoryItem,
  InventoryMovement,
  InventoryMovementType,
  Warehouse,
} from "../types";
import {
  applyEnterpriseScope,
  createAuditLog,
  DbResult,
  EnterpriseQueryScope,
  failure,
  normalizeSearch,
  numberValue,
  resolveEnterpriseScope,
  success,
  validationFailure,
  withEnterpriseOwnership,
} from "./internal";

export async function listWarehouses(companyId?: string | null, branchId?: string | null): Promise<ApiResult<Warehouse[]>> {
  let query = supabase.from("warehouses" as never).select("*").order("name", { ascending: true });
  if (companyId) query = query.eq("company_id" as never, companyId as never);
  if (branchId) query = query.eq("branch_id" as never, branchId as never);
  const { data, error } = (await query) as unknown as DbResult<Warehouse[]>;
  if (error) return failure("listWarehouses", error, []);
  return success(data ?? []);
}

export async function createWarehouse(payload: Partial<Warehouse> & { company_id: string; code: string; name: string }) {
  const { data, error } = (await supabase
    .from("warehouses" as never)
    .insert({
      company_id: payload.company_id,
      branch_id: payload.branch_id ?? null,
      code: payload.code,
      name: payload.name,
      status: payload.status ?? "active",
      visibility_scope: payload.visibility_scope ?? "branch",
      address_line: payload.address_line ?? null,
      city: payload.city ?? null,
      manager_email: payload.manager_email ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<Warehouse>;

  if (error) return failure("createWarehouse", error, null);
  await createAuditLog({ company_id: data?.company_id, branch_id: data?.branch_id, entity_type: "warehouse", entity_id: data?.id, action: "warehouse_created", description: `${data?.name} depo kaydı oluşturuldu.` });
  return success(data);
}

export async function updateWarehouse(id: string, payload: Partial<Warehouse>) {
  const { data, error } = (await supabase
    .from("warehouses" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<Warehouse>;

  if (error) return failure("updateWarehouse", error, null);
  await createAuditLog({ company_id: data?.company_id, branch_id: data?.branch_id, entity_type: "warehouse", entity_id: id, action: "warehouse_updated", description: `${data?.name} depo kaydı güncellendi.` });
  return success(data);
}

export async function listInventoryItems(search = "", scope?: EnterpriseQueryScope): Promise<ApiResult<InventoryItem[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  let query = applyEnterpriseScope(supabase
    .from("inventory_items" as never)
    .select("*")
    .order("created_at", { ascending: false }), enterpriseScope);

  const q = normalizeSearch(search);
  if (q) query = query.or(`name.ilike.%${q}%,code.ilike.%${q}%`);

  const { data, error } = (await query) as unknown as DbResult<InventoryItem[]>;
  if (error) return failure("listInventoryItems", error, []);
  return success(data ?? []);
}

export async function getInventoryItemById(id: string) {
  const { data, error } = (await supabase
    .from("inventory_items" as never)
    .select("*")
    .eq("id", id)
    .single()) as unknown as DbResult<InventoryItem>;

  if (error) return failure("getInventoryItemById", error, null);
  return success(data);
}

export async function createInventoryItem(payload: Partial<InventoryItem> & { item_type: InventoryItem["item_type"]; name: string }) {
  const record = await withEnterpriseOwnership({
    item_type: payload.item_type,
    code: payload.code ?? null,
    name: payload.name,
    description: payload.description ?? null,
    unit: payload.unit ?? "adet",
    current_stock: payload.current_stock ?? 0,
    min_stock: payload.min_stock ?? 0,
    location: payload.location ?? null,
    supplier_id: payload.supplier_id ?? null,
    unit_cost: payload.unit_cost ?? 0,
    is_active: payload.is_active ?? true,
    company_id: payload.company_id ?? null,
    branch_id: payload.branch_id ?? null,
  });
  const { data, error } = (await supabase
    .from("inventory_items" as never)
    .insert(record as never)
    .select("*")
    .single()) as unknown as DbResult<InventoryItem>;

  if (error) return failure("createInventoryItem", error, null);
  return success(data);
}

export async function updateInventoryItem(id: string, payload: Partial<InventoryItem>) {
  const { data, error } = (await supabase
    .from("inventory_items" as never)
    .update(payload as never)
    .eq("id", id)
    .select("*")
    .single()) as unknown as DbResult<InventoryItem>;

  if (error) return failure("updateInventoryItem", error, null);
  return success(data);
}

export async function listInventoryMovements(scope?: EnterpriseQueryScope): Promise<ApiResult<InventoryMovement[]>> {
  const enterpriseScope = await resolveEnterpriseScope(scope);
  const query = applyEnterpriseScope(supabase
    .from("inventory_movements" as never)
    .select("*")
    .order("movement_date", { ascending: false })
    .limit(200), enterpriseScope);
  const { data, error } = (await query) as unknown as DbResult<InventoryMovement[]>;

  if (error) return failure("listInventoryMovements", error, []);
  return success(data ?? []);
}

export async function listInventoryMovementsForItem(inventoryItemId: string): Promise<ApiResult<InventoryMovement[]>> {
  const { data, error } = (await supabase
    .from("inventory_movements" as never)
    .select("*")
    .eq("inventory_item_id", inventoryItemId)
    .order("movement_date", { ascending: false })
    .limit(200)) as unknown as DbResult<InventoryMovement[]>;

  if (error) return failure("listInventoryMovementsForItem", error, []);
  return success(data ?? []);
}

export async function createInventoryMovement(payload: {
  inventory_item_id: string;
  movement_type: InventoryMovementType;
  quantity: number;
  source_type?: string | null;
  source_id?: string | null;
  notes?: string | null;
}) {
  const itemResult = (await supabase
    .from("inventory_items" as never)
    .select("*")
    .eq("id", payload.inventory_item_id)
    .single()) as unknown as DbResult<InventoryItem>;

  if (itemResult.error || !itemResult.data) return failure<InventoryMovement | null>("createInventoryMovement item", itemResult.error, null);

  const currentStock = numberValue(itemResult.data.current_stock, 0);
  const qty = numberValue(payload.quantity, 0);
  if (qty <= 0) {
    return validationFailure<InventoryMovement | null>("Miktar sıfırdan büyük olmalıdır.", null);
  }

  let nextStock = currentStock;

  if (payload.movement_type === "in" || payload.movement_type === "return") nextStock += qty;
  if (payload.movement_type === "out") nextStock -= qty;
  if (payload.movement_type === "adjustment") nextStock += qty;

  if (nextStock < 0) {
    return validationFailure<InventoryMovement | null>("Stok eksiye düşemez.", null);
  }

  const { data, error } = (await supabase
    .from("inventory_movements" as never)
    .insert({
      inventory_item_id: payload.inventory_item_id,
      movement_type: payload.movement_type,
      quantity: qty,
      source_type: payload.source_type ?? "manual",
      source_id: payload.source_id ?? null,
      notes: payload.notes ?? null,
    } as never)
    .select("*")
    .single()) as unknown as DbResult<InventoryMovement>;

  if (error) return failure("createInventoryMovement", error, null);

  if (payload.movement_type !== "reservation") {
    await updateInventoryItem(payload.inventory_item_id, { current_stock: nextStock });
  }

  if (data) {
    await createAuditLog({
      entity_type: "inventory_item",
      entity_id: payload.inventory_item_id,
      action: "inventory_movement_created",
      old_status: String(currentStock),
      new_status: String(nextStock),
      description: `${payload.movement_type} stok hareketi oluşturuldu.`,
      metadata: { movement_id: data.id, quantity: qty, source_type: payload.source_type ?? "manual" },
    });
  }

  return success(data);
}
