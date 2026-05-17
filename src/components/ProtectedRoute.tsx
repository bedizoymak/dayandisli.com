import { useEffect, useState } from "react";
import { Navigate, useLocation } from "react-router-dom";
import { supabase } from "@/integrations/supabase/client";

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
  const location = useLocation();

  useEffect(() => {
    const checkAccess = async () => {
      localStorage.setItem("auth_redirect_path", location.pathname);

      const { data: settingsData, error: settingsError } = (await supabase
        .from("settings" as never)
        .select("auth_enabled")
        .eq("id", "1")
        .maybeSingle()) as { data: SettingsRow | null; error: unknown };

      if (settingsError) {
        console.error("Settings error:", settingsError);
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
        console.error("Admin yetki kontrol hatasi:", adminError);
        await supabase.auth.signOut();
        setLoading(false);
        return;
      }

      if (adminUser) {
        setIsAuthenticated(true);
        setIsAllowed(true);
      } else {
        await supabase.auth.signOut();
      }

      setLoading(false);
    };

    checkAccess();
  }, [location.pathname]);

  if (loading) return null;

  if (!isAuthenticated || !isAllowed) {
    return <Navigate to="/login" replace />;
  }

  return <>{children}</>;
}
