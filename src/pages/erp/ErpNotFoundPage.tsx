import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/erp/EmptyState";
import { ERPLayout } from "@/features/erp/layout/ERPLayout";

export default function ErpNotFoundPage() {
  return (
    <ERPLayout title="Sayfa Bulunamadı">
      <EmptyState
        title="ERP sayfası bulunamadı"
        description="Aradığınız ERP ekranı taşınmış veya henüz oluşturulmamış olabilir."
        action={
          <Button asChild>
            <Link to="/apps">Uygulamalara Dön</Link>
          </Button>
        }
      />
    </ERPLayout>
  );
}
