import { useERPAuth } from "@/contexts/ERPAuthContext";
import { getInitials, resolveDisplayName } from "@/features/erp/shared/displayName";

export function useErpIdentity() {
  return useERPAuth();
}

export { getInitials, resolveDisplayName };
