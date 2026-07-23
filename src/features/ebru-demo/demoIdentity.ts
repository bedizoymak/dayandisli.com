const DEMO_ERP_USER = {
  email: "bedizoymak@eclipsemuhendislik.com",
} as const;

export function useDemoIdentity() {
  return {
    erpUser: DEMO_ERP_USER,
    roles: ["admin"],
    signOut: async () => undefined,
  };
}
