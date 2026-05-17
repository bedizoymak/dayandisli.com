import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

type MetricCardProps = {
  title: string;
  value: number;
  icon?: ReactNode;
  subtitle?: string;
};

export function MetricCard({ title, value, icon, subtitle }: MetricCardProps) {
  return (
    <Card>
      <CardContent className="p-5">
        <div className="flex items-start justify-between">
          <div>
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="text-2xl font-bold mt-1">{value}</p>
            {subtitle ? <p className="text-xs text-muted-foreground mt-2">{subtitle}</p> : null}
          </div>
          {icon ? <div className="text-primary">{icon}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
