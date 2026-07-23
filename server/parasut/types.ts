export type JsonObject = Record<string, unknown>;

export interface JsonApiResource {
  id: string;
  type: string;
  attributes?: JsonObject;
  relationships?: JsonObject;
  links?: JsonObject;
  meta?: JsonObject;
}

export interface JsonApiDocument {
  data: JsonApiResource | JsonApiResource[] | null;
  included?: JsonApiResource[];
  meta?: JsonObject;
  links?: JsonObject;
}

export interface OAuthToken {
  accessToken: string;
  refreshToken?: string;
  expiresAt: number;
}

export interface ParaşütCredentials {
  clientId: string;
  clientSecret: string;
  username?: string;
  password?: string;
  redirectUri?: string;
  refreshToken?: string;
}

export interface ParaşütClientOptions {
  baseUrl?: string;
  fetchImpl?: typeof fetch;
  maxAttempts?: number;
  baseDelayMs?: number;
  pageSize?: number;
  maxPages?: number;
}

export const PARASUT_MIRROR_SCHEMA = "parasut";
export const PARASUT_INTEGRATION_SCHEMA = "parasut";

export type MirrorTable =
  | "contacts"
  | "products"
  | "sales_invoices"
  | "sales_invoice_details"
  | "purchase_bills"
  | "purchase_bill_details"
  | "payments"
  | "accounts"
  // Added 2026-07-23 alongside docs/migration-proposals/20260723103525_parasut_full_apidocs_schema_expansion.sql —
  // these tables already exist in the `parasut` schema (see that migration), this
  // just lets the TS engine reference them with the same type safety as the original 8.
  | "bank_fees"
  | "e_archives"
  | "e_invoice_inboxes"
  | "e_invoices"
  | "e_smms"
  | "employees"
  | "item_categories"
  | "inventory_levels"
  | "salaries"
  | "sales_offers"
  | "sales_offers_details"
  | "shipment_documents"
  | "stock_movements"
  | "stock_updates"
  | "stock_update_details"
  | "tags"
  | "taxes"
  | "trackable_jobs"
  | "transactions"
  | "warehouses";

export type IntegrationTable = "sync_runs" | "sync_errors";

export interface MirrorResourceDefinition {
  resourceType: string;
  table: MirrorTable;
}

export interface MirrorResourceRow {
  company_id: string;
  parasut_id: string;
  parasut_company_id: string;
  resource_type: string;
  attributes: JsonObject;
  relationships: JsonObject;
  included: JsonApiResource[];
  raw_payload: JsonApiResource;
  source_created_at: string | null;
  source_updated_at: string | null;
  source_archived: boolean | null;
  first_seen_at?: string;
  last_seen_at: string;
  synced_at: string;
  payload_hash: string;
}

export interface DatabaseResult<T = unknown> {
  data: T | null;
  error: { code?: string; message?: string; hint?: string } | null;
}

export interface QueryBuilder<T = unknown> extends PromiseLike<DatabaseResult<T>> {
  select(columns?: string): QueryBuilder<T>;
  eq(column: string, value: unknown): QueryBuilder<T>;
  maybeSingle(): Promise<DatabaseResult<T>>;
  single(): Promise<DatabaseResult<T>>;
}

export interface MirrorDatabase {
  schema(name: string): MirrorDatabase;
  from<T = unknown>(table: string): {
    insert(values: unknown): QueryBuilder<T>;
    update(values: unknown): QueryBuilder<T>;
    select(columns?: string): QueryBuilder<T>;
  };
}

export interface UpsertResult {
  outcome: "inserted" | "updated" | "unchanged";
  payloadHash: string;
}

export interface SyncCounters {
  pages: number;
  observed: number;
  inserted: number;
  updated: number;
  unchanged: number;
  errors: number;
}

export interface SyncContext {
  companyId: string;
  parasutCompanyId: string;
  database: MirrorDatabase;
  client: ParaşütClientContract;
  now?: () => Date;
  observability?: import("./sync-observability.ts").SyncObservabilitySink;
}

export interface SyncResourceOptions {
  resourceType: string;
  endpoint: string;
  table: MirrorTable;
  include?: string[];
  /**
   * Opt-in only — enables post-run deletion reconciliation (see
   * reconciliation.ts) for resources proven to be complete, direct-list
   * paginated snapshots. Leave unset/false for nested/derived/internal
   * resources (payments, *_details, sync_runs/sync_errors themselves) or
   * any resource not yet empirically confirmed as a full-snapshot endpoint —
   * see resource-registry.ts's `support` classification.
   */
  reconcile?: boolean;
}

export interface ReconciliationOutcome {
  /** How many previously-active mirror rows were marked source_archived = true this run. Never a DELETE. */
  archivedCount: number;
  /** Non-null only when reconciliation was intentionally skipped (see reconciliation.ts) — archivedCount is always 0 in that case. */
  skippedReason: string | null;
}

export interface SyncResult extends SyncCounters {
  runId: string;
  resourceType: string;
  status: "completed" | "partial" | "failed";
  /** Only present when `options.reconcile` was true for this run. */
  reconciliation?: ReconciliationOutcome;
}

export interface PaginatedPage {
  pageNumber: number;
  document: JsonApiDocument;
}

export interface ParaşütClientContract {
  getPaginated(path: string, include?: string[]): AsyncGenerator<PaginatedPage>;
}
