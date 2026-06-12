import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { createAuditLog, getCurrentERPUser } from "@/features/erp/shared/erpApi";
import { getUserPermissions, getUserRoles } from "@/features/erp/shared/permissions";
import type { ERPUser } from "@/features/erp/shared/types";

type ActiveAdminUser = {
  email: string;
  is_active: boolean;
};

type ERPAuthState = {
  session: Session | null;
  supabaseUser: User | null;
  adminUser: ActiveAdminUser | null;
  erpUser: ERPUser | null;
  permissions: string[];
  roles: string[];
  isLoading: boolean;
};

type ERPAuthContextValue = ERPAuthState & {
  isAuthenticated: boolean;
  isActiveAdmin: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission?: string | null) => boolean;
};

const EMPTY_AUTH_STATE: ERPAuthState = {
  session: null,
  supabaseUser: null,
  adminUser: null,
  erpUser: null,
  permissions: [],
  roles: [],
  isLoading: true,
};

const ERPAuthContext = createContext<ERPAuthContextValue | null>(null);

export function ERPAuthProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [state, setState] = useState<ERPAuthState>(EMPTY_AUTH_STATE);
  const requestIdRef = useRef(0);
  const invalidateRequests = useCallback(() => {
    ++requestIdRef.current;
  }, []);

  const resolveSession = useCallback(async (session: Session | null) => {
    const requestId = ++requestIdRef.current;

    if (!session?.user?.email) {
      setState({ ...EMPTY_AUTH_STATE, isLoading: false });
      return;
    }

    setState((current) => ({ ...current, session, supabaseUser: session.user, isLoading: true }));

    const { data: adminUser, error: adminError } = await supabase
      .from("admin_users" as never)
      .select("email, is_active")
      .eq("email", session.user.email)
      .eq("is_active", true)
      .maybeSingle();

    if (requestId !== requestIdRef.current) return;

    if (adminError || !adminUser) {
      if (adminError && import.meta.env.DEV) console.error("Admin yetki kontrol hatası:", adminError);
      await supabase.auth.signOut();
      if (requestId === requestIdRef.current) setState({ ...EMPTY_AUTH_STATE, isLoading: false });
      return;
    }

    const erpUserResult = await getCurrentERPUser();
    if (requestId !== requestIdRef.current) return;

    const erpUser = erpUserResult.data;
    setState({
      session,
      supabaseUser: session.user,
      adminUser: adminUser as ActiveAdminUser,
      erpUser,
      permissions: getUserPermissions(erpUser),
      roles: getUserRoles(erpUser),
      isLoading: false,
    });
  }, []);

  const refreshAuth = useCallback(async () => {
    if (!enabled || !isSupabaseConfigured) {
      setState({ ...EMPTY_AUTH_STATE, isLoading: false });
      return;
    }

    const { data } = await supabase.auth.getSession();
    await resolveSession(data.session);
  }, [enabled, resolveSession]);

  const signOut = useCallback(async () => {
    const email = state.erpUser?.email ?? state.supabaseUser?.email ?? null;

    try {
      await createAuditLog({
        entity_type: "auth_session",
        action: "logout",
        description: `${email ?? "Bilinmeyen kullanıcı"} ERP oturumunu kapattı.`,
        metadata: { email },
      });
    } finally {
      ++requestIdRef.current;
      await supabase.auth.signOut();
      localStorage.removeItem("auth_redirect_path");
      setState({ ...EMPTY_AUTH_STATE, isLoading: false });
    }
  }, [state.erpUser?.email, state.supabaseUser?.email]);

  useEffect(() => {
    if (!enabled || !isSupabaseConfigured) {
      setState({ ...EMPTY_AUTH_STATE, isLoading: false });
      return;
    }

    const { data: listener } = supabase.auth.onAuthStateChange((event, session) => {
      if (event === "INITIAL_SESSION") return;
      queueMicrotask(() => void resolveSession(session));
    });

    void refreshAuth();

    return () => {
      invalidateRequests();
      listener.subscription.unsubscribe();
    };
  }, [enabled, invalidateRequests, refreshAuth, resolveSession]);

  const value = useMemo<ERPAuthContextValue>(
    () => ({
      ...state,
      isAuthenticated: Boolean(state.session),
      isActiveAdmin: Boolean(state.adminUser?.is_active),
      refreshAuth,
      signOut,
      hasPermission: (permission) => {
        if (!permission) return true;
        if (state.roles.includes("admin")) return true;
        return state.permissions.includes(permission);
      },
    }),
    [refreshAuth, signOut, state],
  );

  return <ERPAuthContext.Provider value={value}>{children}</ERPAuthContext.Provider>;
}

export function useERPAuth() {
  const context = useContext(ERPAuthContext);
  if (!context) throw new Error("useERPAuth must be used within ERPAuthProvider");
  return context;
}
