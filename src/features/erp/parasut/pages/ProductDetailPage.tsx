import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/PageHeader";
import { useParasutSimpleDetail } from "../api/queries";
import { formatParasutCurrency, formatParasutDateTime } from "../utils/format";
import { ParasutErrorState, ParasutLoadingState } from "../components/ParasutStateViews";
import type { ProductAttributes } from "../types";

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-erp-muted">{label}</p>
      <p className="mt-0.5 text-sm text-erp-text">{value}</p>
    </div>
  );
}

export default function ProductDetailPage() {
  const { parasutId } = useParams<{ parasutId: string }>();
  const { data, isLoading, isError, error, refetch } = useParasutSimpleDetail<ProductAttributes>("products", parasutId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Ürün / Hizmet Detayı"
        description="Paraşüt aynasından okunan salt-okunur ürün kartı."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/apps/parasut/urunler">
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
        <Card className="erp-surface">
          <CardHeader>
            <CardTitle className="text-lg">{data.record.attributes.name ?? data.record.parasut_id}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 sm:grid-cols-2 lg:grid-cols-4">
            <DetailField label="Kod" value={data.record.attributes.code ?? "—"} />
            <DetailField label="Birim" value={data.record.attributes.unit ?? "—"} />
            <DetailField label="Satış Fiyatı" value={formatParasutCurrency(data.record.attributes.list_price, data.record.attributes.currency)} />
            <DetailField label="Alış Fiyatı" value={formatParasutCurrency(data.record.attributes.buying_price, data.record.attributes.buying_currency)} />
            <DetailField label="KDV Oranı" value={data.record.attributes.vat_rate ? `%${data.record.attributes.vat_rate}` : "—"} />
            <DetailField label="Barkod" value={data.record.attributes.barcode ?? "—"} />
            <DetailField label="Stok Adedi" value={data.record.attributes.inventory_tracking ? data.record.attributes.stock_count ?? "—" : "Stoksuz"} />
            <DetailField label="Aktiflik" value={data.record.attributes.archived ? "Arşivlendi" : "Aktif"} />
            <DetailField label="Paraşüt ID" value={<span className="font-mono text-xs">{data.record.parasut_id}</span>} />
            <DetailField label="Son Senkronizasyon" value={formatParasutDateTime(data.record.synced_at)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
