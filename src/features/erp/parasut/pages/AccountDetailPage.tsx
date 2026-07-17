import { Link, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/PageHeader";
import { useParasutSimpleDetail } from "../api/queries";
import { formatParasutCurrency, formatParasutDateTime } from "../utils/format";
import { ParasutErrorState, ParasutLoadingState } from "../components/ParasutStateViews";
import type { AccountAttributes } from "../types";

function DetailField({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div>
      <p className="text-xs font-medium uppercase tracking-wide text-erp-muted">{label}</p>
      <p className="mt-0.5 text-sm text-erp-text">{value}</p>
    </div>
  );
}

export default function AccountDetailPage() {
  const { parasutId } = useParams<{ parasutId: string }>();
  const { data, isLoading, isError, error, refetch } = useParasutSimpleDetail<AccountAttributes>("accounts", parasutId);

  return (
    <div className="space-y-6">
      <PageHeader
        title="Hesap Detayı"
        description="Paraşüt aynasından okunan salt-okunur kasa/banka hesabı."
        actions={
          <Button asChild variant="outline" size="sm">
            <Link to="/apps/parasut/kasa-banka">
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
            <DetailField label="Hesap Türü" value={data.record.attributes.account_type === "bank" ? "Banka" : data.record.attributes.account_type === "cash" ? "Kasa" : data.record.attributes.account_type ?? "—"} />
            <DetailField label="Banka" value={data.record.attributes.bank_name ?? "—"} />
            <DetailField label="Şube" value={data.record.attributes.bank_branch ?? "—"} />
            <DetailField label="IBAN" value={<span className="font-mono text-xs">{data.record.attributes.iban ?? "—"}</span>} />
            <DetailField label="Para Birimi" value={data.record.attributes.currency ?? "—"} />
            <DetailField label="Bakiye" value={formatParasutCurrency(data.record.attributes.balance, data.record.attributes.currency)} />
            <DetailField label="Aktiflik" value={data.record.attributes.archived ? "Arşivlendi" : "Aktif"} />
            <DetailField label="Son Kullanım" value={formatParasutDateTime(data.record.attributes.last_used_at)} />
            <DetailField label="Paraşüt ID" value={<span className="font-mono text-xs">{data.record.parasut_id}</span>} />
            <DetailField label="Son Senkronizasyon" value={formatParasutDateTime(data.record.synced_at)} />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
