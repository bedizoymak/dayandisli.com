import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";

export default function PurchasingPage() {
  return (
    <ERPLayout title="Satın Alma">
      <PageHeader
        title="Satın Alma ve Tedarik"
        description="Hammadde, takım, sarf malzeme ve fason tedarik siparişlerini yönetin."
        actions={<Button asChild><Link to="/erp/purchase-orders">Satın Alma Siparişleri</Link></Button>}
      />

      <div className="grid gap-4 md:grid-cols-3">
        <Card>
          <CardHeader><CardTitle className="text-base">Tedarik Planı</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Kritik stoklardan satın alma ihtiyacı çıkarma sonraki fazda genişletilecek.</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Açık Siparişler</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Satın alma siparişleri ekranından takip edilir.</CardContent>
        </Card>
        <Card>
          <CardHeader><CardTitle className="text-base">Teslim Alma</CardTitle></CardHeader>
          <CardContent className="text-sm text-muted-foreground">Teslim alınan kalemler otomatik stok giriş hareketi oluşturur.</CardContent>
        </Card>
      </div>
    </ERPLayout>
  );
}
