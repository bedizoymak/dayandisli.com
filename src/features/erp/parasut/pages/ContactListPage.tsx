import type { ReactNode } from "react";
import { useNavigate } from "react-router-dom";
import type { DataTableColumn } from "@/components/erp/DataTable";
import { ParasutListPage } from "../components/ParasutListPage";
import { formatParasutCurrency, formatParasutDateTime } from "../utils/format";
import type { ContactAttributes, MirrorRowBase } from "../types";

type ContactRow = MirrorRowBase & { attributes: ContactAttributes };

export function ContactListPage({ resource, title, description, detailBasePath, actions }: { resource: "customers" | "suppliers"; title: string; description: string; detailBasePath: string; actions?: ReactNode }) {
  const navigate = useNavigate();

  const columns: DataTableColumn<ContactRow>[] = [
    { key: "name", header: "Ad / Ünvan", render: (row) => row.attributes.name ?? "—" },
    { key: "type", header: "Tür", render: (row) => (row.attributes.contact_type === "company" ? "Firma" : row.attributes.contact_type === "person" ? "Şahıs" : row.attributes.contact_type ?? "—") },
    { key: "tax_office", header: "Vergi Dairesi", render: (row) => row.attributes.tax_office ?? "—" },
    { key: "tax_number", header: "Vergi Numarası", render: (row) => row.attributes.tax_number ?? "—" },
    { key: "email", header: "E-posta", render: (row) => row.attributes.email ?? "—" },
    { key: "phone", header: "Telefon", render: (row) => row.attributes.phone ?? "—" },
    { key: "balance", header: "Bakiye (TL)", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.trl_balance, "TRY") },
    { key: "updated", header: "Son Güncelleme", render: (row) => formatParasutDateTime(row.last_seen_at) },
  ];

  return (
    <ParasutListPage
      title={title}
      description={description}
      resource={resource}
      columns={columns}
      searchPlaceholder="Ad, e-posta veya vergi no ara..."
      emptyDescription={`Senkronize edilmiş ${resource === "customers" ? "müşteri" : "tedarikçi"} kaydı bulunmuyor.`}
      rowKey={(row) => row.parasut_id}
      onRowClick={(row) => navigate(`${detailBasePath}/${row.parasut_id}`)}
      actions={actions}
    />
  );
}
