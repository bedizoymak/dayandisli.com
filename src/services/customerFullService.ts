import { supabase } from "@/integrations/supabase/client";
import {
  customerFullPartyToPayload,
  mapCustomerFullToParty,
  normalizeCustomerKey,
  partyToNaturalCustomerKey,
  type CustomerFullRow,
  type CustomerFullTableName,
} from "@/lib/customers/mapCustomerFullToParty";
import type { Party, PartyFilters } from "@/lib/finance/financeTypes";
import {
  checkPartiesTable,
  createParty,
  getParties,
  getPartyById,
  updateParty,
  type ServiceResult,
} from "./partiesService";
import { classifySupabaseError, getFriendlySupabaseError } from "./supabaseError";

const CUSTOMER_FULL_TABLES: CustomerFullTableName[] = ["customer_full", "customers_full"];

export type CustomerErpMode = "parties" | "parties_empty" | "legacy_readonly";

export type CustomersForErpResult = ServiceResult<Party[]> & {
  mode: CustomerErpMode;
  warning?: string | null;
  partiesAvailable: boolean;
  legacyAvailable: boolean;
};

export type CustomerFullRowsResult = ServiceResult<Party[]> & {
  tables: CustomerFullTableName[];
  tableErrors: string[];
};

export type CustomerFullSyncResult = {
  fetched: number;
  imported: number;
  updated: number;
  skipped: number;
  failed: number;
  legacyOnly: boolean;
  warning: string | null;
  customers: Party[];
  errors: string[];
};

function ok<T>(data: T): ServiceResult<T> {
  return { data, error: null };
}

function fail<T>(scope: string, error: unknown, fallback: T): ServiceResult<T> {
  if (import.meta.env.DEV) console.error(`[CustomerFull] ${scope}:`, error);
  const errorKind = classifySupabaseError(error);
  if (errorKind === "missing_table") {
    return {
      data: fallback,
      error: null,
      missingTable: true,
      errorKind,
    };
  }

  return {
    data: fallback,
    error: getFriendlySupabaseError(error),
    missingTable: errorKind === "missing_table",
    errorKind,
  };
}

function dedupeCustomers(rows: Party[]) {
  const seen = new Set<string>();
  return rows.filter((row) => {
    const key = partyToNaturalCustomerKey(row) || `${row.external_source}:${row.external_id}`;
    if (seen.has(key)) return false;
    seen.add(key);
    return true;
  });
}

async function readCustomerFullTable(table: CustomerFullTableName, limit = 5000) {
  const { data, error } = (await supabase.from(table as never).select("*").limit(limit)) as unknown as {
    data: CustomerFullRow[] | null;
    error: unknown;
  };

  if (error) {
    return {
      rows: [] as Party[],
      error,
      message: classifySupabaseError(error) === "missing_table" ? `${table} tablosu bulunamadı.` : `${table}: ${getFriendlySupabaseError(error)}`,
    };
  }

  return {
    rows: (data ?? []).map((row, index) => mapCustomerFullToParty(row, table, index)),
    error: null,
    message: null,
  };
}

export async function getCustomerFullRows(): Promise<CustomerFullRowsResult> {
  const tableResults = await Promise.all(CUSTOMER_FULL_TABLES.map((table) => readCustomerFullTable(table)));
  const rows = dedupeCustomers(tableResults.flatMap((result) => result.rows));
  const tableErrors = tableResults.map((result) => result.message).filter(Boolean) as string[];
  const readableTables = CUSTOMER_FULL_TABLES.filter((_, index) => !tableResults[index].error);
  const tables = readableTables;

  if (rows.length > 0 || readableTables.length > 0) {
    return { data: rows, error: null, tables, tableErrors };
  }

  const blockingError = tableResults.find((result) => result.error && classifySupabaseError(result.error) !== "missing_table")?.error;
  if (blockingError) {
    const result = fail("getCustomerFullRows", blockingError, []);
    return { ...result, tables, tableErrors };
  }

  return {
    data: [],
    error: null,
    missingTable: true,
    errorKind: "missing_table",
    tables,
    tableErrors,
  };
}

export async function getCustomerFullSample(): Promise<ServiceResult<Party | null>> {
  const rows = await getCustomerFullRows();
  if (rows.error && !rows.data.length) return { data: null, error: rows.error, missingTable: rows.missingTable, errorKind: rows.errorKind };
  return ok(rows.data[0] ?? null);
}

export function mapCustomerFullRow(row: CustomerFullRow, table: CustomerFullTableName = "customer_full") {
  return mapCustomerFullToParty(row, table);
}

async function partiesExternalColumnsAvailable() {
  const { error } = (await supabase.from("parties" as never).select("id, external_source, external_id").limit(1)) as unknown as {
    error: unknown;
  };

  if (!error) return true;
  if (classifySupabaseError(error) === "missing_table") return false;
  const text = getFriendlySupabaseError(error).toLowerCase();
  return !(text.includes("external_source") || text.includes("external_id") || text.includes("column"));
}

function findExistingParty(legacyParty: Party, existingParties: Party[], includeExternalColumns: boolean) {
  if (includeExternalColumns && legacyParty.external_source && legacyParty.external_id) {
    const externalMatch = existingParties.find(
      (party) => party.external_source === legacyParty.external_source && party.external_id === legacyParty.external_id,
    );
    if (externalMatch) return externalMatch;
  }

  const legacyTax = normalizeCustomerKey(legacyParty.tax_or_identity_no);
  const legacyEmail = normalizeCustomerKey(legacyParty.email);
  const legacyPhone = normalizeCustomerKey(legacyParty.phone);
  const legacyTitle = normalizeCustomerKey(legacyParty.title);

  return existingParties.find((party) => {
    const tax = normalizeCustomerKey(party.tax_or_identity_no);
    const email = normalizeCustomerKey(party.email);
    const phone = normalizeCustomerKey(party.phone);
    const title = normalizeCustomerKey(party.title);
    return Boolean((legacyTax && tax === legacyTax) || (legacyEmail && email === legacyEmail) || (legacyPhone && phone === legacyPhone) || (legacyTitle && title === legacyTitle));
  });
}

export async function syncCustomerFullToParties(): Promise<ServiceResult<CustomerFullSyncResult>> {
  const defaultResult: CustomerFullSyncResult = {
    fetched: 0,
    imported: 0,
    updated: 0,
    skipped: 0,
    failed: 0,
    legacyOnly: false,
    warning: null,
    customers: [],
    errors: [],
  };

  const legacyRows = await getCustomerFullRows();
  if (legacyRows.error && !legacyRows.data.length) {
    return { data: defaultResult, error: legacyRows.error, missingTable: legacyRows.missingTable, errorKind: legacyRows.errorKind };
  }

  const result: CustomerFullSyncResult = {
    ...defaultResult,
    fetched: legacyRows.data.length,
    customers: legacyRows.data,
    errors: [...legacyRows.tableErrors],
  };

  const partiesStatus = await checkPartiesTable();
  if (partiesStatus.missingTable) {
    return {
      data: {
        ...result,
        legacyOnly: true,
        warning: "ERP cari tabloları henüz uygulanmamış. Müşteriler geçici olarak customer_full tablosundan okunuyor.",
      },
      error: null,
      missingTable: true,
    };
  }

  if (partiesStatus.error) {
    return { data: result, error: partiesStatus.error, missingTable: partiesStatus.missingTable, errorKind: partiesStatus.errorKind };
  }

  const existing = await getParties({ type: "customer" });
  if (existing.error) {
    return { data: result, error: existing.error, missingTable: existing.missingTable, errorKind: existing.errorKind };
  }

  const includeExternalColumns = await partiesExternalColumnsAvailable();
  if (!includeExternalColumns) {
    result.warning = "customer_full senkron kolonları eksik. supabase/manual/customer_full_erp_sync.sql dosyasını çalıştırın; bu işlem doğal alanlarla eşleştirme yapar.";
  }

  const currentParties = [...existing.data];
  for (const legacyParty of legacyRows.data) {
    if (!legacyParty.title || legacyParty.title === "İsimsiz müşteri") {
      result.skipped += 1;
      continue;
    }

    const match = findExistingParty(legacyParty, currentParties, includeExternalColumns);
    const payload = customerFullPartyToPayload(legacyParty, includeExternalColumns);
    const writeResult = match ? await updateParty(match.id, payload) : await createParty(payload);

    if (writeResult.error || !writeResult.data) {
      result.failed += 1;
      result.errors.push(`${legacyParty.title}: ${writeResult.error || "Kayıt yazılamadı."}`);
      continue;
    }

    if (match) {
      result.updated += 1;
      const index = currentParties.findIndex((party) => party.id === match.id);
      if (index >= 0) currentParties[index] = writeResult.data;
    } else {
      result.imported += 1;
      currentParties.push(writeResult.data);
    }
  }

  result.customers = currentParties.filter((party) => party.party_type === "customer" || party.party_type === "both");

  return ok(result);
}

export async function getCustomersForErp(filters: PartyFilters = {}): Promise<CustomersForErpResult> {
  const partyResult = await getParties({ ...filters, type: "customer" });

  if (!partyResult.error) {
    if (partyResult.data.length > 0) {
      return {
        data: partyResult.data,
        error: null,
        mode: "parties",
        warning: null,
        partiesAvailable: true,
        legacyAvailable: false,
      };
    }

    const legacyRows = await getCustomerFullRows();
    return {
      data: [],
      error: null,
      mode: "parties_empty",
      warning: legacyRows.data.length ? "ERP müşteri listesi boş. customer_full tablosundan müşterileri getirebilirsiniz." : null,
      partiesAvailable: true,
      legacyAvailable: legacyRows.data.length > 0,
    };
  }

  if (!partyResult.missingTable) {
    return {
      data: [],
      error: partyResult.error,
      missingTable: partyResult.missingTable,
      errorKind: partyResult.errorKind,
      mode: "parties",
      warning: null,
      partiesAvailable: false,
      legacyAvailable: false,
    };
  }

  const legacyRows = await getCustomerFullRows();
  if (legacyRows.error && !legacyRows.data.length) {
    return {
      data: [],
      error: legacyRows.error,
      missingTable: legacyRows.missingTable,
      errorKind: legacyRows.errorKind,
      mode: "legacy_readonly",
      warning: null,
      partiesAvailable: false,
      legacyAvailable: false,
    };
  }

  return {
    data: legacyRows.data,
    error: null,
    missingTable: true,
    mode: "legacy_readonly",
    warning: "ERP cari tabloları henüz uygulanmamış. Müşteriler geçici olarak customer_full tablosundan okunuyor.",
    partiesAvailable: false,
    legacyAvailable: legacyRows.data.length > 0,
  };
}

export async function getCustomerForErpById(id: string): Promise<ServiceResult<Party | null>> {
  if (id.startsWith("legacy-")) {
    const legacyRows = await getCustomerFullRows();
    if (legacyRows.error && !legacyRows.data.length) return { data: null, error: legacyRows.error, missingTable: legacyRows.missingTable, errorKind: legacyRows.errorKind };
    return ok(legacyRows.data.find((party) => party.id === id) ?? null);
  }

  const party = await getPartyById(id);
  if (party.data || !party.missingTable) return party;

  const legacyRows = await getCustomerFullRows();
  if (legacyRows.error && !legacyRows.data.length) return { data: null, error: legacyRows.error, missingTable: legacyRows.missingTable, errorKind: legacyRows.errorKind };
  return ok(legacyRows.data.find((row) => row.id === id) ?? null);
}
