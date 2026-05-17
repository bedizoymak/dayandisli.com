import { AlertTriangle } from "lucide-react";
import { ERP_MIGRATION_MESSAGE } from "@/features/erp/shared/erpApi";

type MigrationNoticeProps = {
  message?: string | null;
};

export function MigrationNotice({ message }: MigrationNoticeProps) {
  return (
    <div className="flex items-start gap-3 rounded-md border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-700">
      <AlertTriangle className="mt-0.5 h-4 w-4 shrink-0" />
      <span>{message || ERP_MIGRATION_MESSAGE}</span>
    </div>
  );
}
