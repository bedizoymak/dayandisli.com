// D8 resolution: the 151 fields flagged in the Phase 1 audit as having live
// production data present with no attributable current-code writer.
//
// Per instruction, historical authorship is explicitly NOT required to
// resolve this — what matters is each field's PRESENT-DAY implementation
// status, determined from already-accepted repository evidence: the
// official OpenAPI extraction, the field-mapping registry, the offline
// mapper, the actual sync/write path (upsert-resource.ts + each
// sync-*.ts wrapper's numericAttributeFields), and the Phase 1 migration/
// live-schema comparison. No new production query and no Paraşüt endpoint
// call was made to produce this file — it is pure classification over
// already-accepted evidence.

import { FIELD_MAPPING_REGISTRY } from "../field-mapping-registry.ts";

export type ImplementationCategory =
  | "ALREADY_IMPLEMENTED_CORRECTLY_MAPPED"
  | "INTENTIONALLY_RAW_PAYLOAD_ONLY"
  | "REQUIRES_TYPED_COLUMN_MAPPING"
  | "REQUIRES_EXPLICIT_TRANSFORMATION"
  | "UNSUPPORTED_READ_ONLY"
  | "WRITE_PATH_PROHIBITED"
  | "GENUINELY_UNRESOLVED_MISSING_DOCS";

export interface D8FieldResolution {
  resource: string;
  attribute: string;
  category: ImplementationCategory;
  reasoning: string;
}

/**
 * The exact 151 (resource, attribute) pairs identified in the Phase 1 audit
 * (docs/parasut/PARASUT_PROFESSIONAL_INTEGRATION_MASTER_PLAN.md §14.5) as
 * having live production data with no current-code writer. Carried forward
 * verbatim from that accepted evidence — not re-derived, not re-queried.
 */
export const D8_FIELD_KEYS: readonly string[] = [
  "accounts.last_used_at", "accounts.balance", "accounts.account_type", "accounts.bank_branch", "accounts.iban",
  "e_invoices.external_id", "e_invoices.uuid", "e_invoices.env_uuid", "e_invoices.from_address", "e_invoices.from_vkn",
  "e_invoices.to_address", "e_invoices.to_vkn", "e_invoices.direction", "e_invoices.note", "e_invoices.response_type",
  "e_invoices.contact_name", "e_invoices.scenario", "e_invoices.status", "e_invoices.issue_date", "e_invoices.is_expired",
  "e_invoices.is_answerable", "e_invoices.net_total", "e_invoices.currency", "e_invoices.item_type",
  "employees.balance", "employees.trl_balance", "employees.usd_balance", "employees.eur_balance", "employees.gbp_balance", "employees.name",
  "products.sales_invoice_details_count", "products.purchase_invoice_details_count", "products.list_price_in_trl",
  "products.buying_price_in_trl", "products.stock_count", "products.code", "products.name", "products.vat_rate",
  "products.sales_excise_duty", "products.sales_excise_duty_type", "products.purchase_excise_duty",
  "products.purchase_excise_duty_type", "products.unit", "products.communications_tax_rate", "products.list_price",
  "products.currency", "products.buying_price", "products.buying_currency", "products.inventory_tracking", "products.initial_stock_count",
  "purchase_bills.total_paid", "purchase_bills.gross_total", "purchase_bills.total_excise_duty", "purchase_bills.total_communications_tax",
  "purchase_bills.total_vat", "purchase_bills.total_vat_withholding", "purchase_bills.total_discount", "purchase_bills.total_invoice_discount",
  "purchase_bills.remaining", "purchase_bills.remaining_in_trl", "purchase_bills.payment_status", "purchase_bills.is_detailed",
  "purchase_bills.sharings_count", "purchase_bills.e_invoices_count", "purchase_bills.remaining_reimbursement",
  "purchase_bills.remaining_reimbursement_in_trl", "purchase_bills.item_type", "purchase_bills.description", "purchase_bills.issue_date",
  "purchase_bills.due_date", "purchase_bills.invoice_no", "purchase_bills.currency", "purchase_bills.exchange_rate",
  "purchase_bills.net_total", "purchase_bills.withholding_rate", "purchase_bills.invoice_discount_type", "purchase_bills.invoice_discount",
  "sales_invoices.invoice_no", "sales_invoices.net_total", "sales_invoices.withholding", "sales_invoices.total_excise_duty",
  "sales_invoices.total_communications_tax", "sales_invoices.total_vat", "sales_invoices.total_vat_withholding",
  "sales_invoices.total_discount", "sales_invoices.total_invoice_discount", "sales_invoices.before_taxes_total",
  "sales_invoices.remaining", "sales_invoices.remaining_in_trl", "sales_invoices.payment_status", "sales_invoices.item_type",
  "sales_invoices.description", "sales_invoices.issue_date", "sales_invoices.due_date", "sales_invoices.currency",
  "sales_invoices.exchange_rate", "sales_invoices.withholding_rate", "sales_invoices.invoice_discount_type",
  "sales_invoices.invoice_discount", "sales_invoices.billing_address", "sales_invoices.billing_postal_code",
  "sales_invoices.billing_phone", "sales_invoices.billing_fax", "sales_invoices.tax_office", "sales_invoices.tax_number",
  "sales_invoices.city", "sales_invoices.district", "sales_invoices.is_abroad", "sales_invoices.shipment_included",
  "sales_invoices.cash_sale", "sales_invoices.payer_tax_numbers", "sales_invoices.invoice_note", "sales_invoices.append_contact_balance",
  "sales_offers.content", "sales_offers.contact_type", "sales_offers.sharings_count", "sales_offers.status",
  "sales_offers.display_exchange_rate_in_pdf", "sales_offers.net_total", "sales_offers.gross_total", "sales_offers.withholding",
  "sales_offers.total_excise_duty", "sales_offers.total_communications_tax", "sales_offers.total_accommodation_tax",
  "sales_offers.total_vat", "sales_offers.total_vat_withholding", "sales_offers.vat_withholding", "sales_offers.total_discount",
  "sales_offers.total_invoice_discount", "sales_offers.description", "sales_offers.issue_date", "sales_offers.due_date",
  "sales_offers.currency", "sales_offers.exchange_rate", "sales_offers.withholding_rate", "sales_offers.invoice_discount_type",
  "sales_offers.invoice_discount", "sales_offers.billing_address", "sales_offers.tax_office", "sales_offers.tax_number", "sales_offers.is_abroad",
  "shipment_documents.print_note", "shipment_documents.inflow", "shipment_documents.description", "shipment_documents.city",
  "shipment_documents.district", "shipment_documents.address", "shipment_documents.issue_date", "shipment_documents.shipment_date",
  "shipment_documents.procurement_number",
  "warehouses.name",
];

const RESOURCES_WITH_SYNC_WRAPPER = new Set(["accounts", "contacts", "products", "sales_invoices", "purchase_bills"]);

/**
 * Practical, present-day classification — no historical-authorship claim.
 * Every one of the 151 D8 fields is:
 *   - a confirmed official OpenAPI attribute (Phase 1, §16.4: 398 total,
 *     these are all in the EXACT_MATCH or EXPLICIT_COMPATIBLE_REDIRECT set);
 *   - backed by a real, correctly-typed migration/production column
 *     (Phase 1: 0 missing, 0 type mismatches across all 398);
 *   - already correctly registered in the canonical field-mapping registry
 *     (server/parasut/field-mapping-registry.ts) with the right
 *     expectedPgType/sourceLocation, ready for deriveTypedRow (Phase 2A);
 *   - NOT written by any current production code path (confirmed: neither
 *     the relevant sync-*.ts wrapper's numericAttributeFields, nor any
 *     other write path, touches these columns).
 * The uniform, correct classification for all 151 is therefore
 * REQUIRES_TYPED_COLUMN_MAPPING: the schema and registry are ready, the
 * mapper exists (offline-mapper.ts), and the only remaining step is wiring
 * it into the production write path — which is a production write and
 * stays WRITE_PATH_PROHIBITED under current authorization, tracked as a
 * Phase 2B item, not a Phase 1/D8 unknown.
 */
export function classifyD8Field(fieldKey: string): D8FieldResolution {
  const [resource, attribute] = fieldKey.split(".");
  const registryEntry = FIELD_MAPPING_REGISTRY.find((f) => f.resource === resource && f.attribute === attribute);

  if (!registryEntry) {
    return {
      resource, attribute,
      category: "GENUINELY_UNRESOLVED_MISSING_DOCS",
      reasoning: "Not found in the accepted field-mapping registry — cannot classify from existing evidence.",
    };
  }
  if (registryEntry.currentlyMappedByProduction) {
    return {
      resource, attribute,
      category: "ALREADY_IMPLEMENTED_CORRECTLY_MAPPED",
      reasoning: "Registry confirms this field is already written by the current production upsert path.",
    };
  }
  const hasWrapper = RESOURCES_WITH_SYNC_WRAPPER.has(resource);
  return {
    resource, attribute,
    category: "REQUIRES_TYPED_COLUMN_MAPPING",
    reasoning: hasWrapper
      ? `Official OpenAPI attribute (Phase 1 §16.4), correctly-typed migration/production column exists (Phase 1: 0 missing, 0 mismatches), registered in field-mapping-registry.ts, deriveTypedRow-ready (offline-mapper.ts). A sync wrapper exists for '${resource}' but does not currently include this field in numericAttributeFields. Historical live values (if any) were not written by any current code path — resolved as a present-day mapping gap, not a provenance mystery. Wiring requires a production write (Phase 2B), not currently authorized.`
      : `Official OpenAPI attribute, correctly-typed column exists, registered and deriveTypedRow-ready. No sync wrapper currently exists for resource '${resource}' at all — mapping requires both a new sync wrapper AND typed-column wiring, both production-writing changes. Not currently authorized (Phase 2B).`,
  };
}

export function resolveAllD8Fields(): D8FieldResolution[] {
  return D8_FIELD_KEYS.map(classifyD8Field);
}

export function summarizeD8Resolution(resolutions: readonly D8FieldResolution[]): Record<ImplementationCategory, number> {
  const summary: Record<ImplementationCategory, number> = {
    ALREADY_IMPLEMENTED_CORRECTLY_MAPPED: 0,
    INTENTIONALLY_RAW_PAYLOAD_ONLY: 0,
    REQUIRES_TYPED_COLUMN_MAPPING: 0,
    REQUIRES_EXPLICIT_TRANSFORMATION: 0,
    UNSUPPORTED_READ_ONLY: 0,
    WRITE_PATH_PROHIBITED: 0,
    GENUINELY_UNRESOLVED_MISSING_DOCS: 0,
  };
  for (const r of resolutions) summary[r.category]++;
  return summary;
}
