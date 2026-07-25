import { ClipboardList } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/erp/EmptyState";
import { FilterDrawer } from "@/components/erp/FilterDrawer";
import { PageHeader } from "@/components/erp/PageHeader";
import { ViewToggle, type ViewMode } from "@/components/erp/ViewToggle";
import { useState } from "react";
import { ERPLayout } from "@/features/erp/layout/ERPLayout";

export default function TasksPage() {
  const [view, setView] = useState<ViewMode>("table");

  return (
    <ERPLayout title="Görevler">
      <PageHeader
        title="Görevler"
        description="Atanan işler, takip maddeleri ve günlük operasyon görevleri için hazırlanan alan."
        actions={
          <>
            <FilterDrawer />
            <ViewToggle value={view} onChange={setView} />
          </>
        }
      />
      <EmptyState
        icon={<ClipboardList className="h-6 w-6" />}
        title="Görev modülü hazırlanıyor"
        description="Bu ekran rol bazlı görev atama ve takip akışı için ayrıldı. Şimdilik üretim verisine yazma yapılmaz."
        action={<Button disabled>Yeni Görev - Yakında</Button>}
      />
    </ERPLayout>
  );
}
