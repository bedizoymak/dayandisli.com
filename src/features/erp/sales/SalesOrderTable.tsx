import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/erp/DataTable";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { formatCurrency, formatDate } from "../shared/formatters";
import { SALES_ORDER_STATUS_LABELS } from "../shared/statusLabels";
import { SalesOrder } from "../shared/types";

type SalesOrderTableProps = {
  data: SalesOrder[];
  stakeholderNameById: Record<string, string>;
  onConvertToWorkOrder: (order: SalesOrder) => void;
  onStatusChange: (order: SalesOrder, status: SalesOrder["status"]) => void;
};

function statusTone(status: SalesOrder["status"]) {
  if (status === "cancelled") return "danger" as const;
  if (status === "closed") return "muted" as const;
  if (status === "invoiced" || status === "shipped") return "success" as const;
  if (status === "waiting_subcontractor") return "warning" as const;
  return "default" as const;
}

export function SalesOrderTable({ data, stakeholderNameById, onConvertToWorkOrder, onStatusChange }: SalesOrderTableProps) {
  return (
    <DataTable
      columns={[
        { key: "order", header: "Sipariş No", render: (row) => row.order_no },
        {
          key: "customer",
          header: "Müşteri",
          render: (row) => (row.stakeholder_id ? stakeholderNameById[row.stakeholder_id] || "-" : "-")
        },
        { key: "title", header: "Başlık", render: (row) => row.title },
        {
          key: "status",
          header: "Durum",
          render: (row) => <StatusBadge label={SALES_ORDER_STATUS_LABELS[row.status]} tone={statusTone(row.status)} />,
        },
        {
          key: "priority",
          header: "Öncelik",
          render: (row) => {
            const label = row.priority === "urgent" ? "Acil" : row.priority === "high" ? "Yüksek" : row.priority === "low" ? "Düşük" : "Normal";
            return label;
          },
        },
        { key: "order_date", header: "Sipariş Tarihi", render: (row) => formatDate(row.order_date) },
        { key: "due", header: "Termin", render: (row) => formatDate(row.due_date) },
        { key: "total", header: "Tutar", className: "text-right", render: (row) => formatCurrency(row.grand_total || 0, row.currency) },
        {
          key: "action",
          header: "İşlem",
          className: "text-right",
          render: (row) => (
            <div className="flex justify-end gap-2">
              <select
                className="h-9 rounded-md border bg-background px-2 text-xs"
                value={row.status}
                onChange={(event) => onStatusChange(row, event.target.value as SalesOrder["status"])}
              >
                {Object.entries(SALES_ORDER_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={() => onConvertToWorkOrder(row)}>
                İş Emrine Dönüştür
              </Button>
            </div>
          ),
        },
      ]}
      data={data}
      rowKey={(row) => row.id}
      emptyMessage="Sipariş kaydı bulunamadı."
    />
  );
}
