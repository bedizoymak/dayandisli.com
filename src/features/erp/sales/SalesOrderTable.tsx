import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/erp/DataTable";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { formatCurrency, formatDate } from "../shared/formatters";
import { SALES_ORDER_STATUS_LABELS } from "../shared/statusLabels";
import { SalesOrder } from "../shared/types";

type SalesOrderTableProps = {
  data: SalesOrder[];
  stakeholderNameById: Record<string, string>;
};

function statusTone(status: SalesOrder["status"]) {
  if (status === "cancelled") return "danger" as const;
  if (status === "closed") return "muted" as const;
  if (status === "invoiced" || status === "shipped") return "success" as const;
  if (status === "waiting_subcontractor") return "warning" as const;
  return "default" as const;
}

export function SalesOrderTable({ data, stakeholderNameById }: SalesOrderTableProps) {
  return (
    <DataTable
      columns={[
        { key: "order", header: "Sipariş No", render: (row) => row.order_no },
        {
          key: "customer",
          header: "Müşteri",
          render: (row) => (row.stakeholder_id ? stakeholderNameById[row.stakeholder_id] || "-" : "-")
        },
        { key: "title", header: "Baslik", render: (row) => row.title },
        {
          key: "status",
          header: "Durum",
          render: (row) => <StatusBadge label={SALES_ORDER_STATUS_LABELS[row.status]} tone={statusTone(row.status)} />,
        },
        {
          key: "priority",
          header: "Öncelik",
          render: (row) => {
            const label = row.priority === "urgent" ? "Acil" : row.priority === "high" ? "Yüksek" : row.priority === "low" ? "Düsük" : "Normal";
            return label;
          },
        },
        { key: "due", header: "Termin", render: (row) => formatDate(row.due_date) },
        { key: "total", header: "Tutar", className: "text-right", render: (row) => formatCurrency(row.grand_total || 0, row.currency) },
        {
          key: "action",
          header: "İşlem",
          className: "text-right",
          render: () => (
            <Button variant="outline" size="sm" disabled>
              İş Emrine Dönüştür
            </Button>
          ),
        },
      ]}
      data={data}
      rowKey={(row) => row.id}
      emptyMessage="Sipariş kaydı bulunamadı."
    />
  );
}
