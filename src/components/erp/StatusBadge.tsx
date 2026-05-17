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

export function StatusBadge({ label, tone = "default" }: StatusBadgeProps) {
  return <Badge className={toneClassMap[tone]}>{label}</Badge>;
}
