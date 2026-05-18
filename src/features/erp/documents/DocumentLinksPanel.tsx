import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSection } from "@/components/erp/FormSection";
import { DataTable } from "@/components/erp/DataTable";
import { createDocumentMetadata, listDocumentsForEntity } from "../shared/erpApi";
import { DocumentMetadata } from "../shared/types";
import { formatDateTime } from "../shared/formatters";
import { useToast } from "@/hooks/use-toast";

type DocumentLinksPanelProps = {
  entityType: string;
  entityId: string;
};

const documentTypes = [
  ["technical_drawing", "Teknik Resim"],
  ["cad", "CAD"],
  ["cam", "CAM"],
  ["pdf", "PDF"],
  ["photo", "Fotoğraf"],
  ["invoice", "Fatura"],
  ["delivery_note", "Sevk İrsaliyesi"],
  ["quality_report", "Kalite Raporu"],
  ["other", "Diğer"],
];

export function DocumentLinksPanel({ entityType, entityId }: DocumentLinksPanelProps) {
  const { toast } = useToast();
  const [rows, setRows] = useState<DocumentMetadata[]>([]);
  const [form, setForm] = useState({ document_type: "technical_drawing", file_name: "", file_path: "", version_no: "1", notes: "" });

  const load = async () => {
    const result = await listDocumentsForEntity(entityType, entityId);
    setRows(result.data);
  };

  useEffect(() => {
    load();
  }, [entityType, entityId]);

  return (
    <FormSection title="Bağlı Dokümanlar" description="Dosya yükleme entegrasyonu sonraki fazda aktif edilecek. Bu alan metadata bağlantısı tutar.">
      <form
        className="grid gap-3 md:grid-cols-[180px_1fr_1fr_120px_auto]"
        onSubmit={async (event) => {
          event.preventDefault();
          if (!form.file_name.trim()) {
            toast({ title: "Eksik Bilgi", description: "Dosya adı zorunludur.", variant: "destructive" });
            return;
          }
          const result = await createDocumentMetadata({
            entity_type: entityType,
            entity_id: entityId,
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
          setForm({ document_type: "technical_drawing", file_name: "", file_path: "", version_no: "1", notes: "" });
          await load();
        }}
      >
        <select className="h-10 rounded-md border bg-background px-3 text-sm" value={form.document_type} onChange={(event) => setForm((prev) => ({ ...prev, document_type: event.target.value }))}>
          {documentTypes.map(([value, label]) => <option key={value} value={value}>{label}</option>)}
        </select>
        <Input placeholder="Dosya adı" value={form.file_name} onChange={(event) => setForm((prev) => ({ ...prev, file_name: event.target.value }))} />
        <Input placeholder="Dosya yolu / storage path" value={form.file_path} onChange={(event) => setForm((prev) => ({ ...prev, file_path: event.target.value }))} />
        <Input type="number" min="1" value={form.version_no} onChange={(event) => setForm((prev) => ({ ...prev, version_no: event.target.value }))} />
        <Button type="submit">Bağla</Button>
      </form>

      <DataTable
        columns={[
          { key: "type", header: "Tip", render: (row) => documentTypes.find(([value]) => value === row.document_type)?.[1] || row.document_type },
          { key: "name", header: "Dosya", render: (row) => row.file_name },
          { key: "version", header: "Versiyon", render: (row) => row.version_no },
          { key: "created", header: "Tarih", render: (row) => formatDateTime(row.created_at) },
        ]}
        data={rows}
        rowKey={(row) => row.id}
        emptyMessage="Bağlı doküman yok."
      />
    </FormSection>
  );
}
