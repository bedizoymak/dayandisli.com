import type { DataTableColumn } from "@/components/erp/DataTable";
import { ParasutListPage } from "../components/ParasutListPage";
import { formatParasutCurrency, formatParasutDate } from "../utils/format";
import type { PaymentListRow } from "../types";

export function PaymentsListPage({ kind, title, description }: { kind: "collection" | "payment"; title: string; description: string }) {
  const columns: DataTableColumn<PaymentListRow>[] = [
    { key: "date", header: "Tarih", render: (row) => formatParasutDate(row.attributes.date) },
    { key: "kind", header: "Tür", render: () => (kind === "collection" ? "Tahsilat" : "Ödeme") },
    { key: "document", header: "İlgili Belge", render: (row) => row.documentNo ?? "—" },
    { key: "party", header: kind === "collection" ? "Müşteri" : "Tedarikçi", render: (row) => row.partyName ?? "—" },
    { key: "account", header: "Hesap", render: () => "—" },
    { key: "amount", header: "Tutar", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.amount, row.attributes.currency) },
    { key: "currency", header: "Para Birimi", render: (row) => row.attributes.currency ?? "—" },
    { key: "notes", header: "Açıklama", render: (row) => row.attributes.notes ?? "—" },
    { key: "parasut_id", header: "Paraşüt ID", className: "font-mono text-xs", render: (row) => row.parasut_id },
  ];

  return (
    <ParasutListPage
      title={title}
      description={description}
      resource="payments"
      columns={columns}
      filters={{ kind }}
      searchPlaceholder="Belge numarasına göre ara..."
      emptyDescription={`Senkronize edilmiş ${kind === "collection" ? "tahsilat" : "ödeme"} kaydı bulunmuyor.`}
      rowKey={(row) => row.parasut_id}
    />
  );
}
