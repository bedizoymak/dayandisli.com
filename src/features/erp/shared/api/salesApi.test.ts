import { beforeEach, describe, expect, it, vi } from "vitest";
import type { ERPQuotation, SalesOrder, SalesOrderItem, Stakeholder } from "../types";

const { fromMock, createStakeholderMock, createAuditLogMock } = vi.hoisted(() => ({
  fromMock: vi.fn(),
  createStakeholderMock: vi.fn(),
  createAuditLogMock: vi.fn(),
}));

vi.mock("@/integrations/supabase/client", () => ({
  supabase: {
    from: fromMock,
  },
}));

vi.mock("./crmApi", () => ({
  createStakeholder: createStakeholderMock,
}));

vi.mock("./internal", async (importOriginal) => {
  const actual = await importOriginal<typeof import("./internal")>();
  return {
    ...actual,
    createAuditLog: createAuditLogMock,
    getNextERPNumber: vi.fn(async () => ({ data: "SO-TEST-1", error: null })),
    withEnterpriseOwnership: vi.fn(async (payload) => payload),
  };
});

import {
  convertQuotationToSalesOrder,
  createSalesOrderItem,
  findOrCreateStakeholderByCompany,
  listSalesOrders,
} from "./salesApi";

type QueryResult<T> = { data: T | null; error: unknown };

function query<T>(result: QueryResult<T>) {
  const builder = {
    select: vi.fn(() => builder),
    insert: vi.fn(() => builder),
    update: vi.fn(() => builder),
    eq: vi.fn(() => builder),
    ilike: vi.fn(() => builder),
    limit: vi.fn(() => builder),
    order: vi.fn(() => builder),
    or: vi.fn(() => builder),
    single: vi.fn(async () => result),
    maybeSingle: vi.fn(async () => result),
    then: (resolve: (value: QueryResult<T>) => unknown) => Promise.resolve(result).then(resolve),
  };
  return builder;
}

const stakeholder: Stakeholder = {
  id: "stakeholder-1",
  type: "customer",
  company_name: "Test Firma",
  contact_name: null,
  phone: null,
  email: null,
  tax_office: null,
  tax_number: null,
  address: null,
  city: null,
  country: "Türkiye",
  risk_limit: 0,
  current_balance: 0,
  notes: null,
  is_active: true,
  created_at: "2026-06-13T00:00:00.000Z",
};

const salesOrder: SalesOrder = {
  id: "order-1",
  order_no: "SO-TEST-1",
  stakeholder_id: stakeholder.id,
  source_quotation_id: "quotation-1",
  title: "Tekliften Oluşan Sipariş - T-1",
  description: null,
  status: "new",
  priority: "normal",
  order_date: "2026-06-13",
  due_date: null,
  currency: "TRY",
  subtotal: 100,
  tax_total: 20,
  grand_total: 120,
  notes: null,
  created_at: "2026-06-13T00:00:00.000Z",
};

const quotation: ERPQuotation = {
  id: "quotation-1",
  teklif_no: "T-1",
  firma: stakeholder.company_name,
  ilgili_kisi: null,
  products: [{ kod: "P-1", cins: "Dişli", miktar: 2, birimFiyat: 50, birim: "adet" }],
  subtotal: 100,
  kdv: 20,
  total: 120,
  active_currency: "TRY",
  created_at: "2026-06-13T00:00:00.000Z",
};

function queueFrom(...builders: ReturnType<typeof query>[]) {
  for (const builder of builders) fromMock.mockReturnValueOnce(builder);
}

describe("Sales API", () => {
  beforeEach(() => {
    fromMock.mockReset();
    createStakeholderMock.mockReset();
    createAuditLogMock.mockReset();
    createAuditLogMock.mockResolvedValue({ data: { id: "audit-1" }, error: null });
  });

  it("finds an existing stakeholder without creating a duplicate", async () => {
    queueFrom(query({ data: stakeholder, error: null }));

    const result = await findOrCreateStakeholderByCompany("  Test Firma  ");

    expect(result).toEqual({ data: stakeholder, error: null });
    expect(createStakeholderMock).not.toHaveBeenCalled();
  });

  it("creates a stakeholder when no matching company exists", async () => {
    queueFrom(query<Stakeholder>({ data: null, error: null }));
    createStakeholderMock.mockResolvedValue({ data: stakeholder, error: null });

    const result = await findOrCreateStakeholderByCompany("Test Firma");

    expect(createStakeholderMock).toHaveBeenCalledWith({
      type: "customer",
      company_name: "Test Firma",
      is_active: true,
    });
    expect(result.data).toBe(stakeholder);
  });

  it("normalizes Supabase errors returned by sales-order listing", async () => {
    queueFrom(query<SalesOrder[]>({ data: null, error: { message: "Sipariş sorgusu başarısız" } }));

    const result = await listSalesOrders("", { consolidated: true });

    expect(result).toEqual({
      data: [],
      error: "Sipariş sorgusu başarısız",
      missingTable: false,
    });
  });

  it("calculates and inserts sales-order item defaults", async () => {
    const inserted: SalesOrderItem = {
      id: "item-1",
      sales_order_id: salesOrder.id,
      item_code: null,
      description: "Test kalemi",
      quantity: 2,
      unit: "adet",
      unit_price: 25,
      total: 50,
      technical_drawing_id: null,
      created_at: "2026-06-13T00:00:00.000Z",
    };
    const itemQuery = query({ data: inserted, error: null });
    queueFrom(itemQuery);

    const result = await createSalesOrderItem({
      sales_order_id: salesOrder.id,
      description: "Test kalemi",
      quantity: 2,
      unit_price: 25,
    });

    expect(itemQuery.insert).toHaveBeenCalledWith(expect.objectContaining({
      quantity: 2,
      unit_price: 25,
      total: 50,
      unit: "adet",
    }));
    expect(result.data).toBe(inserted);
  });

  it("converts a quotation only after all items and the link succeed", async () => {
    const item: SalesOrderItem = {
      id: "item-1",
      sales_order_id: salesOrder.id,
      item_code: "P-1",
      description: "Dişli",
      quantity: 2,
      unit: "adet",
      unit_price: 50,
      total: 100,
      technical_drawing_id: null,
      created_at: "2026-06-13T00:00:00.000Z",
    };
    queueFrom(
      query<SalesOrder>({ data: null, error: null }),
      query<{ id: string; status: string }>({ data: null, error: null }),
      query({ data: stakeholder, error: null }),
      query({ data: salesOrder, error: null }),
      query({ data: item, error: null }),
      query({ data: { id: "link-1" }, error: null }),
    );

    const result = await convertQuotationToSalesOrder(quotation);

    expect(result.data).toBe(salesOrder);
    expect(createAuditLogMock).toHaveBeenCalledOnce();
    expect(fromMock).toHaveBeenLastCalledWith("erp_quotation_links");
  });

  it("stops conversion when an item insert fails and does not link or audit", async () => {
    queueFrom(
      query<SalesOrder>({ data: null, error: null }),
      query<{ id: string; status: string }>({ data: null, error: null }),
      query({ data: stakeholder, error: null }),
      query({ data: salesOrder, error: null }),
      query<SalesOrderItem>({ data: null, error: { message: "Kalem eklenemedi" } }),
    );

    const result = await convertQuotationToSalesOrder(quotation);

    expect(result).toEqual({
      data: null,
      error: "Kalem eklenemedi",
      missingTable: false,
    });
    expect(fromMock).toHaveBeenCalledTimes(5);
    expect(createAuditLogMock).not.toHaveBeenCalled();
  });
});
