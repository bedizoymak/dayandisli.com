import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Loader2 } from "lucide-react";
import { PublicPageLayout } from "@/pages/PublicPageLayout";
import { listPublicMenus } from "./api";
import { WebsiteMenuItem } from "@/features/erp/shared/types";

export default function SitemapPage() {
  const [menus, setMenus] = useState<WebsiteMenuItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    listPublicMenus().then(setMenus).finally(() => setLoading(false));
  }, []);

  return (
    <PublicPageLayout>
      <section className="mx-auto max-w-5xl px-4 py-16">
        <h1 className="text-3xl font-bold text-white">Site Haritası</h1>
        <p className="mt-3 text-white/70">Yayındaki site bağlantıları ERP menü kayıtlarından hazırlanır.</p>
        {loading ? (
          <div className="mt-10 flex items-center gap-2 text-white/70"><Loader2 className="h-5 w-5 animate-spin" /> Yükleniyor...</div>
        ) : (
          <div className="mt-8 grid gap-3 sm:grid-cols-2">
            {menus.map((item) => (
              <Link key={item.id} to={item.path} className="rounded-lg border border-white/10 bg-white/5 p-4 text-white transition hover:border-primary">
                {item.label}
              </Link>
            ))}
          </div>
        )}
      </section>
    </PublicPageLayout>
  );
}
