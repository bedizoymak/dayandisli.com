import { getCurrentERPUser } from "./erpApi";
import { ERPRole, ERPUser } from "./types";

export { getCurrentERPUser };

export function hasRole(user: ERPUser | null, roles: ERPRole[]) {
  if (!user) return false;
  if (user.role === "admin") return true;
  return roles.includes(user.role);
}

export function canManageERP(user: ERPUser | null) {
  return hasRole(user, ["admin", "planner"]);
}

export function canEditProduction(user: ERPUser | null) {
  return hasRole(user, ["admin", "planner", "operator"]);
}

export function canEditFinance(user: ERPUser | null) {
  return hasRole(user, ["admin", "finance"]);
}

export function canViewReports(user: ERPUser | null) {
  return hasRole(user, ["admin", "planner", "finance", "viewer"]);
}

export async function getCurrentERPUserSafe() {
  const result = await getCurrentERPUser();
  return result.data;
}
