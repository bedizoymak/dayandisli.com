import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/erp/DataTable";
import { useParasutInvoiceLikeDetail } from "../api/queries";
import { formatParasutCurrency, formatParasutDate, formatParasutDateTime } from "../utils/format";
import { InvoiceStatusBadge } from "../components/invoiceStatus";
import { ParasutEmptyState, ParasutErrorState, ParasutLoadingState } from "../components/ParasutStateViews";
import type { InvoiceDetailAttributes, MirrorRowBase, PaymentAttributes } from "../types";

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-erp-muted">{label}</p>
      <p className="mt-0.5 text-sm text-erp-text">{value}</p>
    </div>
  );
}

export function InvoiceLikeDetailPage({
  resource,
  title,
  partyLabel,
  listRoute,
}: {
  resource: "sales_invoices" | "purchase_bills";
  title: string;
  partyLabel: string;
  listRoute: string;
}) {
  const { parasutId } = useParams<{ parasutId: string }>();
  const { data, isLoading, isError, error, refetch } = useParasutInvoiceLikeDetail(resource, parasutId);

  const detailColumns: DataTableColumn<MirrorRowBase & { attributes: InvoiceDetailAttributes; productName: string | null }>[] = [
    { key: "product", header: "Ürün/Hizmet", render: (row) => row.productName ?? "—" },
    { key: "description", header: "Açıklama", render: (row) => row.attributes.description ?? "—" },
    { key: "quantity", header: "Miktar", className: "text-right", render: (row) => row.attributes.quantity ?? "—" },
    { key: "unit_price", header: "Birim Fiyat", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.unit_price, data?.header.attributes.currency) },
    { key: "discount", header: "İndirim", className: "text-right", render: (row) => (row.attributes.discount ? formatParasutCurrency(row.attributes.discount, data?.header.attributes.currency) : "—") },
    { key: "vat_rate", header: "KDV Oranı", className: "text-right", render: (row) => (row.attributes.vat_rate ? `%${row.attributes.vat_rate}` : "—") },
    { key: "vat", header: "KDV Tutarı", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.vat, data?.header.attributes.currency) },
    { key: "net_total", header: "Satır Toplamı", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.net_total, data?.header.attributes.currency) },
  ];

  const paymentColumns: DataTableColumn<MirrorRowBase & { attributes: PaymentAttributes }>[] = [
    { key: "date", header: "Tarih", render: (row) => formatParasutDate(row.attributes.date) },
    { key: "amount", header: "Tutar", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.amount, row.attributes.currency) },
    { key: "notes", header: "Açıklama", render: (row) => row.attributes.notes ?? "—" },
    { key: "parasut_id", header: "Paraşüt ID", className: "font-mono text-xs", render: (row) => row.parasut_id },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description="Paraşüt aynasından okunan salt-okunur belge detayı."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to={listRoute}>
              <ArrowLeft className="mr-2 h-4 w-4" /> Listeye Dön
            </Link>
          </Button>
        }
      />

      {isLoading ? (
        <ParasutLoadingState />
      ) : isError || !data ? (
        <ParasutErrorState message={error instanceof Error ? error.message : "Belge bulunamadı."} onRetry={() => void refetch()} />
      ) : (
        <>
          <Card className="erp-surface">
            <CardHeader className="flex flex-row flex-wrap items-center justify-between gap-3">
              <CardTitle className="text-lg">{data.header.attributes.invoice_no ?? data.header.parasut_id}</CardTitle>
              <InvoiceStatusBadge attributes={data.header.attributes} />
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField label={partyLabel} value={data.contact?.attributes.name ?? "—"} />
              <DetailField label={resource === "sales_invoices" ? "Fatura Tarihi" : "Belge Tarihi"} value={formatParasutDate(data.header.attributes.issue_date)} />
              <DetailField label="Vade Tarihi" value={formatParasutDate(data.header.attributes.due_date)} />
              <DetailField label="Para Birimi" value={data.header.attributes.currency ?? "—"} />
              <DetailField label="Ara Toplam" value={formatParasutCurrency(data.header.attributes.net_total, data.header.attributes.currency)} />
              <DetailField label="Vergi Toplamı" value={formatParasutCurrency(data.header.attributes.total_vat, data.header.attributes.currency)} />
              <DetailField label="Genel Toplam" value={formatParasutCurrency(data.header.attributes.gross_total, data.header.attributes.currency)} />
              <DetailField label="Kalan" value={formatParasutCurrency(data.header.attributes.remaining, data.header.attributes.currency)} />
              <DetailField label="Açıklama" value={data.header.attributes.description || "—"} />
              <DetailField label="Paraşüt ID" value={<span className="font-mono text-xs">{data.header.parasut_id}</span>} />
              <DetailField label="Son Senkronizasyon" value={formatParasutDateTime(data.header.synced_at)} />
              <DetailField label="Kaynak Son Güncelleme" value={formatParasutDateTime(data.header.source_updated_at)} />
            </CardContent>
          </Card>

          <Card className="erp-surface">
            <CardHeader>
              <CardTitle className="text-base">Kalemler</CardTitle>
            </CardHeader>
            <CardContent>
              {data.details.length === 0 ? (
                <ParasutEmptyState description="Bu belgeye ait kalem verisi senkronize edilmemiş." />
              ) : (
                <DataTable columns={detailColumns} data={data.details} rowKey={(row) => row.parasut_id} />
              )}
            </CardContent>
          </Card>

          <Card className="erp-surface">
            <CardHeader>
              <CardTitle className="text-base">Ödemeler</CardTitle>
            </CardHeader>
            <CardContent>
              {data.payments.length === 0 ? (
                <ParasutEmptyState description="Bu belgeye ait ödeme/tahsilat kaydı senkronize edilmemiş." />
              ) : (
                <DataTable columns={paymentColumns} data={data.payments} rowKey={(row) => row.parasut_id} />
              )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
