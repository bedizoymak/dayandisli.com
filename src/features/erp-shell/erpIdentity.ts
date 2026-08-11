import { useERPAuth } from "@/contexts/ERPAuthContext";

export function useErpIdentity() {
  return useERPAuth();
}
