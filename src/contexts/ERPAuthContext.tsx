import { createContext, ReactNode, useCallback, useContext, useEffect, useMemo, useRef, useState } from "react";
import type { Session, User } from "@supabase/supabase-js";
import { isSupabaseConfigured, supabase } from "@/integrations/supabase/client";
import { createAuditLog } from "@/features/erp/shared/api/internal";
import { getCurrentERPUser } from "@/features/erp/shared/auth";
import { getUserPermissions, getUserRoles } from "@/features/erp/shared/permissions";
import type { ERPUser } from "@/features/erp/shared/types";

type ERPAuthState = {
  session: Session | null;
  supabaseUser: User | null;
  erpUser: ERPUser | null;
  permissions: string[];
  roles: string[];
  isLoading: boolean;
};

type ERPAuthContextValue = ERPAuthState & {
  isAuthenticated: boolean;
  isAuthorizedERPUser: boolean;
  refreshAuth: () => Promise<void>;
  signOut: () => Promise<void>;
  hasPermission: (permission?: string | null) => boolean;
};

const EMPTY_AUTH_STATE: ERPAuthState = {
  session: null,
  supabaseUser: null,
  erpUser: null,
  permissions: [],
  roles: [],
  isLoading: true,
};

const ERPAuthContext = createContext<ERPAuthContextValue | null>(null);

export function ERPAuthProvider({ children, enabled = true }: { children: ReactNode; enabled?: boolean }) {
  const [state, setState] = useState<ERPAuthState>(EMPTY_AUTH_STATE);
  const requestIdRef = useRef(0);
  // RequireAuth swaps its ENTIRE route tree for a full-screen loader
  // whenever isLoading is true, unmounting every page component (and its
  // scroll position, in-page state, etc). That's correct for the very first
  // resolution on app boot, but re-running it for every later auth event —
  // including ones that fire spontaneously on tab focus — is what made
  // returning to a background tab look like the app resetting to the
  // beginning. Only the first-ever resolution is allowed to set isLoading;
  // every later resolveSession() call updates state in place without ever
  // re-blocking the route tree.
  const hasBootstrappedRef = useRef(false);
  const invalidateRequests = useCallback(() => {
    ++requestIdRef.current;
  }, []);

  const resolveSession = useCallback(async (session: Session | null) => {
    const requestId = ++requestIdRef.current;
    const isInitialResolve = !hasBootstrappedRef.current;

    if (!session?.user?.email) {
      hasBootstrappedRef.current = true;
      setState({ ...EMPTY_AUTH_STATE, isLoading: false });
      return;
    }

    setState((current) => ({ ...current, session, supabaseUser: session.user, isLoading: isInitialResolve }));

    const erpUserResult = await getCurrentERPUser();
    if (requestId !== requestIdRef.current) return;
    hasBootstrappedRef.current = true;

    const erpUser = erpUserResult.data;
    if (erpUserResult.error || !erpUser?.is_active) {
      if (erpUserResult.error && import.meta.env.DEV) console.error("ERP yetki kontrol hatası:", erpUserResult.error);
      await supabase.auth.signOut();
      if (requestId === requestIdRef.current) setState({ ...EMPTY_AUTH_STATE, isLoading: false });
      return;
    }

    setState({
      session,
      supabaseUser: session.user,
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
        description: email ? `${email} ERP oturumunu kapattı.` : "ERP oturumu kapatıldı.",
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
      // Supabase's GoTrueClient refreshes the access token on document
      // visibility changes, firing TOKEN_REFRESHED every time this tab
      // regains focus after being backgrounded. The token is still for the
      // same signed-in user with the same permissions — re-running
      // resolveSession() here re-fetched the ERP user and, while loading,
      // made RequireAuth swap the whole route tree for its full-screen
      // "ERP yetki kontrolü yapılıyor..." loader, discarding in-page state
      // and reading as the app resetting on every tab switch. Only events
      // that can actually change who is signed in need to re-resolve.
      if (event === "INITIAL_SESSION" || event === "TOKEN_REFRESHED") return;
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
      isAuthorizedERPUser: Boolean(state.erpUser?.is_active),
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
