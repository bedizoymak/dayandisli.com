import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "./AdminLayout";
import { AdminEmptyState, AdminSection } from "./AdminPage";

export default function AdminSettings() {
  const { toast } = useToast();
  const [authEnabled, setAuthEnabled] = useState(true);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("settings" as never)
      .select("auth_enabled")
      .eq("id" as never, 1 as never)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        if (data && "auth_enabled" in data) setAuthEnabled(Boolean(data.auth_enabled));
        setLoading(false);
      });
  }, []);

  const save = async () => {
    const { error } = await supabase
      .from("settings" as never)
      .upsert({ id: 1, auth_enabled: authEnabled, updated_at: new Date().toISOString() } as never);
    if (error) {
      toast({ title: "Ayar kaydedilemedi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ayarlar kaydedildi" });
  };

  return (
    <AdminLayout title="Ayarlar" description="Admin ve ERP erişim ayarları">
      <AdminSection title="Erişim Kontrolü">
        {loading ? (
          <AdminEmptyState message="Ayarlar yükleniyor..." />
        ) : error ? (
          <AdminEmptyState message={error} />
        ) : (
          <div className="space-y-4">
            <label className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox checked={authEnabled} onCheckedChange={(value) => setAuthEnabled(Boolean(value))} />
              <span className="text-sm font-medium">Admin/ERP girişinde Supabase Auth kontrolü aktif</span>
            </label>
            <Button onClick={save}>Kaydet</Button>
          </div>
        )}
      </AdminSection>

      <AdminSection title="Marka Uyarlaması">
        <div className="grid gap-3 text-sm text-slate-600 md:grid-cols-2">
          <div className="rounded-md border p-3">Logo: public/logo-header.png</div>
          <div className="rounded-md border p-3">Alan adı: dayandisli.com</div>
          <div className="rounded-md border p-3">Ürün modeli: products, product_images</div>
          <div className="rounded-md border p-3">Operasyon modeli: ERP Supabase tabloları</div>
        </div>
      </AdminSection>
    </AdminLayout>
  );
}
