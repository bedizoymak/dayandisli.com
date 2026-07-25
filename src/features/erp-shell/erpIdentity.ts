const STATIC_ERP_USER = {
  email: "bedizoymak@eclipsemuhendislik.com",
} as const;

export function useErpIdentity() {
  return {
    erpUser: STATIC_ERP_USER,
    roles: ["admin"],
    signOut: async () => undefined,
  };
}
