import { ReactNode } from "react";
import { Card, CardContent } from "@/components/ui/card";

type StatCardProps = {
  title: string;
  value: string | number;
  description?: string;
  icon?: ReactNode;
};

export function StatCard({ title, value, description, icon }: StatCardProps) {
  return (
    <Card className="border-border/80 bg-card">
      <CardContent className="p-5">
        <div className="flex items-start justify-between gap-4">
          <div className="min-w-0">
            <p className="text-sm text-muted-foreground">{title}</p>
            <p className="mt-2 text-2xl font-semibold tracking-tight text-foreground">{value}</p>
            {description ? <p className="mt-2 text-xs text-muted-foreground">{description}</p> : null}
          </div>
          {icon ? <div className="rounded-lg bg-primary/10 p-2.5 text-primary">{icon}</div> : null}
        </div>
      </CardContent>
    </Card>
  );
}
