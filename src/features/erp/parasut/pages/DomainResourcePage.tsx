import type { DataTableColumn } from "@/components/erp/DataTable";
import { Badge } from "@/components/ui/badge";
import { ParasutListPage } from "../components/ParasutListPage";
import { formatParasutCurrency, formatParasutDate, formatParasutDateTime } from "../utils/format";
import type { GenericParasutRow, ParasutListResource } from "../types";

type FieldKind = "text" | "date" | "datetime" | "money" | "status" | "boolean";
type Field = { key: string; label: string; kind?: FieldKind; currencyKey?: string };
type Config = { title: string; description: string; resource: ParasutListResource; fields: Field[]; search: string };

export const domainResourcePages = {
  "satislar/teklifler": { title: "Satış Teklifleri", description: "Paraşüt satış teklifleri.", resource: "sales_offers", search: "Teklif açıklaması veya durum ara...", fields: [{ key: "content", label: "Teklif" }, { key: "status", label: "Durum", kind: "status" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "gross_total", label: "Toplam", kind: "money", currencyKey: "currency" }, { key: "currency", label: "Para Birimi" }] },
  "finans/giderler": { title: "Gider Listesi", description: "Paraşüt banka masrafları ve gider kayıtları.", resource: "bank_fees", search: "Gider açıklaması ara...", fields: [{ key: "description", label: "Açıklama" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "net_total", label: "Net", kind: "money", currencyKey: "currency" }, { key: "remaining", label: "Kalan", kind: "money", currencyKey: "currency" }] },
  "finans/vergiler": { title: "Vergiler", description: "Paraşüt vergi kayıtları.", resource: "taxes", search: "Vergi açıklaması ara...", fields: [{ key: "description", label: "Açıklama" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "due_date", label: "Vade", kind: "date" }, { key: "net_total", label: "Tutar", kind: "money" }] },
  "finans/hareketler": { title: "Finans Hareketleri", description: "Paraşüt hesap hareketleri.", resource: "transactions", search: "Açıklama veya hareket türü ara...", fields: [{ key: "description", label: "Açıklama" }, { key: "transaction_type", label: "Tür" }, { key: "date", label: "Tarih", kind: "date" }, { key: "amount_in_trl", label: "TL Tutar", kind: "money" }] },
  "stok/mevcut": { title: "Mevcut Stok", description: "Depo ve ürün bazında Paraşüt stok seviyeleri.", resource: "inventory_levels", search: "Ürün veya depo Paraşüt kimliği ara...", fields: [{ key: "product_parasut_id", label: "Ürün Paraşüt ID" }, { key: "warehouse_parasut_id", label: "Depo Paraşüt ID" }, { key: "stock_count", label: "Mevcut" }, { key: "critical_stock_count", label: "Kritik Seviye" }] },
  "stok/hareketler": { title: "Stok Geçmişi", description: "Paraşüt stok hareketleri.", resource: "stock_movements", search: "Ürün veya depo Paraşüt kimliği ara...", fields: [{ key: "product_parasut_id", label: "Ürün Paraşüt ID" }, { key: "warehouse_parasut_id", label: "Depo Paraşüt ID" }, { key: "date", label: "Tarih", kind: "date" }, { key: "quantity", label: "Miktar" }] },
  "stok/guncellemeler": { title: "Stok Güncellemeleri", description: "Paraşüt stok güncelleme kayıtları.", resource: "stock_updates", search: "Paraşüt kimliği ara...", fields: [] },
  "stok/irsaliyeler": { title: "İrsaliyeler", description: "Paraşüt sevk ve irsaliye belgeleri.", resource: "shipment_documents", search: "Belge no, açıklama veya şehir ara...", fields: [{ key: "invoice_no", label: "Belge No" }, { key: "description", label: "Açıklama" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "shipment_date", label: "Sevk", kind: "datetime" }, { key: "inflow", label: "Yön", kind: "boolean" }] },
  "stok/kategoriler": { title: "Ürün Kategorileri", description: "Paraşüt ürün ve hizmet kategorileri.", resource: "item_categories", search: "Kategori adı veya yolu ara...", fields: [{ key: "name", label: "Ad" }, { key: "full_path", label: "Tam Yol" }, { key: "category_type", label: "Tür" }] },
  "ik/calisanlar": { title: "Çalışanlar", description: "Paraşüt çalışan kayıtları.", resource: "employees", search: "Ad, e-posta veya IBAN ara...", fields: [{ key: "name", label: "Ad" }, { key: "email", label: "E-posta" }, { key: "iban", label: "IBAN" }, { key: "trl_balance", label: "TL Bakiye", kind: "money" }] },
  "ik/maaslar": { title: "Maaşlar", description: "Paraşüt maaş ve ödeme durumları.", resource: "salaries", search: "Açıklama veya çalışan Paraşüt kimliği ara...", fields: [{ key: "description", label: "Açıklama" }, { key: "employee_parasut_id", label: "Çalışan Paraşüt ID" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "net_total", label: "Net", kind: "money", currencyKey: "currency" }, { key: "remaining", label: "Kalan", kind: "money", currencyKey: "currency" }] },
  "e-belgeler/e-faturalar": { title: "E-Faturalar", description: "Paraşüt gelen ve giden e-fatura kayıtları.", resource: "e_invoices", search: "Belge, cari veya VKN ara...", fields: [{ key: "external_id", label: "Belge No" }, { key: "contact_name", label: "Cari" }, { key: "direction", label: "Yön" }, { key: "status", label: "Durum", kind: "status" }, { key: "issue_date", label: "Tarih", kind: "date" }, { key: "net_total", label: "Net", kind: "money", currencyKey: "currency" }] },
  "e-belgeler/gelen-kutulari": { title: "E-Fatura Gelen Kutuları", description: "Kayıtlı e-fatura adresleri.", resource: "e_invoice_inboxes", search: "VKN, ad veya adres ara...", fields: [{ key: "name", label: "Ad" }, { key: "vkn", label: "VKN" }, { key: "e_invoice_address", label: "E-Fatura Adresi" }, { key: "inbox_type", label: "Tür" }, { key: "registered_at", label: "Kayıt", kind: "datetime" }] },
  "e-belgeler/e-arsivler": { title: "E-Arşivler", description: "Paraşüt e-arşiv kayıtları.", resource: "e_archives", search: "Fatura no, VKN veya not ara...", fields: [{ key: "invoice_number", label: "Fatura No" }, { key: "vkn", label: "VKN" }, { key: "status", label: "Durum", kind: "status" }, { key: "printed_at", label: "Yazdırma", kind: "datetime" }, { key: "is_signed", label: "İmzalı", kind: "boolean" }] },
  "e-belgeler/e-smm": { title: "E-SMM", description: "Paraşüt e-serbest meslek makbuzları.", resource: "e_smms", search: "VKN ara...", fields: [{ key: "invoice_number", label: "Belge No" }, { key: "vkn", label: "VKN" }, { key: "printed_at", label: "Tarih", kind: "date" }, { key: "is_printed", label: "Yazdırıldı", kind: "boolean" }] },
  "sistem/isler": { title: "Takip Edilebilir İşler", description: "Paraşüt uzun süren işlerin durumları.", resource: "trackable_jobs", search: "Durum ara...", fields: [{ key: "status", label: "Durum", kind: "status" }] },
} satisfies Record<string, Config>;

function renderValue(row: GenericParasutRow, field: Field) {
  const value = row.attributes[field.key];
  if (field.kind === "date") return formatParasutDate(value as string | null);
  if (field.kind === "datetime") return formatParasutDateTime(value as string | null);
  if (field.kind === "money") return formatParasutCurrency(value as string | number | null, field.currencyKey ? String(row.attributes[field.currencyKey] ?? "") : "TRL");
  if (field.kind === "boolean") return value === true ? "Evet" : value === false ? "Hayır" : "—";
  if (field.kind === "status") return <Badge variant="outline">{String(value ?? "—")}</Badge>;
  return String(value ?? "—");
}

export function DomainResourcePage({ config }: { config: Config }) {
  const columns: DataTableColumn<GenericParasutRow>[] = [
    ...(config.fields.length ? config.fields : [{ key: "parasut_id", label: "Paraşüt ID" }]).map((field) => ({
      key: field.key,
      header: field.label,
      render: (row: GenericParasutRow) => field.key === "parasut_id" ? row.parasut_id : renderValue(row, field),
    })),
    { key: "parasut-id", header: "Paraşüt ID", className: "font-mono text-xs", render: (row) => row.parasut_id },
    { key: "updated", header: "Son Güncelleme", render: (row) => formatParasutDateTime(row.last_seen_at) },
  ];
  return <ParasutListPage title={config.title} description={config.description} resource={config.resource} columns={columns} searchPlaceholder={config.search} emptyDescription="Senkronize edilmiş kayıt bulunmuyor." filters={{ archived: false }} rowKey={(row) => row.id} />;
}
