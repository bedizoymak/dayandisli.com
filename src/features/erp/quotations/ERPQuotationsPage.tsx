import { useEffect, useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import { convertQuotationToSalesOrder, listERPQuotationsFromExistingTable } from "../shared/erpApi";
import { formatCurrency, formatDateTime } from "../shared/formatters";
import { ERPQuotation } from "../shared/types";
import { useToast } from "@/hooks/use-toast";

export default function ERPQuotationsPage() {
  const { toast } = useToast();
  const navigate = useNavigate();
  const [rows, setRows] = useState<ERPQuotation[]>([]);
  const [loading, setLoading] = useState(true);
  const [convertingId, setConvertingId] = useState<string | null>(null);
  const [search, setSearch] = useState("");
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const result = await listERPQuotationsFromExistingTable();
    if (result.error) {
      setError(result.error);
      toast({ title: "Hata", description: `Teklifler yüklenemedi: ${result.error}`, variant: "destructive" });
    } else {
      setError(null);
    }
    setRows(result.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [toast]);

  const filteredRows = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((row) => row.teklif_no.toLowerCase().includes(q) || row.firma.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <ERPLayout title="Teklif Yönetimi">
      <PageHeader
        title="ERP Teklif Görünümü"
        description="Mevcut quotations tablosundaki teklifleri ERP ekranında görüntüleyin."
        actions={
          <Button asChild>
            <Link to="/teklif-sayfasi">Teklif Oluşturucuya Git</Link>
          </Button>
        }
      />

      {loading ? (
        <p className="text-sm text-muted-foreground">Teklifler yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Teklif kaydı yok" description="Henüz kayıtlı teklif bulunmuyor." />
      ) : (
        <div className="space-y-3">
          {error ? <MigrationNotice message={error} /> : null}
          <Input
            placeholder="Teklif no veya firma ara..."
            value={search}
            onChange={(event) => setSearch(event.target.value)}
          />
          <DataTable
            columns={[
              { key: "teklif", header: "Teklif No", render: (row) => row.teklif_no },
              { key: "firma", header: "Firma", render: (row) => row.firma },
              { key: "ilgili", header: "İlgili Kişi", render: (row) => row.ilgili_kisi || "-" },
              {
                key: "tutar",
                header: "Toplam",
                className: "text-right",
                render: (row) => formatCurrency(row.total ?? 0, row.active_currency || "TRY"),
              },
              { key: "tarih", header: "Oluşturulma", render: (row) => formatDateTime(row.created_at) },
              {
                key: "action",
                header: "İşlem",
                className: "text-right",
                render: (row) => (
                  <Button
                    variant="outline"
                    size="sm"
                    disabled={convertingId === row.id}
                    onClick={async () => {
                      setConvertingId(row.id);
                      const result = await convertQuotationToSalesOrder(row);
                      setConvertingId(null);

                      if (result.error || !result.data) {
                        toast({ title: "Dönüştürme Hatası", description: result.error || "Sipariş oluşturulamadı.", variant: "destructive" });
                        return;
                      }

                      toast({ title: "Sipariş Oluşturuldu", description: `${row.teklif_no} ERP siparişine dönüştürüldü.` });
                      navigate("/erp/sales-orders");
                    }}
                  >
                    {convertingId === row.id ? "Dönüştürülüyor..." : "Siparişe Dönüştür"}
                  </Button>
                ),
              },
            ]}
            data={filteredRows}
            rowKey={(row) => row.id}
            emptyMessage="Teklif bulunamadı"
          />
        </div>
      )}
    </ERPLayout>
  );
}
