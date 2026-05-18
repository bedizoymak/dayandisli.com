import { useEffect, useState } from "react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import { getCurrentERPUser } from "../shared/erpApi";
import { canManageERP } from "../shared/permissions";
import { ERPUser } from "../shared/types";

export default function ERPSettingsPage() {
  const [user, setUser] = useState<ERPUser | null>(null);

  useEffect(() => {
    const load = async () => {
      const result = await getCurrentERPUser();
      setUser(result.data);
    };
    load();
  }, []);

  const canEdit = canManageERP(user);

  return (
    <ERPLayout title="Sistem Ayarları">
      <PageHeader
        title="Sistem Ayarları"
        description="ERP yetkilendirme, modül konfigürasyonu ve numaralandırma yönetimi bu alandan ilerletilecektir."
      />

      <div className="rounded-md border bg-card p-4 text-sm">
        <p className="font-medium">Aktif ERP Rolü: <StatusBadge label={user?.role || "viewer"} tone={canEdit ? "success" : "muted"} /></p>
        {!canEdit ? <p className="mt-2 text-muted-foreground">Bu kullanıcı ayarları görüntüleyebilir; yönetim aksiyonları admin/planner rolü gerektirir.</p> : null}
      </div>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Güvenlik İlkeleri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>- Kimlik doğrulama Supabase Auth email/password ile çalışır.</p>
            <p>- Yetkilendirme için `admin_users` ve `erp_users` tabloları kullanılır.</p>
            <p>- Frontend rol kontrolü kullanıcı deneyimini düzenler; kesin güvenlik için RLS politikaları gerekir.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Numaralandırma</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>- `erp_number_sequences` tablosu sipariş, iş emri, sevkiyat, kalite ve satın alma no üretimi için ayrılmıştır.</p>
            <p>- `next_erp_number(sequence_key)` fonksiyonu ERP referans no üretiminde kullanılır.</p>
          </CardContent>
        </Card>
      </div>
    </ERPLayout>
  );
}
