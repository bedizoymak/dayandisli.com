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
  | "transaction_history_items"
  | "opening_balances"
  | "warehouses"
  // Added 2026-08-11 alongside supabase/migrations/20260811000000_parasut_checks_mirror.sql
  // — foundation-style table (attributes/relationships/included), not the
  // 20260723 typed-only shape. See that migration's header comment.
  | "checks";

export type IntegrationTable = "sync_runs" | "sync_errors";

export interface MirrorResourceDefinition {
  resourceType: string;
  table: MirrorTable;
  /**
   * Attribute keys that also have a real typed `numeric` column on `table`
   * (in addition to living inside the `attributes` jsonb blob), so that
   * ordering/sorting can read a proper numeric column instead of a text
   * cast of jsonb. See upsert-resource.ts's numeric-column mirroring and
   * the trl_balance/gross_total backfill migrations. Leave unset for
   * resources with no such typed column.
   */
  numericAttributeFields?: string[];
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
  gt(column: string, value: unknown): QueryBuilder<T>;
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
  /**
   * Recorded verbatim into sync_runs.trigger_type. Defaults to
   * "local_manual" (sync-base.ts's createRun) when omitted, preserving
   * every existing caller's behavior unchanged. The scheduled pg_cron
   * invocation (supabase/functions/parasut-sync-run/index.ts) is the only
   * caller that sets this — to "scheduled" — so sync_runs rows are
   * distinguishable by how they were triggered without inventing a new
   * observability system.
   */
  triggerType?: string;
}

export interface SyncResourceOptions {
  resourceType: string;
  endpoint: string;
  table: MirrorTable;
  include?: string[];
  /** Forwarded to upsertResource's MirrorResourceDefinition — see its docstring. */
  numericAttributeFields?: string[];
  /**
   * Opt-in only — enables post-run deletion reconciliation (see
   * reconciliation.ts) for resources proven to be complete, direct-list
   * paginated snapshots. Leave unset/false for nested/derived/internal
   * resources (payments, *_details, sync_runs/sync_errors themselves) or
   * any resource not yet empirically confirmed as a full-snapshot endpoint —
   * see resource-registry.ts's `support` classification.
   */
  reconcile?: boolean;
  /**
   * Opt-in only — enforces single-runner mutual exclusion for this exact
   * (company, resource_type) via the election performed right after this
   * run's own sync_runs row is inserted (see sync-base.ts's
   * enforceSingleRunner). Without a unique-constraint/advisory-lock at the
   * database level (this project's "no schema/migration changes" constraint
   * forbids adding one), a plain check-then-insert has an unavoidable
   * TOCTOU race; this election is race-free instead because it runs AFTER
   * both competing rows are guaranteed to exist, and picks a single
   * deterministic winner (earliest started_at, id as tiebreaker) from
   * whatever is actually in the table at that moment — every loser reliably
   * detects it lost, and the winner is unambiguous even under true
   * concurrent inserts. Set true only for the manual "Sync" button path
   * (server/parasut/sync-*.ts's optional second argument) — leave unset for
   * every other caller (e.g. the customer-creation flow's contacts-only
   * sync) to avoid a manual resync and an unrelated automatic sync
   * needlessly contending with each other.
   */
  concurrencyLock?: boolean;
  /**
   * Bounded page budget for a single Edge Function invocation — the fix for
   * large include-expanded resources (sales_invoices, purchase_bills) being
   * killed mid-run by the platform's execution timeout before a single page
   * could be checkpointed. Leave unset for unbounded (existing behavior,
   * used by tests and by resources proven fast/small, e.g. contacts).
   * When set, syncCollection stops after this many pages *in this
   * invocation* (not cumulatively across resumes), persists the checkpoint,
   * and returns status "partial" with hasMore true instead of continuing.
   */
  maxPagesPerInvocation?: number;
}

/** Thrown by syncCollection when concurrencyLock is enabled and this run lost the single-runner election. */
export class SyncAlreadyRunningError extends Error {
  constructor(message = "Bir senkronizasyon zaten devam ediyor.") {
    super(message);
    this.name = "SyncAlreadyRunningError";
  }
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
  /** True when maxPagesPerInvocation stopped the run before the resource was fully traversed — the caller must invoke again to continue. Never true for "failed". */
  hasMore: boolean;
  /** True when this invocation resumed from a prior partial/failed run's checkpoint rather than starting at page 1. */
  resumed: boolean;
  /** Pages fetched by this invocation only (not cumulative across resumes). */
  pagesThisInvocation: number;
  /** Pages fetched across this run and every prior invocation it resumed from, best-effort (0 if unknown). */
  totalPagesProcessed: number;
}

export interface PaginatedPage {
  pageNumber: number;
  document: JsonApiDocument;
}

export interface ParaşütClientContract {
  getPaginated(path: string, include?: string[], startPage?: number): AsyncGenerator<PaginatedPage>;
}
