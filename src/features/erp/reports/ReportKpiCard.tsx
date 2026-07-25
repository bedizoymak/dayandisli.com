import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { cn } from "@/lib/utils";
import { KPIItem } from "./reportingUtils";

const toneClass: Record<NonNullable<KPIItem["tone"]>, string> = {
  default: "text-foreground",
  success: "text-emerald-300",
  warning: "text-amber-300",
  danger: "text-red-300",
};

export function ReportKpiCard({ title, value, description, tone = "default" }: KPIItem) {
  return (
    <Card className="erp-surface rounded-lg">
      <CardHeader className="pb-2">
        <CardTitle className="text-sm font-medium text-muted-foreground">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        <p className={cn("text-2xl font-semibold", toneClass[tone])}>{value}</p>
        {description ? <p className="mt-1 text-xs text-muted-foreground">{description}</p> : null}
      </CardContent>
    </Card>
  );
}
