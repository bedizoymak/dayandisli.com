import type { MirrorTable } from "./types.ts";

// Classification of every Paraşüt resource this project cares about — the 24
// top-level resources documented at https://apidocs.parasut.com/ (swagger.json)
// plus the "payments" sub-resource that already has its own mirror table.
//
// "direct-list" entries were empirically verified against the live API on
// 2026-07-23 (see the sync run this registry accompanies). Their `endpoint`
// segment is exactly what returned real data (or a valid empty page) —
// nothing here is guessed from swagger alone.
export type ResourceSupport =
  | "direct-list" // GET /v4/{company_id}/<endpoint> returns a paginated list
  | "nested" // only reachable via a parent resource (include= or a sub-path), no
  //           standalone list endpoint
  | "unsupported"; // swagger documents a standalone list endpoint but the live
//                   API returned an error for it; do not fabricate a corrected path

export interface ResourceConfig {
  resourceType: string;
  table: MirrorTable;
  support: ResourceSupport;
  /** Path segment appended to `/v4/{company_id}/`. Only set for "direct-list". */
  endpoint?: string;
  /** Why it's classified this way, and what evidence backs it. */
  notes: string;
}

export const PARASUT_RESOURCE_REGISTRY: ResourceConfig[] = [
  // --- Already wired into server/parasut/sync-*.ts before this pass ---
  {
    resourceType: "contacts",
    table: "contacts",
    support: "direct-list",
    endpoint: "contacts",
    notes: "Existing sync-contacts.ts. 436 rows in production as of 2026-07-23.",
  },
  {
    resourceType: "products",
    table: "products",
    support: "direct-list",
    endpoint: "products",
    notes: "Existing sync-products.ts. Verified live: 2484 rows across 100 pages.",
  },
  {
    resourceType: "accounts",
    table: "accounts",
    support: "direct-list",
    endpoint: "accounts",
    notes: "Existing sync-accounts.ts. Verified live: 3 rows.",
  },
  {
    resourceType: "sales_invoices",
    table: "sales_invoices",
    support: "direct-list",
    endpoint: "sales_invoices",
    notes: "Existing sync-sales-invoices.ts. Verified live: 436 rows across 18 pages.",
  },
  {
    resourceType: "purchase_bills",
    table: "purchase_bills",
    support: "direct-list",
    endpoint: "purchase_bills",
    notes: "Existing sync-purchase-bills.ts. Verified live: 767 rows across 31 pages.",
  },
  {
    resourceType: "sales_invoice_details",
    table: "sales_invoice_details",
    support: "nested",
    notes:
      "No standalone list endpoint in swagger.json. Already handled correctly: " +
      "sync-base.ts's INCLUDED_DEFINITIONS extracts these from the `included` " +
      "array of a sales_invoices page (requires `include=details` on that request). Do not build a separate direct fetch for this resource.",
  },
  {
    resourceType: "purchase_bill_details",
    table: "purchase_bill_details",
    support: "nested",
    notes:
      "Same shape as sales_invoice_details: already handled via sync-base.ts's " +
      "INCLUDED_DEFINITIONS off a purchase_bills page's `included` array.",
  },
  {
    resourceType: "payments",
    table: "payments",
    support: "nested",
    notes:
      "swagger only exposes payments as a sub-path of another resource " +
      "(e.g. /sales_invoices/{id}/payments, /purchase_bills/{id}/payments, " +
      "/salaries/{id}/payments, /taxes/{id}/payments, /bank_fees/{id}/payments) " +
      "— there is no company-level list. Already handled via sync-base.ts's " +
      "INCLUDED_DEFINITIONS when a parent request includes payments.",
  },

  // --- Verified direct-list resources newly added 2026-07-23 ---
  {
    resourceType: "e_invoices",
    table: "e_invoices",
    support: "direct-list",
    endpoint: "e_invoices",
    notes: "Verified live: 1626 rows across 66 pages, including one 429 (handled by client.ts retry).",
  },
  {
    resourceType: "e_invoice_inboxes",
    table: "e_invoice_inboxes",
    support: "direct-list",
    endpoint: "e_invoice_inboxes",
    notes: "Verified live: HTTP 200, empty result set (this account has none configured). Confirmed valid, not a routing failure.",
  },
  {
    resourceType: "employees",
    table: "employees",
    support: "direct-list",
    endpoint: "employees",
    notes:
      "Verified live: 6 rows. NOTE: the live attribute set includes tckn, " +
      "employment_start_date, employment_end_date, phone, and relationships " +
      "activities/comments/tags that are absent from swagger.json's " +
      "EmployeeAttributes — the migration's employees table has no typed " +
      "columns for these; they only survive in raw_payload today.",
  },
  {
    resourceType: "item_categories",
    table: "item_categories",
    support: "direct-list",
    endpoint: "item_categories",
    notes: "Verified live: HTTP 200, empty result set for this account.",
  },
  {
    resourceType: "salaries",
    table: "salaries",
    support: "direct-list",
    endpoint: "salaries",
    notes: "Verified live: HTTP 200, empty result set for this account.",
  },
  {
    resourceType: "sales_offers",
    table: "sales_offers",
    support: "direct-list",
    endpoint: "sales_offers",
    notes: "Verified live: 1 row.",
  },
  {
    resourceType: "shipment_documents",
    table: "shipment_documents",
    support: "direct-list",
    endpoint: "shipment_documents",
    notes: "Verified live: 14 rows.",
  },
  {
    resourceType: "tags",
    table: "tags",
    support: "direct-list",
    endpoint: "tags",
    notes: "Verified live: HTTP 200, empty result set for this account.",
  },
  {
    resourceType: "taxes",
    table: "taxes",
    support: "direct-list",
    endpoint: "taxes",
    notes: "Verified live: HTTP 200, empty result set for this account.",
  },
  {
    resourceType: "warehouses",
    table: "warehouses",
    support: "direct-list",
    endpoint: "warehouses",
    notes: "Verified live: 1 row (\"Ana Depo\").",
  },

  // --- Confirmed unsupported: swagger documents a list endpoint, live API disagrees ---
  {
    resourceType: "bank_fees",
    table: "bank_fees",
    support: "unsupported",
    notes:
      "swagger.json documents GET /{company_id}/bank_fees. Live request returned " +
      "HTTP 404 {\"errors\":[{\"title\":\"Not Found\",\"detail\":\"No route matches.\"}]} " +
      "on 2026-07-23. Not retried as a routing/plan issue since 404 is a permanent " +
      "client error, not transient. Needs confirmation from Paraşüt support or a " +
      "packages/feature-flag check before assuming a corrected path — do not guess one.",
  },
  {
    resourceType: "e_archives",
    table: "e_archives",
    support: "unsupported",
    notes: "Same evidence as bank_fees: documented endpoint returned HTTP 404 live on 2026-07-23.",
  },
  {
    resourceType: "e_smms",
    table: "e_smms",
    support: "unsupported",
    notes: "Same evidence as bank_fees: documented endpoint returned HTTP 404 live on 2026-07-23.",
  },
  {
    resourceType: "stock_updates",
    table: "stock_updates",
    support: "unsupported",
    notes: "Same evidence as bank_fees: documented endpoint returned HTTP 404 live on 2026-07-23.",
  },
  {
    resourceType: "transactions",
    table: "transactions",
    support: "unsupported",
    notes: "Same evidence as bank_fees: documented endpoint returned HTTP 404 live on 2026-07-23.",
  },
  {
    resourceType: "stock_movements",
    table: "stock_movements",
    support: "unsupported",
    notes:
      "swagger.json documents GET /{company_id}/stock_movements. Live request " +
      "returned HTTP 500 {\"status\":500,\"error\":\"Internal Server Error\"} on " +
      "2026-07-23 — a server-side failure, not a routing problem. Needs investigation " +
      "(possibly requires a query parameter this account's dataset doesn't satisfy) " +
      "before retrying; do not treat a 500 as proof the endpoint is unusable long-term.",
  },

  // --- Nested/derived resources not attempted in the 2026-07-23 run ---
  {
    resourceType: "inventory_levels",
    table: "inventory_levels",
    support: "nested",
    notes:
      "swagger.json only exposes this under /product/{product_id}/inventory_levels " +
      "(singular \"product\", not the company-level \"products\" list) — there is no " +
      "company-wide list endpoint. Syncing this resource requires iterating every " +
      "already-synced product's id and issuing one request per product; not " +
      "implemented here to avoid an unbounded N+1 request pattern without an " +
      "explicit rate-limit budget decision.",
  },
  {
    resourceType: "trackable_jobs",
    table: "trackable_jobs",
    support: "nested",
    notes:
      "swagger.json only exposes GET /{company_id}/trackable_jobs/{id} (single-record " +
      "lookup for polling an async job's status) — there is no list endpoint by design. " +
      "Not a resource to mirror in bulk; each id is only meaningful right after " +
      "triggering the async operation that returned it.",
  },
  {
    resourceType: "sales_offers_details",
    table: "sales_offers_details",
    support: "nested",
    notes:
      "By analogy with sales_invoice_details/purchase_bill_details this is almost " +
      "certainly an `included` sub-resource of a sales_offers request with " +
      "include=details, not a standalone list — but this project's " +
      "INCLUDED_DEFINITIONS map in sync-base.ts does not yet register it, so " +
      "storeIncluded() will silently skip these resources today even when a " +
      "sales_offers request includes them. Confirmed gap, not yet fixed in this pass.",
  },
  {
    resourceType: "stock_update_details",
    table: "stock_update_details",
    support: "nested",
    notes:
      "By analogy with the other *_details tables, almost certainly an `included` " +
      "sub-resource of a stock_updates request — same INCLUDED_DEFINITIONS gap as " +
      "sales_offers_details. Also blocked on stock_updates itself being unsupported " +
      "(see above), so there is no parent request to include it from right now.",
  },
];

export function getResourceConfig(resourceType: string): ResourceConfig | undefined {
  return PARASUT_RESOURCE_REGISTRY.find((entry) => entry.resourceType === resourceType);
}

export function directListResources(): ResourceConfig[] {
  return PARASUT_RESOURCE_REGISTRY.filter((entry) => entry.support === "direct-list");
}

export function buildDirectListEndpoint(parasutCompanyId: string, config: ResourceConfig): string {
  if (config.support !== "direct-list" || !config.endpoint) {
    throw new Error(
      `${config.resourceType} is not a direct-list resource (support=${config.support}); ` +
        "it cannot be fetched with a standalone endpoint.",
    );
  }
  return `/v4/${encodeURIComponent(parasutCompanyId)}/${config.endpoint}`;
}
