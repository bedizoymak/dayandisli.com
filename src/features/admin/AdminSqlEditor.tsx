import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Textarea } from "@/components/ui/textarea";
import AdminLayout from "./AdminLayout";
import { AdminSection } from "./AdminPage";

export default function AdminSqlEditor() {
  const [sql, setSql] = useState("select * from products limit 20;");

  return (
    <AdminLayout title="SQL Düzenleyici" description="Supabase güvenlik sınırlarıyla teknik yönetim">
      <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">
        Bu uygulama doğrudan tarayıcıdan keyfi SQL çalıştırmaz. Supabase projelerinde güvenli yol SQL Editor, migration veya admin-only Edge Function kullanmaktır.
      </div>
      <AdminSection title="Sorgu Notları">
        <Textarea value={sql} onChange={(event) => setSql(event.target.value)} className="min-h-48 font-mono" />
        <div className="mt-3 flex gap-2">
          <Button
            variant="outline"
            onClick={() => navigator.clipboard.writeText(sql)}
          >
            Kopyala
          </Button>
          <Button asChild>
            <a href="https://supabase.com/dashboard" target="_blank" rel="noreferrer">Supabase Yönetim Paneli</a>
          </Button>
        </div>
      </AdminSection>
    </AdminLayout>
  );
}
