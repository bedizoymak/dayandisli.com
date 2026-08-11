import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { useToast } from "@/hooks/use-toast";
import { supabase } from "@/integrations/supabase/client";
import AdminLayout from "./AdminLayout";
import { AdminEmptyState, AdminSection } from "./AdminPage";

export default function AdminSettings() {
  const { toast } = useToast();
  const [authEnabled, setAuthEnabled] = useState<boolean | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    supabase
      .from("settings")
      .select("auth_enabled")
      .eq("id", 1)
      .maybeSingle()
      .then(({ data, error }) => {
        if (error) setError(error.message);
        if (data && "auth_enabled" in data) setAuthEnabled(Boolean(data.auth_enabled));
        setLoading(false);
      });
  }, []);

  const save = async () => {
    if (authEnabled === null) return;
    const { error } = await supabase
      .from("settings")
      .upsert({ id: 1, auth_enabled: authEnabled, updated_at: new Date().toISOString() });
    if (error) {
      toast({ title: "Ayar kaydedilemedi", description: error.message, variant: "destructive" });
      return;
    }
    toast({ title: "Ayarlar kaydedildi" });
  };

  return (
    <AdminLayout title="Ayarlar" description="Yönetim ve ERP erişim ayarları">
      <AdminSection title="Erişim Kontrolü">
        {loading ? (
          <AdminEmptyState message="Ayarlar yükleniyor..." />
        ) : error ? (
          <AdminEmptyState message={error} />
        ) : authEnabled === null ? (
          <AdminEmptyState message="Henüz erişim ayarı yok." />
        ) : (
          <div className="space-y-4">
            <label className="flex items-center gap-3 rounded-md border p-3">
              <Checkbox checked={authEnabled} onCheckedChange={(value) => setAuthEnabled(Boolean(value))} />
              <span className="text-sm font-medium">Yönetim ve ERP girişinde Supabase kimlik kontrolü aktif</span>
            </label>
            <Button onClick={save}>Kaydet</Button>
          </div>
        )}
      </AdminSection>

      <AdminSection title="Marka Uyarlaması">
        <AdminEmptyState message="Henüz marka yapılandırması yok." />
      </AdminSection>
    </AdminLayout>
  );
}
