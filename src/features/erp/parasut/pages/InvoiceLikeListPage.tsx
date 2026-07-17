import { useNavigate } from "react-router-dom";
import type { DataTableColumn } from "@/components/erp/DataTable";
import { ParasutListPage } from "../components/ParasutListPage";
import { InvoiceStatusBadge } from "../components/invoiceStatus";
import { formatParasutCurrency, formatParasutDate, formatParasutDateTime } from "../utils/format";
import type { InvoiceListRow } from "../types";

export function InvoiceLikeListPage({
  resource,
  title,
  description,
  partyLabel,
  detailBasePath,
}: {
  resource: "sales_invoices" | "purchase_bills";
  title: string;
  description: string;
  partyLabel: string;
  detailBasePath: string;
}) {
  const navigate = useNavigate();

  const columns: DataTableColumn<InvoiceListRow>[] = [
    { key: "no", header: resource === "sales_invoices" ? "Fatura No" : "Belge/Fatura No", render: (row) => row.attributes.invoice_no ?? "—" },
    { key: "party", header: partyLabel, render: (row) => row.partyName ?? "—" },
    { key: "issue", header: resource === "sales_invoices" ? "Fatura Tarihi" : "Belge Tarihi", render: (row) => formatParasutDate(row.attributes.issue_date) },
    { key: "due", header: "Vade Tarihi", render: (row) => formatParasutDate(row.attributes.due_date) },
    { key: "status", header: "Durum", render: (row) => <InvoiceStatusBadge attributes={row.attributes} /> },
    { key: "net", header: "Ara Toplam", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.net_total, row.attributes.currency) },
    { key: "vat", header: "Vergi", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.total_vat, row.attributes.currency) },
    { key: "gross", header: "Genel Toplam", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.gross_total, row.attributes.currency) },
    { key: "paid", header: resource === "sales_invoices" ? "Tahsil Edilen" : "Ödenen", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.total_paid, row.attributes.currency) },
    { key: "remaining", header: "Kalan", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.remaining, row.attributes.currency) },
    { key: "currency", header: "Para Birimi", render: (row) => row.attributes.currency ?? "—" },
    { key: "parasut_id", header: "Paraşüt ID", className: "font-mono text-xs", render: (row) => row.parasut_id },
    { key: "updated", header: "Son Güncelleme", render: (row) => formatParasutDateTime(row.last_seen_at) },
  ];

  return (
    <ParasutListPage
      title={title}
      description={description}
      resource={resource}
      columns={columns}
      searchPlaceholder="Belge no veya açıklama ara..."
      emptyDescription={`Senkronize edilmiş ${resource === "sales_invoices" ? "satış faturası" : "alış faturası"} bulunmuyor. Senkronizasyon çalıştırıldıktan sonra burada listelenecektir.`}
      rowKey={(row) => row.parasut_id}
      onRowClick={(row) => navigate(`${detailBasePath}/${row.parasut_id}`)}
    />
  );
}
