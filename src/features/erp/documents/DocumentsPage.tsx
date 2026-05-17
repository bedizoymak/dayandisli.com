import { useMemo } from "react";
import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";

const placeholderDocuments = [
  {
    id: "1",
    entity_type: "work_order",
    entity_id: "WO-2026-00001",
    document_type: "technical_drawing",
    file_name: "planet_disli_revA.pdf",
    version_no: 1,
  },
  {
    id: "2",
    entity_type: "quality_report",
    entity_id: "QC-2026-00003",
    document_type: "pdf",
    file_name: "olcum_raporu_qc3.pdf",
    version_no: 2,
  },
];

export default function DocumentsPage() {
  const rows = useMemo(() => placeholderDocuments, []);

  return (
    <ERPLayout title="Teknik Resim ve Doküman">
      <PageHeader
        title="Teknik Resim ve Doküman Yönetimi"
        description="Doküman metadata yapisi hazirdir. Storage bucket hazir oldugunda gerçek dosya yükleme aktif edilecektir."
        actions={<Button variant="outline" disabled>Dosya Yükle (Hazirlaniyor)</Button>}
      />

      {rows.length === 0 ? (
        <EmptyState title="Doküman kaydi yok" description="Ilk döküman metadata kayitlari olustugunda burada listelenecektir." />
      ) : (
        <DataTable
          columns={[
            { key: "entity", header: "Bagli Varlik", render: (row) => `${row.entity_type} / ${row.entity_id}` },
            { key: "type", header: "Doküman Tipi", render: (row) => row.document_type },
            { key: "name", header: "Dosya Adi", render: (row) => row.file_name },
            { key: "version", header: "Versiyon", className: "text-right", render: (row) => row.version_no },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Doküman bulunamadi"
        />
      )}
    </ERPLayout>
  );
}
