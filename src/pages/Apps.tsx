import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { AppsLayout } from "@/features/erp/apps/AppsLayout";
import { erpApplications } from "@/features/erp/apps/applicationRegistry";
import {
  filterApplicationsByPermission,
  getCurrentERPUserSafe,
  getUserPermissions,
  getUserRoles,
} from "@/features/erp/shared/permissions";
import { ERPUser } from "@/features/erp/shared/types";

export default function Apps() {
  const [user, setUser] = useState<ERPUser | null>(null);
  const [isResolvingUser, setIsResolvingUser] = useState(true);

  useEffect(() => {
    let isMounted = true;

    getCurrentERPUserSafe()
      .then((resolvedUser) => {
        if (!isMounted) return;
        setUser(resolvedUser);
      })
      .finally(() => {
        if (!isMounted) return;
        setIsResolvingUser(false);
      });

    return () => {
      isMounted = false;
    };
  }, []);

  const applications = filterApplicationsByPermission(user);
  const resolvedRoles = getUserRoles(user);
  const resolvedPermissions = getUserPermissions(user);
  const missingApplicationPermissions = erpApplications
    .map((app) => app.permissionKey)
    .filter((permissionKey): permissionKey is string => Boolean(permissionKey))
    .filter((permissionKey) => !resolvedPermissions.includes(permissionKey));

  useEffect(() => {
    if (isResolvingUser) return;

    console.info("[Apps] ERP user resolved", {
      user,
      roles: resolvedRoles,
      permissions: resolvedPermissions,
      visibleApplicationsCount: applications.length,
      requiredApplicationPermissions: erpApplications.map((app) => ({
        id: app.id,
        permissionKey: app.permissionKey,
      })),
      missingApplicationPermissions,
    });
  }, [applications.length, isResolvingUser, missingApplicationPermissions, resolvedPermissions, resolvedRoles, user]);

  return (
    <AppsLayout title="Uygulamalar" user={user}>
      <div className="mb-6">
        <h2 className="text-2xl font-semibold tracking-tight md:text-3xl">ERP Uygulamaları</h2>
        <p className="mt-2 max-w-2xl text-sm text-muted-foreground">
          Günlük operasyonlar için ihtiyacınız olan uygulamayı seçin. Yetkilendirme desteği için uygulama kayıtları hazırlandı.
        </p>
      </div>

      {isResolvingUser ? (
        <div className="erp-surface flex min-h-40 items-center justify-center rounded-lg p-6 text-sm font-medium text-muted-foreground">
          Yükleniyor...
        </div>
      ) : applications.length > 0 ? (
        <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4 xl:grid-cols-6">
          {applications.map((app) => (
            <Link
              key={app.id}
              to={app.route}
              className="group erp-surface flex min-h-36 flex-col rounded-lg p-4 transition hover:-translate-y-0.5 hover:border-primary/50 hover:bg-erp-surface-raised/90 focus:outline-none focus:ring-2 focus:ring-primary focus:ring-offset-2 focus:ring-offset-background"
            >
              <div className="erp-icon-surface mb-4 flex h-12 w-12 items-center justify-center rounded-lg transition group-hover:bg-primary group-hover:text-primary-foreground">
                <app.icon className="h-6 w-6" />
              </div>
              <h3 className="text-sm font-semibold leading-tight">{app.title}</h3>
              <p className="mt-2 line-clamp-3 text-xs leading-relaxed text-muted-foreground">{app.description}</p>
            </Link>
          ))}
        </div>
      ) : (
        <div className="erp-surface rounded-lg p-6">
          <div className="max-w-2xl space-y-2">
            <h3 className="text-base font-semibold">Bu kullanıcıya atanmış ERP uygulaması bulunamadı.</h3>
            <p className="text-sm text-muted-foreground">Rol ve yetkilerinizi kontrol edin.</p>
            <div className="grid gap-2 pt-2 text-sm text-muted-foreground sm:grid-cols-2">
              <div>
                <span className="font-medium text-foreground">Kullanıcı:</span> {user?.email ?? "Bulunamadı"}
              </div>
              <div>
                <span className="font-medium text-foreground">Rol:</span> {resolvedRoles.join(", ") || "Atanmamış"}
              </div>
              <div>
                <span className="font-medium text-foreground">Yetki sayısı:</span> {resolvedPermissions.length}
              </div>
              <div>
                <span className="font-medium text-foreground">Görünen uygulama:</span> {applications.length}
              </div>
            </div>
          </div>
        </div>
      )}
    </AppsLayout>
  );
}
