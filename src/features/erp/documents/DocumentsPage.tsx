import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";
import { createDocumentMetadata, listDocuments } from "../shared/erpApi";
import { DocumentMetadata } from "../shared/types";
import { formatDateTime } from "../shared/formatters";
import { useToast } from "@/hooks/use-toast";

export default function DocumentsPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<DocumentMetadata[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({
    entity_type: "work_order",
    entity_id: "",
    document_type: "technical_drawing",
    file_name: "",
    file_path: "",
    version_no: "1",
    notes: "",
  });

  const load = async () => {
    setLoading(true);
    const result = await listDocuments();
    if (result.error) {
      setError(result.error);
      toast({ title: "Hata", description: result.error, variant: "destructive" });
    } else {
      setError(null);
    }
    setRows(result.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  return (
    <ERPLayout title="Teknik Resim ve Doküman">
      <PageHeader
        title="Teknik Resim ve Doküman Yönetimi"
        description="Teknik resim, kalite raporu ve sevk dokümanı metadata kayıtlarını yönetin."
        actions={<Button variant="outline" disabled>Dosya Yükle (Hazırlanıyor)</Button>}
      />

      {error ? <MigrationNotice message={error} /> : null}

      <FormSection title="Yeni Doküman Metadata" description="Dosya yükleme entegrasyonu sonraki fazda aktif edilecek.">
        <form
          className="grid gap-3 md:grid-cols-3"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!form.file_name.trim()) return;
            const result = await createDocumentMetadata({
              entity_type: form.entity_type,
              entity_id: form.entity_id || null,
              document_type: form.document_type,
              file_name: form.file_name,
              file_path: form.file_path || null,
              version_no: Number(form.version_no || 1),
              notes: form.notes || null,
            });
            if (result.error) {
              toast({ title: "Doküman", description: result.error, variant: "destructive" });
              return;
            }
            toast({ title: "Kaydedildi", description: "Doküman metadata kaydı oluşturuldu." });
            setForm({ entity_type: "work_order", entity_id: "", document_type: "technical_drawing", file_name: "", file_path: "", version_no: "1", notes: "" });
            await load();
          }}
        >
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.entity_type} onChange={(event) => setForm((prev) => ({ ...prev, entity_type: event.target.value }))}>
            <option value="quotation">Teklif</option>
            <option value="sales_order">Satış Siparişi</option>
            <option value="work_order">İş Emri</option>
            <option value="quality_report">Kalite Raporu</option>
            <option value="machine">Makine</option>
            <option value="employee">Personel</option>
          </select>
          <Input placeholder="Bağlı kayıt ID" value={form.entity_id} onChange={(event) => setForm((prev) => ({ ...prev, entity_id: event.target.value }))} />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.document_type} onChange={(event) => setForm((prev) => ({ ...prev, document_type: event.target.value }))}>
            <option value="technical_drawing">Teknik Resim</option>
            <option value="cad">CAD</option>
            <option value="cam">CAM</option>
            <option value="pdf">PDF</option>
            <option value="photo">Fotoğraf</option>
            <option value="invoice">Fatura</option>
            <option value="delivery_note">İrsaliye</option>
          </select>
          <Input placeholder="Dosya adı" value={form.file_name} onChange={(event) => setForm((prev) => ({ ...prev, file_name: event.target.value }))} />
          <Input placeholder="Dosya yolu / storage path" value={form.file_path} onChange={(event) => setForm((prev) => ({ ...prev, file_path: event.target.value }))} />
          <Input type="number" placeholder="Versiyon" value={form.version_no} onChange={(event) => setForm((prev) => ({ ...prev, version_no: event.target.value }))} />
          <Input className="md:col-span-2" placeholder="Not" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
          <Button type="submit">Kaydet</Button>
        </form>
      </FormSection>

      {loading ? (
        <p className="text-sm text-muted-foreground">Doküman kayıtları yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState title="Doküman kaydı yok" description="İlk doküman metadata kayıtları oluştuğunda burada listelenecektir." />
      ) : (
        <DataTable
          columns={[
            { key: "entity", header: "Bağlı Varlık", render: (row) => `${row.entity_type} / ${row.entity_id || "-"}` },
            { key: "type", header: "Doküman Tipi", render: (row) => row.document_type },
            { key: "name", header: "Dosya Adı", render: (row) => row.file_name },
            { key: "version", header: "Versiyon", className: "text-right", render: (row) => row.version_no },
            { key: "created", header: "Kayıt", render: (row) => formatDateTime(row.created_at) },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Doküman bulunamadı"
        />
      )}
    </ERPLayout>
  );
}
