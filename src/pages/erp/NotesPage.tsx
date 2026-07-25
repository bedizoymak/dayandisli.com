import { StickyNote } from "lucide-react";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/erp/EmptyState";
import { FilterDrawer } from "@/components/erp/FilterDrawer";
import { PageHeader } from "@/components/erp/PageHeader";
import { ViewToggle, type ViewMode } from "@/components/erp/ViewToggle";
import { useState } from "react";
import { ERPLayout } from "@/features/erp/layout/ERPLayout";

export default function NotesPage() {
  const [view, setView] = useState<ViewMode>("card");

  return (
    <ERPLayout title="Notlar">
      <PageHeader
        title="Notlar"
        description="Müşteri, teklif ve üretim süreçlerine bağlanabilecek iç not altyapısı."
        actions={
          <>
            <FilterDrawer />
            <ViewToggle value={view} onChange={setView} />
          </>
        }
      />
      <EmptyState
        icon={<StickyNote className="h-6 w-6" />}
        title="Henüz not kaydı yok"
        description="Not modülü için güvenli frontend zemini hazır. Veritabanı şeması eklenmeden kayıt oluşturulmaz."
        action={<Button disabled>Yeni Not - Yakında</Button>}
      />
    </ERPLayout>
  );
}
