import { Button } from "@/components/ui/button";
import { Link } from "react-router-dom";
import { DataTable } from "@/components/erp/DataTable";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { formatDate, formatNumber } from "../shared/formatters";
import { WORK_ORDER_STATUS_LABELS } from "../shared/statusLabels";
import { WorkOrder } from "../shared/types";

type WorkOrderTableProps = {
  data: WorkOrder[];
  stakeholderNameById: Record<string, string>;
  onSelectOperations: (workOrder: WorkOrder) => void;
  onStatusChange: (workOrder: WorkOrder, status: WorkOrder["status"]) => void;
  onSendSubcontracting: (workOrder: WorkOrder) => void;
  onSendQuality: (workOrder: WorkOrder) => void;
};

function tone(status: WorkOrder["status"]) {
  if (status === "cancelled") return "danger" as const;
  if (status === "completed") return "success" as const;
  if (status === "waiting_subcontractor") return "warning" as const;
  if (status === "paused") return "muted" as const;
  return "default" as const;
}

export function WorkOrderTable({
  data,
  stakeholderNameById,
  onSelectOperations,
  onStatusChange,
  onSendSubcontracting,
  onSendQuality,
}: WorkOrderTableProps) {
  return (
    <DataTable
      columns={[
        { key: "wo", header: "İş Emri No", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/erp/work-orders/${row.id}`}>{row.work_order_no}</Link> },
        {
          key: "customer",
          header: "Müşteri",
          render: (row) => (row.stakeholder_id ? stakeholderNameById[row.stakeholder_id] || "-" : "-")
        },
        { key: "title", header: "Başlık", render: (row) => row.title },
        { key: "part", header: "Parça", render: (row) => row.part_name || "-" },
        { key: "qty", header: "Miktar", className: "text-right", render: (row) => formatNumber(row.quantity, 3) },
        {
          key: "status",
          header: "Durum",
          render: (row) => <StatusBadge label={WORK_ORDER_STATUS_LABELS[row.status]} tone={tone(row.status)} />,
        },
        { key: "priority", header: "Öncelik", render: (row) => row.priority === "urgent" ? "Acil" : row.priority === "high" ? "Yüksek" : row.priority === "low" ? "Düşük" : "Normal" },
        { key: "start", header: "Plan Başlangıç", render: (row) => formatDate(row.planned_start_date) },
        { key: "due", header: "Termin", render: (row) => formatDate(row.planned_end_date) },
        {
          key: "actions",
          header: "İşlem",
          className: "text-right",
          render: (row) => (
            <div className="flex justify-end gap-2">
              <select
                className="h-9 rounded-md border bg-background px-2 text-xs"
                value={row.status}
                onChange={(event) => onStatusChange(row, event.target.value as WorkOrder["status"])}
              >
                {Object.entries(WORK_ORDER_STATUS_LABELS).map(([value, label]) => (
                  <option key={value} value={value}>
                    {label}
                  </option>
                ))}
              </select>
              <Button variant="outline" size="sm" onClick={() => onSelectOperations(row)}>
                Operasyonlar
              </Button>
              <Button variant="outline" size="sm" onClick={() => onSendQuality(row)}>
                Kalite
              </Button>
              <Button variant="outline" size="sm" onClick={() => onSendSubcontracting(row)}>
                Fasona Gönder
              </Button>
            </div>
          ),
        },
      ]}
      data={data}
      rowKey={(row) => row.id}
      emptyMessage="İş emri kaydı bulunamadı."
    />
  );
}
