import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/PageHeader";
import { ERPLayout } from "../layout/ERPLayout";

export default function ERPSettingsPage() {
  return (
    <ERPLayout title="Sistem Ayarlari">
      <PageHeader
        title="Sistem Ayarlari"
        description="ERP yetkilendirme, modül konfigürasyonu ve numaralandirma yönetimi bu alandan ilerletilecektir."
      />

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Güvenlik İlkeleri</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>- Kimlik dogrulama Supabase Auth email/password ile çalisir.</p>
            <p>- Yetkilendirme için `admin_users` ve `erp_users` tablolari kullanilir.</p>
            <p>- ERP tablolarinda RLS aktiftir, delete policy varsayilan olarak tanimli degildir.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Numaralandirma</CardTitle>
          </CardHeader>
          <CardContent className="text-sm text-muted-foreground space-y-2">
            <p>- `erp_number_sequences` tablosu sipariş/iş emri/sevkiyat/kalite no üretimi için ayrılmıştır.</p>
            <p>- `next_erp_number(sequence_key)` fonksiyonu ERP referans no üretiminde kullanilabilir.</p>
          </CardContent>
        </Card>
      </div>
    </ERPLayout>
  );
}
