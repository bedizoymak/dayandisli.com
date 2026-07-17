import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/PageHeader";
import { DataTable, type DataTableColumn } from "@/components/erp/DataTable";
import { useParasutContactDetail } from "../api/queries";
import { formatParasutCurrency, formatParasutDate, formatParasutDateTime } from "../utils/format";
import { InvoiceStatusBadge } from "../components/invoiceStatus";
import { ParasutErrorState, ParasutLoadingState } from "../components/ParasutStateViews";
import type { InvoiceLikeAttributes, MirrorRowBase } from "../types";

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-erp-muted">{label}</p>
      <p className="mt-0.5 text-sm text-erp-text">{value}</p>
    </div>
  );
}

export function ContactDetailPage({ resource, title, listRoute, documentBasePath }: { resource: "customers" | "suppliers"; title: string; listRoute: string; documentBasePath: string }) {
  const { parasutId } = useParams<{ parasutId: string }>();
  const { data, isLoading, isError, error, refetch } = useParasutContactDetail(resource, parasutId);

  const documentColumns: DataTableColumn<MirrorRowBase & { attributes: InvoiceLikeAttributes }>[] = [
    { key: "no", header: "Belge No", render: (row) => row.attributes.invoice_no ?? "—" },
    { key: "date", header: "Tarih", render: (row) => formatParasutDate(row.attributes.issue_date) },
    { key: "status", header: "Durum", render: (row) => <InvoiceStatusBadge attributes={row.attributes} /> },
    { key: "remaining", header: "Kalan", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.remaining, row.attributes.currency) },
  ];

  return (
    <div className="space-y-6">
      <PageHeader
        title={title}
        description="Paraşüt aynasından okunan salt-okunur cari kartı."
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
        <ParasutErrorState message={error instanceof Error ? error.message : "Kayıt bulunamadı."} onRetry={() => void refetch()} />
      ) : (
        <>
          <Card className="erp-surface">
            <CardHeader>
              <CardTitle className="text-lg">{data.contact.attributes.name ?? data.contact.parasut_id}</CardTitle>
            </CardHeader>
            <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
              <DetailField label="Tür" value={data.contact.attributes.contact_type === "company" ? "Firma" : data.contact.attributes.contact_type === "person" ? "Şahıs" : data.contact.attributes.contact_type ?? "—"} />
              <DetailField label="Vergi Dairesi" value={data.contact.attributes.tax_office ?? "—"} />
              <DetailField label="Vergi Numarası" value={data.contact.attributes.tax_number ?? "—"} />
              <DetailField label="E-posta" value={data.contact.attributes.email ?? "—"} />
              <DetailField label="Telefon" value={data.contact.attributes.phone ?? "—"} />
              <DetailField label="Adres" value={[data.contact.attributes.address, data.contact.attributes.district, data.contact.attributes.city].filter(Boolean).join(", ") || "—"} />
              <DetailField label="Bakiye (TL)" value={formatParasutCurrency(data.contact.attributes.trl_balance, "TRY")} />
              <DetailField label="Vade (Gün)" value={data.contact.attributes.term_days ?? "—"} />
              <DetailField label="Paraşüt ID" value={<span className="font-mono text-xs">{data.contact.parasut_id}</span>} />
              <DetailField label="Son Senkronizasyon" value={formatParasutDateTime(data.contact.synced_at)} />
            </CardContent>
          </Card>

          <Card className="erp-surface">
            <CardHeader>
              <CardTitle className="text-base">Son Belgeler</CardTitle>
            </CardHeader>
            <CardContent>
              {data.recentDocuments.length === 0 ? (
                <p className="text-sm text-muted-foreground">Bu cariye bağlı senkronize belge bulunmuyor.</p>
              ) : (
                <DataTable
                  columns={documentColumns}
                  data={data.recentDocuments}
                  rowKey={(row) => row.parasut_id}
                  emptyMessage="Belge yok"
                />
              )}
              <p className="mt-3 text-xs text-erp-muted">
                <Link to={documentBasePath} className="text-primary hover:underline">
                  Tüm belgeleri listede görüntüle
                </Link>
              </p>
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
