import { Link } from "react-router-dom";
import type { LucideIcon } from "lucide-react";
import { ArrowUpRight } from "lucide-react";
import { Card, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "./StatusBadge";
import type { ErpModuleStatus } from "@/config/erpModules";
import { cn } from "@/lib/utils";

type ModuleCardProps = {
  title: string;
  description: string;
  path: string;
  icon: LucideIcon;
  status?: ErpModuleStatus;
  className?: string;
};

const statusLabel: Record<ErpModuleStatus, string> = {
  active: "Aktif",
  beta: "Geliştiriliyor",
  soon: "Yakında",
};

export function ModuleCard({ title, description, path, icon: Icon, status = "active", className }: ModuleCardProps) {
  return (
    <Link to={path} className="block h-full">
      <Card className={cn("group h-full border-border/80 bg-card transition-all hover:-translate-y-0.5 hover:border-primary/40 hover:shadow-md", className)}>
        <CardHeader className="space-y-4">
          <div className="flex items-start justify-between gap-3">
            <div className="flex h-11 w-11 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Icon className="h-5 w-5" />
            </div>
            <ArrowUpRight className="h-4 w-4 text-muted-foreground transition-transform group-hover:-translate-y-0.5 group-hover:translate-x-0.5 group-hover:text-primary" />
          </div>
          <div className="space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="text-base">{title}</CardTitle>
              <StatusBadge label={statusLabel[status]} tone={status === "active" ? "success" : status === "beta" ? "warning" : "muted"} />
            </div>
            <CardDescription>{description}</CardDescription>
          </div>
        </CardHeader>
      </Card>
    </Link>
  );
}
