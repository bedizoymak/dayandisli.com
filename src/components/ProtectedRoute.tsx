import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { getCurrentERPUser } from "@/features/erp/shared/erpApi";
import { getRequiredPermissionForPath, hasPermission } from "@/features/erp/shared/permissions";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

interface SettingsRow {
  auth_enabled: boolean;
}

export default function ProtectedRoute({ children }: ProtectedRouteProps) {
  const [loading, setLoading] = useState(true);
  const [isAuthenticated, setIsAuthenticated] = useState(false);
  const [isAllowed, setIsAllowed] = useState(false);
  const [redirectTo, setRedirectTo] = useState("/login");
  const location = useLocation();

  useEffect(() => {
    const checkAccess = async () => {
      localStorage.setItem("auth_redirect_path", `${location.pathname}${location.search}`);

      if (!isSupabaseConfigured) {
        setLoading(false);
        return;
      }

      const { data: settingsData, error: settingsError } = (await supabase
        .from("settings")
        .select("auth_enabled")
        .eq("id", "1")
        .maybeSingle()) as { data: SettingsRow | null; error: unknown };

      if (settingsError) {
        if (import.meta.env.DEV) console.error("Settings error:", settingsError);
      }

      if (settingsData && settingsData.auth_enabled === false) {
        setIsAuthenticated(true);
        setIsAllowed(true);
        setLoading(false);
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        setLoading(false);
        return;
      }

      const { data: adminUser, error: adminError } = await supabase
        .from("admin_users" as never)
        .select("email, is_active")
        .eq("email", session.user.email)
        .eq("is_active", true)
        .maybeSingle();

      if (adminError) {
        if (import.meta.env.DEV) console.error("Admin yetki kontrol hatası:", adminError);
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (adminUser) {
        setIsAuthenticated(true);
        const erpUserResult = await getCurrentERPUser();
        const requiredPermission = getRequiredPermissionForPath(location.pathname);
        const allowed = hasPermission(erpUserResult.data, requiredPermission);
        setIsAllowed(allowed);
        if (!allowed) setRedirectTo("/apps");
      } else {
        await supabase.auth.signOut();
      }

      setLoading(false);
    };

    checkAccess();
  }, [location.pathname, location.search]);

  if (loading) {
    return (
      <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
        <div className="w-full max-w-sm rounded-xl border border-white/10 bg-white/5 p-6 text-center shadow-xl">
          <img src={`${import.meta.env.BASE_URL}logo-header.png`} alt="Dayan Dişli" className="mx-auto mb-4 h-12 w-auto object-contain" />
          <p className="text-sm text-slate-300">ERP yetki kontrolü yapılıyor...</p>
        </div>
      </div>
    );
  }

  if (!isAuthenticated || !isAllowed) {
    return <Navigate to={redirectTo} replace />;
  }

  return <>{children}</>;
}
