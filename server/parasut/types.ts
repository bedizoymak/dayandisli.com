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

export type MirrorTable =
  | "parasut_contacts"
  | "parasut_products"
  | "parasut_sales_invoices"
  | "parasut_sales_invoice_details"
  | "parasut_purchase_bills"
  | "parasut_purchase_bill_details"
  | "parasut_payments"
  | "parasut_accounts";

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
}

export interface SyncResult extends SyncCounters {
  runId: string;
  resourceType: string;
  status: "completed" | "partial" | "failed";
}

export interface PaginatedPage {
  pageNumber: number;
  document: JsonApiDocument;
}

export interface ParaşütClientContract {
  getPaginated(path: string, include?: string[]): AsyncGenerator<PaginatedPage>;
}
