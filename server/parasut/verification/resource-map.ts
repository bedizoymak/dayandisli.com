// Phase 1 permanent verification tooling: the 28-resource -> OpenAPI
// component name mapping. This is a naming lookup table only — it does not
// itself assert field contents; the extractor resolves those from the spec.

export interface ResourceMapping {
  attrs: string;
  wrapper: string;
  tag: string;
}

export const RESOURCE_MAP: Readonly<Record<string, ResourceMapping>> = {
  accounts: { attrs: "AccountAttributes", wrapper: "Account", tag: "Accounts" },
  bank_fees: { attrs: "BankFeeAttributes", wrapper: "BankFee", tag: "BankFees" },
  contacts: { attrs: "ContactAttributes", wrapper: "Contact", tag: "Contacts" },
  e_archives: { attrs: "EArchiveAttributes", wrapper: "EArchive", tag: "EArchives" },
  e_invoice_inboxes: { attrs: "EInvoiceInboxAttributes", wrapper: "EInvoiceInbox", tag: "EInvoiceInboxes" },
  e_invoices: { attrs: "EInvoiceAttributes", wrapper: "EInvoice", tag: "EInvoices" },
  e_smms: { attrs: "ESmmAttributes", wrapper: "ESmm", tag: "ESmms" },
  employees: { attrs: "EmployeeAttributes", wrapper: "Employee", tag: "Employees" },
  inventory_levels: { attrs: "InventoryLevelAttributes", wrapper: "InventoryLevel", tag: "InventoryLevels" },
  item_categories: { attrs: "ItemCategoryAttributes", wrapper: "ItemCategory", tag: "ItemCategories" },
  payments: { attrs: "PaymentAttributes", wrapper: "Payment", tag: "Payments" },
  products: { attrs: "ProductAttributes", wrapper: "Product", tag: "Products" },
  purchase_bill_details: { attrs: "PurchaseBillDetailAttributes", wrapper: "PurchaseBillDetail", tag: "PurchaseBills" },
  purchase_bills: { attrs: "PurchaseBillAttributes", wrapper: "PurchaseBill", tag: "PurchaseBills" },
  salaries: { attrs: "SalaryAttributes", wrapper: "Salary", tag: "Salaries" },
  sales_invoice_details: { attrs: "SalesInvoiceDetailAttributes", wrapper: "SalesInvoiceDetail", tag: "SalesInvoices" },
  sales_invoices: { attrs: "SalesInvoiceAttributes", wrapper: "SalesInvoice", tag: "SalesInvoices" },
  sales_offers: { attrs: "SalesOfferAttributes", wrapper: "SalesOffers", tag: "SalesOffers" },
  sales_offers_details: { attrs: "SalesOffersDetailAttributes", wrapper: "SalesOffersDetails", tag: "SalesOffers" },
  shipment_documents: { attrs: "ShipmentDocumentAttributes", wrapper: "ShipmentDocument", tag: "ShipmentDocuments" },
  stock_movements: { attrs: "StockMovementAttributes", wrapper: "StockMovement", tag: "StockMovements" },
  stock_update_details: { attrs: "StockUpdateDetailAttributes", wrapper: "StockUpdateDetail", tag: "StockUpdates" },
  stock_updates: { attrs: "StockUpdateAttributes", wrapper: "StockUpdate", tag: "StockUpdates" },
  tags: { attrs: "TagAttributes", wrapper: "Tag", tag: "Tags" },
  taxes: { attrs: "TaxAttributes", wrapper: "Tax", tag: "Taxes" },
  trackable_jobs: { attrs: "TrackableJobAttributes", wrapper: "TrackableJob", tag: "TrackableJobs" },
  transactions: { attrs: "TransactionAttributes", wrapper: "Transaction", tag: "Transactions" },
  warehouses: { attrs: "WarehouseAttributes", wrapper: "Warehouse", tag: "Warehouses" },
};

export const RESOURCE_ORDER: readonly string[] = Object.keys(RESOURCE_MAP);

export const ENVELOPE_COLUMNS: readonly string[] = [
  "id", "company_id", "parasut_id", "parasut_company_id", "resource_type",
  "source_created_at", "source_updated_at", "source_archived", "raw_payload",
  "attributes", "relationships", "included",
  "first_seen_at", "last_seen_at", "synced_at", "payload_hash", "created_at", "updated_at",
];
