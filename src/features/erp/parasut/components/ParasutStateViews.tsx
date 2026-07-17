import { AlertTriangle, Inbox, Loader2, LockKeyhole, PlugZap } from "lucide-react";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export function ParasutLoadingState({ label = "Veriler yükleniyor..." }: { label?: string }) {
  return (
    <div role="status" aria-live="polite" className="erp-surface flex min-h-[220px] flex-col items-center justify-center gap-3 rounded-lg p-8 text-sm text-muted-foreground">
      <Loader2 className="h-6 w-6 animate-spin text-primary" aria-hidden="true" />
      <span>{label}</span>
    </div>
  );
}

export function ParasutErrorState({ message, onRetry }: { message: string; onRetry?: () => void }) {
  return (
    <Card role="alert" className="border-destructive/40 bg-destructive/5">
      <CardHeader className="items-start">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg border border-destructive/30 bg-destructive/10 text-destructive">
          <AlertTriangle className="h-5 w-5" aria-hidden="true" />
        </div>
        <CardTitle className="text-base">Veri alınamadı</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
      {onRetry ? (
        <CardContent>
          <button type="button" onClick={onRetry} className="text-sm font-medium text-primary underline-offset-4 hover:underline focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background rounded">
            Tekrar dene
          </button>
        </CardContent>
      ) : null}
    </Card>
  );
}

export function ParasutEmptyState({ title = "Kayıt bulunamadı", description }: { title?: string; description: string }) {
  return (
    <Card className="border-dashed border-border/80 bg-card/80">
      <CardHeader className="items-start">
        <div className="erp-icon-surface mb-2 flex h-10 w-10 items-center justify-center rounded-lg">
          <Inbox className="h-5 w-5" aria-hidden="true" />
        </div>
        <CardTitle className="text-base">{title}</CardTitle>
        <CardDescription>{description}</CardDescription>
      </CardHeader>
    </Card>
  );
}

/** Shown for nav items / resources with no backing mirror table or data source, per the "do not fabricate data" rule. */
export function ParasutMissingResourceState({ message }: { message: string }) {
  return (
    <Card className="border-dashed border-border/80 bg-card/60">
      <CardHeader className="items-start">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
          <PlugZap className="h-5 w-5" aria-hidden="true" />
        </div>
        <CardTitle className="text-base">Veri kaynağı hazır değil</CardTitle>
        <CardDescription>{message}</CardDescription>
      </CardHeader>
    </Card>
  );
}

export function ParasutPermissionDeniedState() {
  return (
    <Card className="border-border/80 bg-card/80">
      <CardHeader className="items-start">
        <div className="mb-1 flex h-10 w-10 items-center justify-center rounded-lg border border-border bg-muted/50 text-muted-foreground">
          <LockKeyhole className="h-5 w-5" aria-hidden="true" />
        </div>
        <CardTitle className="text-base">Bu alana erişim yetkiniz yok</CardTitle>
        <CardDescription>Bu ekranı görüntülemek için Paraşüt senkronizasyon yetkisi gereklidir.</CardDescription>
      </CardHeader>
    </Card>
  );
}

/** Explains a dashboard metric that cannot be reliably calculated instead of silently showing zero. */
export function CannotCalculate({ reason }: { reason: string }) {
  return (
    <span className="inline-flex items-center gap-1 text-sm text-muted-foreground" title={reason}>
      Hesaplanamıyor
    </span>
  );
}
