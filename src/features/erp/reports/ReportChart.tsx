import { Area, AreaChart, Bar, BarChart, CartesianGrid, XAxis, YAxis } from "recharts";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ChartContainer, ChartTooltip, ChartTooltipContent } from "@/components/ui/chart";
import { TrendPoint } from "./reportingUtils";

type ReportChartProps = {
  title: string;
  data: TrendPoint[];
  type?: "bar" | "area";
};

export function ReportChart({ title, data, type = "bar" }: ReportChartProps) {
  return (
    <Card className="erp-surface rounded-lg">
      <CardHeader>
        <CardTitle className="text-base">{title}</CardTitle>
      </CardHeader>
      <CardContent>
        {data.length === 0 ? (
          <div className="flex h-56 items-center justify-center rounded-md border border-dashed text-sm text-muted-foreground">
            Grafik için kayıt bulunamadı.
          </div>
        ) : (
          <ChartContainer
            className="h-56 w-full"
            config={{ value: { label: "Değer", color: "hsl(var(--primary))" } }}
          >
            {type === "area" ? (
              <AreaChart data={data}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={36} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Area dataKey="value" type="monotone" fill="var(--color-value)" fillOpacity={0.25} stroke="var(--color-value)" />
              </AreaChart>
            ) : (
              <BarChart data={data}>
                <CartesianGrid vertical={false} />
                <XAxis dataKey="label" tickLine={false} axisLine={false} tickMargin={8} />
                <YAxis tickLine={false} axisLine={false} width={36} />
                <ChartTooltip content={<ChartTooltipContent />} />
                <Bar dataKey="value" fill="var(--color-value)" radius={[4, 4, 0, 0]} />
              </BarChart>
            )}
          </ChartContainer>
        )}
      </CardContent>
    </Card>
  );
}
