import { useState } from "react";
import { RefreshCw } from "lucide-react";
import { Dialog, DialogContent, DialogHeader, DialogTitle } from "@/components/ui/dialog";
import { useErpIdentity } from "@/features/erp-shell/erpIdentity";
import { MANUAL_SYNC_RESOURCE_LABELS, runManualParasutSync, type ManualSyncSummary } from "./parasutManualSync";

const STATUS_LABEL: Record<string, string> = {
  completed: "Tamamlandı",
  partial: "Kısmi (devam edecek)",
  failed: "Başarısız",
};

function summaryHeadline(summary: ManualSyncSummary): string {
  if (summary.overallStatus === "conflict") return "Zaten devam eden bir senkronizasyon var";
  if (summary.overallStatus === "completed") return "Senkronizasyon tamamlandı";
  if (summary.overallStatus === "failed") return "Senkronizasyon başarısız oldu";
  return "Senkronizasyon kısmi tamamlandı";
}

/**
 * Manual, one-way Paraşüt → Supabase synchronization control for the
 * account-statement-relevant resources (contacts, sales invoices, purchase
 * bills, checks). Placed on the Müşteriler list — the natural entry point
 * for "is my customer data current before I check a statement" — rather
 * than a new settings page (none exists for Paraşüt integration today; see
 * ACCOUNT_STATEMENT_AND_PARASUT_SYNC_AUDIT.md's manual-sync section).
 *
 * A single click triggers ONE server-side "full-resync" call that itself
 * resumes each resource to completion (or a safety limit) across as many
 * chunks as it takes — never just the first bounded page batch. See
 * parasutManualSync.ts / handleFullResync's own doc comments.
 *
 * Admin-gated the same way ChecksPage.tsx's existing "Paraşüt'ten Yenile"
 * button is (roles.includes("admin")) — the real enforcement is server-side
 * in parasut-write-api's handleFullResync (403 for a non-admin regardless
 * of this UI check), so this only avoids showing a button that would just
 * fail for a non-admin.
 */
export function ParasutManualSyncControl({ onSyncComplete }: { onSyncComplete?: () => void }) {
  const { roles } = useErpIdentity();
  const isAdmin = roles.includes("admin");
  const [running, setRunning] = useState(false);
  const [summary, setSummary] = useState<ManualSyncSummary | null>(null);
  const [popupOpen, setPopupOpen] = useState(false);

  if (!isAdmin) return null;

  const runSync = async () => {
    if (running) return;
    setRunning(true);
    const result = await runManualParasutSync();
    setSummary(result);
    setPopupOpen(true);
    setRunning(false);
    // Refresh whatever real progress was made — a partial run still moved
    // real records forward, so the visible list should reflect it; only a
    // conflict or an outright failure fetched nothing new.
    if (result.overallStatus === "completed" || result.overallStatus === "partial") onSyncComplete?.();
  };

  return (
    <>
      <button type="button" className="crm-primary" onClick={runSync} disabled={running}>
        <RefreshCw className={running ? "spin" : ""} />
        {running ? "Paraşüt ile Senkronize Ediliyor…" : "Paraşüt ile Senkronize Et"}
      </button>

      <Dialog open={popupOpen} onOpenChange={setPopupOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>{summary ? summaryHeadline(summary) : "Senkronizasyon"}</DialogTitle>
          </DialogHeader>
          {summary && (
            <div className="space-y-3 text-sm">
              {summary.overallStatus === "conflict" ? (
                <p>
                  {summary.conflictResource ? MANUAL_SYNC_RESOURCE_LABELS[summary.conflictResource] : "Bir kaynak"} için başka bir senkronizasyon şu
                  anda çalışıyor. Lütfen birkaç dakika sonra tekrar deneyin.
                </p>
              ) : summary.overallStatus === "failed" && summary.resources.length === 0 ? (
                <p>Senkronizasyon başlatılamadı. Lütfen daha sonra tekrar deneyin.</p>
              ) : summary.resources.every((resource) => resource.status === "completed" && resource.inserted === 0 && resource.updated === 0 && resource.errors === 0) ? (
                <p>Değişiklik bulunamadı — tüm kayıtlar zaten güncel.</p>
              ) : (
                <ul className="space-y-1.5">
                  {summary.resources.map((resource) => (
                    <li key={resource.resource} className="flex items-center justify-between gap-3 rounded border px-2.5 py-1.5">
                      <span>{resource.label}</span>
                      <span className="text-muted-foreground">
                        {resource.status === "failed"
                          ? STATUS_LABEL.failed
                          : `Eklenen ${resource.inserted}, Güncellenen ${resource.updated}, Değişmeyen ${resource.unchanged}` +
                            (resource.errors > 0 ? `, Hatalı ${resource.errors}` : "") +
                            (resource.status === "partial" ? ` · ${STATUS_LABEL.partial}` : "")}
                      </span>
                    </li>
                  ))}
                </ul>
              )}
            </div>
          )}
        </DialogContent>
      </Dialog>
    </>
  );
}
