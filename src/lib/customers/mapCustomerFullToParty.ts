import type { Party } from "@/lib/finance/financeTypes";
import type { PartyPayload } from "@/services/partiesService";

export type CustomerFullTableName = "customer_full" | "customers_full";
export type CustomerFullRow = Record<string, unknown>;

function textValue(row: CustomerFullRow, keys: string[]) {
  for (const key of keys) {
    const value = row[key];
    if (value !== null && value !== undefined && String(value).trim()) return String(value).trim();
  }
  return null;
}

function numberValue(row: CustomerFullRow, keys: string[]) {
  const value = textValue(row, keys);
  const parsed = Number(value);
  return Number.isFinite(parsed) ? parsed : 0;
}

function dateValue(row: CustomerFullRow, keys: string[]) {
  const value = textValue(row, keys);
  if (!value) return new Date().toISOString();
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? new Date().toISOString() : date.toISOString();
}

function safeId(value: string) {
  return value.replace(/[^a-zA-Z0-9_-]/g, "-").slice(0, 120);
}

export function normalizeCustomerKey(value?: string | null) {
  return (value || "").toLocaleLowerCase("tr-TR").replace(/\s+/g, " ").trim();
}

export function getCustomerFullExternalId(row: CustomerFullRow, table: CustomerFullTableName, index = 0) {
  const rawId = textValue(row, ["id", "uuid", "customer_id", "slug", "short_name"]);
  return rawId || `${table}-${index}`;
}

export function mapCustomerFullToParty(row: CustomerFullRow, table: CustomerFullTableName = "customer_full", index = 0): Party {
  const externalId = getCustomerFullExternalId(row, table, index);
  const title =
    textValue(row, [
      "company_name",
      "firma_unvani",
      "firma_ünvanı",
      "firma",
      "title",
      "name",
      "short_name",
      "customer_name",
    ]) || "İsimsiz müşteri";

  const createdAt = dateValue(row, ["created_at", "created"]);
  const updatedAt = dateValue(row, ["updated_at", "modified_at", "created_at"]);

  return {
    id: `legacy-${table}-${safeId(externalId)}`,
    party_type: "customer",
    entity_type: "company",
    title,
    contact_name: textValue(row, ["contact_name", "ilgili_kisi", "ilgili_kişi", "yetkili", "authorized_person", "person"]),
    tax_or_identity_no: textValue(row, ["tax_or_identity_no", "tc_vkn", "tax_no", "vergi_no", "vkn", "tc", "tckn", "tax_number"]),
    tax_office: textValue(row, ["tax_office", "vergi_dairesi"]),
    phone: textValue(row, ["phone", "telefon", "tel", "gsm", "mobile"]),
    email: textValue(row, ["email", "e_posta", "mail"]),
    website: textValue(row, ["website", "web_site", "site"]),
    address: textValue(row, ["address", "adres", "full_address"]),
    city: textValue(row, ["city", "sehir", "şehir", "il"]),
    district: textValue(row, ["district", "ilce", "ilçe"]),
    default_account_type: "official",
    currency: textValue(row, ["currency", "para_birimi"]) || "TRY",
    payment_term_days: numberValue(row, ["payment_term_days", "vade_gunu"]),
    risk_limit: numberValue(row, ["risk_limit"]),
    category: textValue(row, ["category", "kategori"]),
    tags: ["customer_full"],
    notes: textValue(row, ["notes", "notlar", "description"]),
    is_active: true,
    created_at: createdAt,
    updated_at: updatedAt,
    created_by: null,
    external_source: table,
    external_id: externalId,
    source_label: table,
    is_legacy_readonly: true,
  };
}

export function partyToNaturalCustomerKey(party: Pick<Party, "title" | "tax_or_identity_no" | "phone" | "email">) {
  const tax = normalizeCustomerKey(party.tax_or_identity_no);
  const email = normalizeCustomerKey(party.email);
  const phone = normalizeCustomerKey(party.phone);
  const title = normalizeCustomerKey(party.title);
  return tax || email || phone || title;
}

export function customerFullPartyToPayload(party: Party, includeExternalColumns: boolean): PartyPayload {
  return {
    party_type: "customer",
    entity_type: party.entity_type || "company",
    title: party.title,
    contact_name: party.contact_name,
    tax_or_identity_no: party.tax_or_identity_no,
    tax_office: party.tax_office,
    phone: party.phone,
    email: party.email,
    website: party.website,
    address: party.address,
    city: party.city,
    district: party.district,
    default_account_type: party.default_account_type || "official",
    currency: party.currency || "TRY",
    payment_term_days: party.payment_term_days || 0,
    risk_limit: party.risk_limit || 0,
    category: party.category,
    tags: party.tags || ["customer_full"],
    notes: party.notes,
    is_active: true,
    ...(includeExternalColumns ? { external_source: party.external_source, external_id: party.external_id } : {}),
  };
}
