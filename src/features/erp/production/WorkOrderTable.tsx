import { Button } from "@/components/ui/button";
import { DataTable } from "@/components/erp/DataTable";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { formatDate, formatNumber } from "../shared/formatters";
import { WORK_ORDER_STATUS_LABELS } from "../shared/statusLabels";
import { WorkOrder } from "../shared/types";

type WorkOrderTableProps = {
  data: WorkOrder[];
  stakeholderNameById: Record<string, string>;
  onSelectOperations: (workOrder: WorkOrder) => void;
};

function tone(status: WorkOrder["status"]) {
  if (status === "cancelled") return "danger" as const;
  if (status === "completed") return "success" as const;
  if (status === "waiting_subcontractor") return "warning" as const;
  if (status === "paused") return "muted" as const;
  return "default" as const;
}

export function WorkOrderTable({ data, stakeholderNameById, onSelectOperations }: WorkOrderTableProps) {
  return (
    <DataTable
      columns={[
        { key: "wo", header: "Is Emri No", render: (row) => row.work_order_no },
        {
          key: "customer",
          header: "Müsteri",
          render: (row) => (row.stakeholder_id ? stakeholderNameById[row.stakeholder_id] || "-" : "-")
        },
        { key: "part", header: "Parça", render: (row) => row.part_name || row.title },
        { key: "qty", header: "Miktar", className: "text-right", render: (row) => formatNumber(row.quantity, 3) },
        {
          key: "status",
          header: "Durum",
          render: (row) => <StatusBadge label={WORK_ORDER_STATUS_LABELS[row.status]} tone={tone(row.status)} />,
        },
        { key: "op", header: "Operasyon", render: () => "Planlanacak" },
        { key: "due", header: "Termin", render: (row) => formatDate(row.planned_end_date) },
        {
          key: "actions",
          header: "Islem",
          className: "text-right",
          render: (row) => (
            <div className="flex justify-end gap-2">
              <Button variant="outline" size="sm" onClick={() => onSelectOperations(row)}>
                Operasyon Ekle
              </Button>
              <Button variant="outline" size="sm" disabled>
                Baslat
              </Button>
              <Button variant="outline" size="sm" disabled>
                Tamamla
              </Button>
              <Button variant="outline" size="sm" disabled>
                Fasona Gönder
              </Button>
            </div>
          ),
        },
      ]}
      data={data}
      rowKey={(row) => row.id}
      emptyMessage="Is emri kaydi bulunamadi."
    />
  );
}
