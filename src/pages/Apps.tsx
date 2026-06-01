import { Link, useNavigate } from "react-router-dom";
import { LogOut } from "lucide-react";
import { Button } from "@/components/ui/button";
import { supabase } from "@/integrations/supabase/client";
import { erpApplications } from "@/features/erp/apps/applicationRegistry";

export default function Apps() {
  const navigate = useNavigate();

  const handleLogout = async () => {
    await supabase.auth.signOut();
    localStorage.removeItem("auth_redirect_path");
    navigate("/login", { replace: true });
  };

  return (
    <main className="min-h-screen bg-[#f3f5f8] text-slate-950">
      <header className="border-b border-slate-200 bg-white/95 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <Link to="/apps" className="flex min-w-0 items-center gap-3">
            <img src={`${import.meta.env.BASE_URL}logo-header.png`} alt="Dayan Dişli" className="h-10 w-auto object-contain" />
            <div className="min-w-0">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-blue-700">Dayan Dişli</p>
              <h1 className="truncate text-base font-semibold">Uygulamalar</h1>
            </div>
          </Link>
          <Button variant="outline" size="sm" onClick={handleLogout}>
            <LogOut className="mr-2 h-4 w-4" />
            Çıkış Yap
          </Button>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="mb-6">
          <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">ERP Uygulamaları</h2>
          <p className="mt-2 max-w-2xl text-sm text-slate-600">
            Günlük operasyonlar için ihtiyacınız olan uygulamayı seçin. Yetkilendirme desteği için uygulama kayıtları hazırlandı.
          </p>
        </div>

        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {erpApplications.map((app) => (
            <Link
              key={app.id}
              to={app.route}
              className="group flex min-h-36 flex-col rounded-lg border border-slate-200 bg-white p-4 shadow-sm transition hover:-translate-y-0.5 hover:border-blue-200 hover:shadow-md focus:outline-none focus:ring-2 focus:ring-blue-600 focus:ring-offset-2"
            >
              <div className="mb-4 flex h-12 w-12 items-center justify-center rounded-lg bg-blue-50 text-blue-700 transition group-hover:bg-blue-600 group-hover:text-white">
                <app.icon className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold leading-tight">{app.title}</h3>
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-slate-500">{app.description}</p>
            </Link>
          ))}
        </div>
      </section>
    </main>
  );
}
