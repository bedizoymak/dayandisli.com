import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPModuleCard } from "../layout/ERPModuleCard";
import { Factory, GitBranch, HardHat } from "lucide-react";

export default function ProductionPage() {
  return (
    <ERPLayout title="Üretim Yönetimi">
      <PageHeader
        title="Üretim Yönetimi"
        description="Is emri, rota ve operasyon takibini üretim odakli ekranlardan yönetin."
        actions={
          <Button asChild>
            <Link to="/apps/calculator">DAYAN Calculator</Link>
          </Button>
        }
      />

      <div className="grid gap-4 md:grid-cols-3">
        <ERPModuleCard title="Is Emirleri" description="Planlama, durum takibi ve operasyon yönetimi" href="/erp/work-orders" icon={<HardHat className="h-5 w-5" />} />
        <ERPModuleCard title="Rota Yönetimi" description="Operasyon sirasi ve makine plani" href="/erp/routes" icon={<GitBranch className="h-5 w-5" />} />
        <ERPModuleCard title="Genel Üretim" description="Üretim KPI ve özet görünüm" href="/erp/dashboard" icon={<Factory className="h-5 w-5" />} />
      </div>
    </ERPLayout>
  );
}
