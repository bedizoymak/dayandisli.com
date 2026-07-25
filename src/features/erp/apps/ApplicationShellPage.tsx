import { Link, Navigate, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft, ChevronRight, LockKeyhole, LogOut } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { useERPAuth } from "@/contexts/ERPAuthContext";
import { getErpApplication } from "./applicationRegistry";

export default function ApplicationShellPage() {
  const { appId } = useParams();
  const navigate = useNavigate();
  const app = getErpApplication(appId);
  const { hasPermission, signOut } = useERPAuth();

  if (!app) return <Navigate to="/apps" replace />;
  if (!hasPermission(app.permissionKey)) return <Navigate to="/apps" replace />;

  const modules = app.modules.filter((module) => hasPermission(module.permissionKey));

  const handleLogout = async () => {
    await signOut();
    navigate("/login", { replace: true });
  };

  return (
    <main className="erp-theme erp-shell">
      <header className="border-b border-border/80 bg-erp-surface/95 shadow-lg shadow-black/10 backdrop-blur">
        <div className="mx-auto flex min-h-16 max-w-7xl items-center justify-between gap-4 px-4 md:px-6">
          <div className="min-w-0">
            <div className="flex items-center gap-2 text-xs text-muted-foreground">
              <Link to="/apps" className="hover:text-primary">Uygulamalar</Link>
              <ChevronRight className="h-3.5 w-3.5" />
              <span className="truncate font-medium text-foreground">{app.title}</span>
            </div>
            <h1 className="mt-1 truncate text-lg font-semibold md:text-xl">{app.title}</h1>
          </div>
          <div className="flex shrink-0 items-center gap-2">
            <Button asChild variant="outline" size="sm">
              <Link to="/apps">
                <ArrowLeft className="mr-2 h-4 w-4" />
                Uygulamalara Dön
              </Link>
            </Button>
            <Button variant="ghost" size="sm" onClick={handleLogout} className="text-muted-foreground hover:text-foreground">
              <LogOut className="mr-2 h-4 w-4" />
              Çıkış Yap
            </Button>
          </div>
        </div>
      </header>

      <section className="mx-auto max-w-7xl px-4 py-6 md:px-6 md:py-8">
        <div className="erp-surface mb-6 rounded-lg p-5">
          <div className="flex flex-col gap-4 md:flex-row md:items-center md:justify-between">
            <div className="flex items-start gap-4">
              <div className="erp-icon-surface flex h-14 w-14 shrink-0 items-center justify-center rounded-lg">
                <app.icon className="h-7 w-7" />
              </div>
              <div>
                <h2 className="text-2xl font-semibold tracking-tight">{app.title}</h2>
                <p className="mt-2 max-w-2xl text-sm leading-relaxed text-muted-foreground">{app.description}</p>
              </div>
            </div>
            {app.permissionKey ? (
              <Badge variant="outline" className="w-fit gap-1.5">
                <LockKeyhole className="h-3.5 w-3.5" />
                Yetki hazır
              </Badge>
            ) : null}
          </div>
        </div>

        <div className="grid gap-5 lg:grid-cols-[280px_minmax(0,1fr)]">
          <aside className="erp-surface rounded-lg p-3">
            <p className="px-2 pb-2 text-xs font-semibold uppercase tracking-[0.16em] text-muted-foreground">Modüller</p>
            <nav className="space-y-1">
              {modules.map((module) => (
                <Link
                  key={`${module.title}-${module.route}`}
                  to={module.route}
                  className="block rounded-md px-3 py-2 text-sm font-medium text-muted-foreground hover:bg-muted/70 hover:text-foreground"
                >
                  {module.title}
                </Link>
              ))}
            </nav>
          </aside>

          <section className="min-w-0">
            <div className="mb-3 flex items-center justify-between gap-3">
              <div>
                <h3 className="text-base font-semibold">Uygulama Modülleri</h3>
                <p className="text-sm text-muted-foreground">Mevcut ERP ekranlarına hızlı geçiş ve gelecekteki genişleme alanları.</p>
              </div>
            </div>

            <div className="grid gap-3 md:grid-cols-2 xl:grid-cols-3">
              {modules.map((module) => (
                <Card key={`${module.title}-${module.route}`} className="erp-surface rounded-lg">
                  <CardContent className="flex h-full flex-col p-4">
                    <div className="flex items-start justify-between gap-3">
                      <h4 className="font-semibold leading-tight">{module.title}</h4>
                      <Badge variant={module.status === "planned" ? "secondary" : "outline"}>
                        {module.status === "planned" ? "Planlandı" : "Aktif"}
                      </Badge>
                    </div>
                    <p className="mt-2 flex-1 text-sm leading-relaxed text-muted-foreground">{module.description}</p>
                    {module.permissionKey ? <p className="mt-3 text-xs text-muted-foreground">Yetki anahtarı hazır</p> : null}
                    <Button asChild className="mt-4 w-full" variant={module.status === "planned" ? "outline" : "default"}>
                      <Link to={module.route}>{module.status === "planned" ? "Alanı Gör" : "Aç"}</Link>
                    </Button>
                  </CardContent>
                </Card>
              ))}
              {modules.length === 0 ? (
                <Card className="erp-surface rounded-lg">
                  <CardContent className="p-6 text-sm text-muted-foreground">
                    Bu uygulamada görüntüleyebileceğiniz modül bulunmuyor.
                  </CardContent>
                </Card>
              ) : null}
            </div>
          </section>
        </div>
      </section>
    </main>
  );
}
