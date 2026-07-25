import { ReactNode } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { AdminMetric } from "./adminData";

export function AdminMetricGrid({ metrics }: { metrics: AdminMetric[] }) {
  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
      {metrics.map((metric) => (
        <Card key={metric.label} className="rounded-md">
          <CardHeader className="p-4 pb-2">
            <CardTitle className="text-sm font-medium text-slate-500">{metric.label}</CardTitle>
          </CardHeader>
          <CardContent className="p-4 pt-0">
            <div className="text-2xl font-semibold">{metric.value}</div>
            {metric.detail ? <p className="mt-1 text-xs text-slate-500">{metric.detail}</p> : null}
          </CardContent>
        </Card>
      ))}
    </div>
  );
}

export function AdminSection({ title, children, action }: { title: string; children: ReactNode; action?: ReactNode }) {
  return (
    <section className="rounded-md border bg-white">
      <div className="flex items-center justify-between gap-3 border-b px-4 py-3">
        <h2 className="font-semibold">{title}</h2>
        {action}
      </div>
      <div className="p-4">{children}</div>
    </section>
  );
}

export function AdminEmptyState({ message }: { message: string }) {
  return <div className="rounded-md border border-dashed bg-slate-50 px-4 py-8 text-center text-sm text-slate-500">{message}</div>;
}
