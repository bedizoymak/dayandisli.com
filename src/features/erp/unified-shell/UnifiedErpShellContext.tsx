import { createContext, ReactNode, useContext } from "react";

const UnifiedErpShellContext = createContext(false);

export function UnifiedErpShellProvider({ children }: { children: ReactNode }) {
  return <UnifiedErpShellContext.Provider value={true}>{children}</UnifiedErpShellContext.Provider>;
}

// Lets a page's own ERPLayout/ParasutLayout call detect it is already mounted
// inside UnifiedErpShell and render only its content frame instead of a second
// sidebar/topbar, without resorting to pathname-based CSS hiding.
export function useIsInsideUnifiedErpShell() {
  return useContext(UnifiedErpShellContext);
}
