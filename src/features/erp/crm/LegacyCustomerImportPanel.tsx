import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { DataTable } from "@/components/erp/DataTable";
import { useToast } from "@/hooks/use-toast";
import { importLegacyCustomersToStakeholders, previewLegacyCustomerImport } from "../shared/erpApi";
import { LegacyCustomerImportPreview } from "../shared/types";

type LegacyCustomerImportPanelProps = {
  onImported: () => Promise<void>;
};

export function LegacyCustomerImportPanel({ onImported }: LegacyCustomerImportPanelProps) {
  const { toast } = useToast();
  const [preview, setPreview] = useState<LegacyCustomerImportPreview | null>(null);
  const [loading, setLoading] = useState(false);
  const [importing, setImporting] = useState(false);

  const scan = async () => {
    setLoading(true);
    const result = await previewLegacyCustomerImport();
    setLoading(false);
    setPreview(result.data);

    if (result.error) {
      toast({ title: "Eski Müşteri Taraması", description: result.error, variant: result.missingTable ? "destructive" : "default" });
      return;
    }

    toast({ title: "Tarama Tamamlandı", description: `${result.data.importable} kayıt ERP paydaşlarına aktarılabilir.` });
  };

  const importCustomers = async () => {
    if (!preview || preview.importable === 0) return;
    setImporting(true);
    const result = await importLegacyCustomersToStakeholders();
    setImporting(false);

    if (result.error) {
      toast({ title: "Aktarım Hatası", description: result.error, variant: "destructive" });
      return;
    }

    toast({
      title: "Aktarım Tamamlandı",
      description: `${result.data.imported} kayıt aktarıldı, ${result.data.skippedDuplicates} kayıt atlandı.`,
    });
    await onImported();
    await scan();
  };

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-lg">Eski Müşteri Kayıtlarını ERP’ye Aktar</CardTitle>
        <CardDescription>
          `customer_profile` ve `customers_full` tabloları sadece okunur; kayıtlar kullanıcı onayı olmadan ERP paydaşlarına kopyalanmaz.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" onClick={scan} disabled={loading || importing}>
            {loading ? "Taranıyor..." : "Eski Müşterileri Tara"}
          </Button>
          <Button onClick={importCustomers} disabled={!preview || preview.importable === 0 || importing}>
            {importing ? "Aktarılıyor..." : "ERP Paydaşlarına Aktar"}
          </Button>
        </div>

        {preview ? (
          <div className="grid gap-3 md:grid-cols-4">
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Taranan</p>
              <p className="text-xl font-semibold">{preview.scanned}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Aktarılabilir</p>
              <p className="text-xl font-semibold">{preview.importable}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Yinelenen Atlandı</p>
              <p className="text-xl font-semibold">{preview.skippedDuplicates}</p>
            </div>
            <div className="rounded-md border p-3">
              <p className="text-xs text-muted-foreground">Firma Adı Eksik</p>
              <p className="text-xl font-semibold">{preview.missingCompany}</p>
            </div>
          </div>
        ) : null}

        {preview?.tableErrors.length ? (
          <div className="rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
            {preview.tableErrors.join(" ")}
          </div>
        ) : null}

        {preview?.sample.length ? (
          <DataTable
            columns={[
              { key: "source", header: "Kaynak", render: (row) => row.source_table },
              { key: "company", header: "Firma", render: (row) => row.company_name || "-" },
              { key: "contact", header: "Yetkili", render: (row) => row.contact_name || "-" },
              { key: "phone", header: "Telefon", render: (row) => row.phone || "-" },
              { key: "email", header: "E-posta", render: (row) => row.email || "-" },
              { key: "status", header: "Durum", render: (row) => (row.duplicate ? "Atlanacak" : "Aktarılabilir") },
            ]}
            data={preview.sample}
            rowKey={(row) => `${row.source_table}-${row.source_key}`}
            emptyMessage="Önizleme kaydı yok"
          />
        ) : null}
      </CardContent>
    </Card>
  );
}
