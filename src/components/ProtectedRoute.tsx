import { Navigate, useLocation } from "react-router-dom";
import { useERPAuth } from "@/contexts/ERPAuthContext";
import { getRequiredPermissionForPath } from "@/features/erp/shared/permissions";

type ProtectedRouteProps = {
  children: React.ReactNode;
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
  const location = useLocation();
  const { hasPermission, isAuthorizedERPUser, isAuthenticated, isLoading } = useERPAuth();

  localStorage.setItem("auth_redirect_path", `${location.pathname}${location.search}`);

  if (isLoading) return <LoadingScreen />;
  if (!isAuthenticated || !isAuthorizedERPUser) return <Navigate to="/login" replace state={{ from: location }} />;

  const requiredPermission = getRequiredPermissionForPath(location.pathname);
  if (!hasPermission(requiredPermission)) return <Navigate to="/apps" replace state={{ from: location }} />;

  return <>{children}</>;
}

export default RequireAuth;
