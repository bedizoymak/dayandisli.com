import { useEffect, useState } from "react";
import { Clock } from "lucide-react";
import { listAuditLogsForEntity } from "@/features/erp/shared/erpApi";
import { ERPAuditLog } from "@/features/erp/shared/types";
import { AUDIT_ACTION_LABELS } from "@/features/erp/shared/statusLabels";
import { formatDateTime } from "@/features/erp/shared/formatters";

type AuditTimelineProps = {
  entityType: string;
  entityId?: string | null;
};

export function AuditTimeline({ entityType, entityId }: AuditTimelineProps) {
  const [rows, setRows] = useState<ERPAuditLog[]>([]);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    const load = async () => {
      if (!entityId) return;
      setLoading(true);
      const result = await listAuditLogsForEntity(entityType, entityId);
      setRows(result.data);
      setLoading(false);
    };

    load();
  }, [entityType, entityId]);

  return (
    <section className="rounded-md border bg-card p-4">
      <h2 className="mb-3 text-lg font-semibold">İşlem Geçmişi</h2>
      {loading ? <p className="text-sm text-muted-foreground">Geçmiş yükleniyor...</p> : null}
      {!loading && rows.length === 0 ? <p className="text-sm text-muted-foreground">Henüz audit kaydı yok.</p> : null}
      <div className="space-y-3">
        {rows.map((row) => (
          <div key={row.id} className="flex gap-3 rounded-md border p-3 text-sm">
            <Clock className="mt-0.5 h-4 w-4 shrink-0 text-primary" />
            <div className="min-w-0">
              <p className="font-medium">{AUDIT_ACTION_LABELS[row.action] || row.action}</p>
              {row.description ? <p className="text-muted-foreground">{row.description}</p> : null}
              {row.old_status || row.new_status ? (
                <p className="text-xs text-muted-foreground">
                  Durum: {row.old_status || "-"} → {row.new_status || "-"}
                </p>
              ) : null}
              <p className="text-xs text-muted-foreground">
                {formatDateTime(row.created_at)} {row.actor_email ? `• ${row.actor_email}` : ""}
              </p>
            </div>
          </div>
        ))}
      </div>
    </section>
  );
}
