import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { getCurrentERPUser } from "@/features/erp/shared/erpApi";
import { getRequiredPermissionForPath, hasPermission } from "@/features/erp/shared/permissions";

type ProtectedRouteProps = {
  children: React.ReactNode;
};

type AuthGateState = {
  status: "checking" | "allowed" | "login" | "denied";
  redirectTo: string;
};

function LoadingScreen() {
  return (
    <div className="flex min-h-screen items-center justify-center bg-slate-950 px-4 text-white">
      <div className="w-full max-w-sm rounded-xl border border-white/10 bg-white/5 p-6 text-center shadow-xl">
        <img src={`${import.meta.env.BASE_URL}logo-header.png`} alt="Dayan Dişli" className="mx-auto mb-4 h-12 w-auto object-contain" />
        <p className="text-sm text-slate-300">ERP yetki kontrolü yapılıyor...</p>
      </div>
    </div>
  );
}

export function RequireAuth({ children }: ProtectedRouteProps) {
  const [gate, setGate] = useState<AuthGateState>({ status: "checking", redirectTo: "/login" });
  const location = useLocation();

  useEffect(() => {
    let isMounted = true;

    const checkAccess = async () => {
      localStorage.setItem("auth_redirect_path", `${location.pathname}${location.search}`);
      setGate({ status: "checking", redirectTo: "/login" });

      if (!isSupabaseConfigured) {
        if (isMounted) setGate({ status: "login", redirectTo: "/login" });
        return;
      }

      const {
        data: { session },
      } = await supabase.auth.getSession();

      if (!session?.user?.email) {
        if (isMounted) setGate({ status: "login", redirectTo: "/login" });
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
        if (isMounted) setGate({ status: "login", redirectTo: "/login" });
        return;
      }

      if (!adminUser) {
        await supabase.auth.signOut();
        if (isMounted) setGate({ status: "login", redirectTo: "/login" });
        return;
      }

      const erpUserResult = await getCurrentERPUser();
      const requiredPermission = getRequiredPermissionForPath(location.pathname);
      const allowed = hasPermission(erpUserResult.data, requiredPermission);

      if (isMounted) setGate(allowed ? { status: "allowed", redirectTo: "" } : { status: "denied", redirectTo: "/apps" });
    };

    checkAccess();

    return () => {
      isMounted = false;
    };
  }, [location.pathname, location.search]);

  if (gate.status === "checking") return <LoadingScreen />;

  if (gate.status !== "allowed") return <Navigate to={gate.redirectTo} replace state={{ from: location }} />;

  return <>{children}</>;
}

export default RequireAuth;
