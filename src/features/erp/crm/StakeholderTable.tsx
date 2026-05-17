import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/erp/DataTable";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { formatCurrency } from "../shared/formatters";
import { STAKEHOLDER_TYPE_LABELS } from "../shared/statusLabels";
import { Stakeholder } from "../shared/types";

type StakeholderTableProps = {
  data: Stakeholder[];
  onDeactivate: (stakeholder: Stakeholder) => void;
};

export function StakeholderTable({ data, onDeactivate }: StakeholderTableProps) {
  return (
    <DataTable
      columns={[
        { key: "company", header: "Firma", render: (row) => row.company_name },
        { key: "type", header: "Tip", render: (row) => STAKEHOLDER_TYPE_LABELS[row.type] },
        { key: "contact", header: "Yetkili", render: (row) => row.contact_name || "-" },
        { key: "phone", header: "Telefon", render: (row) => row.phone || "-" },
        { key: "email", header: "E-posta", render: (row) => row.email || "-" },
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
          header: "Islem",
          className: "text-right",
          render: (row) =>
            row.is_active ? (
              <Button variant="outline" size="sm" onClick={() => onDeactivate(row)}>
                Pasiflestir
              </Button>
            ) : (
              <span className="text-xs text-muted-foreground">-</span>
            ),
        },
      ]}
      data={data}
      rowKey={(row) => row.id}
      emptyMessage="Paydas kaydi bulunamadi."
    />
  );
}
