import { useEffect, useState } from "react";
import { CheckCircle2, Database, ShieldAlert } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { getERPDatabaseStatus } from "../shared/erpApi";
import { ERPDatabaseStatus } from "../shared/types";

const emptyStatus: ERPDatabaseStatus = {
  overall: "missing_migration",
  label: "Eksik Migration",
  tables: [],
};

function statusTone(status: ERPDatabaseStatus["overall"]) {
  if (status === "ready") return "success" as const;
  if (status === "rls_check_required") return "warning" as const;
  return "danger" as const;
}

export function ERPDatabaseStatusWidget() {
  const [status, setStatus] = useState<ERPDatabaseStatus>(emptyStatus);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getERPDatabaseStatus();
      setStatus(result.data);
      setLoading(false);
    };

    load();
  }, []);

  const Icon = status.overall === "ready" ? CheckCircle2 : status.overall === "rls_check_required" ? ShieldAlert : Database;

  return (
    <Card>
      <CardHeader className="flex flex-row items-center justify-between gap-3">
        <div>
          <CardTitle className="text-base">ERP Veritabanı Durumu</CardTitle>
          <p className="text-sm text-muted-foreground">Ana ERP tablolarının migration ve RLS erişim kontrolü.</p>
        </div>
        <Icon className="h-5 w-5 text-primary" />
      </CardHeader>
      <CardContent className="space-y-3">
        <StatusBadge label={loading ? "Kontrol ediliyor..." : status.label} tone={loading ? "default" : statusTone(status.overall)} />
        <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
          {status.tables.map((table) => (
            <div key={table.table} className="flex items-center justify-between rounded-md border p-2 text-xs">
              <span>{table.table}</span>
              <StatusBadge
                label={table.status === "ready" ? "Hazır" : table.status === "missing" ? "Eksik" : "RLS"}
                tone={table.status === "ready" ? "success" : table.status === "missing" ? "danger" : "warning"}
              />
            </div>
          ))}
        </div>
      </CardContent>
    </Card>
  );
}
