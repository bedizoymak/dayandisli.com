import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/erp/DataTable";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { formatCurrency } from "../shared/formatters";
import { STAKEHOLDER_TYPE_LABELS } from "../shared/statusLabels";
import { Stakeholder } from "../shared/types";

type StakeholderTableProps = {
  data: Stakeholder[];
  onEdit: (stakeholder: Stakeholder) => void;
  onDeactivate: (stakeholder: Stakeholder) => void;
  onActivate: (stakeholder: Stakeholder) => void;
};

export function StakeholderTable({ data, onEdit, onDeactivate, onActivate }: StakeholderTableProps) {
  return (
    <DataTable
      columns={[
        { key: "company", header: "Firma", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/stakeholders/${row.id}`}>{row.company_name}</Link> },
        { key: "type", header: "Tip", render: (row) => STAKEHOLDER_TYPE_LABELS[row.type] },
        { key: "contact", header: "Yetkili", render: (row) => row.contact_name || "-" },
        { key: "phone", header: "Telefon", render: (row) => row.phone || "-" },
        { key: "email", header: "E-posta", render: (row) => row.email || "-" },
        { key: "city", header: "Şehir", render: (row) => row.city || "-" },
        { key: "balance", header: "Bakiye", className: "text-right", render: (row) => formatCurrency(row.current_balance) },
        { key: "risk", header: "Risk Limiti", className: "text-right", render: (row) => formatCurrency(row.risk_limit) },
        {
          key: "status",
          header: "Durum",
          render: (row) =>
            row.is_active ? <StatusBadge label="Aktif" tone="success" /> : <StatusBadge label="Pasif" tone="muted" />,
        },
        {
          key: "actions",
          header: "İşlem",
          className: "text-right",
          render: (row) =>
            row.is_active ? (
              <div className="flex justify-end gap-2">
                <Button variant="outline" size="sm" onClick={() => onEdit(row)}>
                  Düzenle
                </Button>
                <Button variant="outline" size="sm" onClick={() => onDeactivate(row)}>
                  Pasifleştir
                </Button>
              </div>
            ) : (
              <Button variant="outline" size="sm" onClick={() => onActivate(row)}>
                Aktifleştir
              </Button>
            ),
        },
      ]}
      data={data}
      rowKey={(row) => row.id}
      emptyMessage="Paydaş kaydı bulunamadı."
    />
  );
}
