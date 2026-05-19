import { Badge } from "@/components/ui/badge";

type StatusBadgeProps = {
  label: string;
  tone?: "default" | "warning" | "success" | "danger" | "muted";
};

const toneClassMap: Record<NonNullable<StatusBadgeProps["tone"]>, string> = {
  default: "bg-primary/20 text-primary border-primary/30",
  warning: "bg-yellow-500/20 text-yellow-500 border-yellow-500/30",
  success: "bg-emerald-500/20 text-emerald-500 border-emerald-500/30",
  danger: "bg-red-500/20 text-red-500 border-red-500/30",
  muted: "bg-muted text-muted-foreground border-border",
};

const labelToneMap: Record<string, NonNullable<StatusBadgeProps["tone"]>> = {
  aktif: "success",
  bekliyor: "warning",
  tamamlandı: "success",
  iptal: "danger",
  teklif: "default",
  "sipariş hazırlanıyor": "warning",
};

export function StatusBadge({ label, tone }: StatusBadgeProps) {
  const resolvedTone = tone || labelToneMap[label.toLocaleLowerCase("tr-TR")] || "default";
  return <Badge className={toneClassMap[resolvedTone]}>{label}</Badge>;
}
