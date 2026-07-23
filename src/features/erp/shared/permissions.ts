import { erpApplications } from "../apps/applicationRegistry";
import { getCurrentERPUser } from "./erpApi";
import { ERPRole, ERPUser } from "./types";

export { getCurrentERPUser };

export type PermissionAction = "view" | "create" | "edit" | "delete" | "export" | "manage";

export type RoleDefinition = {
  id: ERPRole;
  label: string;
  description: string;
  permissions: string[];
};

export const PERMISSION_ACTION_LABELS: Record<PermissionAction, string> = {
  view: "Görüntüleme",
  create: "Oluşturma",
  edit: "Düzenleme",
  delete: "Silme",
  export: "Dışa Aktarma",
  manage: "Yönetim",
};

export const ROLE_LABELS: Record<ERPRole, string> = {
  admin: "Süper Yönetici",
  planner: "Yönetici",
  sales: "Satış",
  operator: "Üretim",
  finance: "Finans",
  purchasing: "Satın Alma",
  warehouse: "Depo",
  hr: "İnsan Kaynakları",
  quality: "Kalite",
  viewer: "Misafir",
};

const allApplicationPermissions = erpApplications.flatMap((app) => [
  app.permissionKey,
  ...app.modules.map((module) => module.permissionKey),
]).filter(Boolean) as string[];

export const PERMISSION_CATALOG = Array.from(
  new Set([
    "system.manage",
    "users.view",
    "users.create",
    "users.edit",
    "users.delete",
    "roles.view",
    "roles.manage",
    "permissions.view",
    "permissions.manage",
    "dashboard.view",
    "settings.admin",
    ...allApplicationPermissions,
    "sales.create",
    "sales.edit",
    "sales.export",
    "finance.create",
    "finance.edit",
    "finance.export",
    "production.create",
    "production.edit",
    "inventory.create",
    "inventory.edit",
    "purchasing.create",
    "purchasing.edit",
    "hr.departments",
    "hr.positions",
    "hr.attendance",
    "hr.leave",
    "hr.recruitment",
    "hr.onboarding",
    "hr.manage",
    "quality.edit",
    "reports.export",
    "parasut.sync.view",
    "accounting.contacts.create",
    "accounting.outbound.view",
  ])
).sort();

// Reserved for admin or an explicit per-user grant only — see
// DAYANDISLI_PHASE_SYSTEM_V3.md §8.8 "Default safest policy: admin allowed,
// explicit permission allowed, finance role alone: denied". Both permissions
// gate the bidirectional write path (server/erp/commands/create-customer-command.ts)
// and must never be silently inherited through a role's wildcard match.
const OUTBOUND_WRITE_ONLY_PERMISSIONS = ["accounting.contacts.create", "accounting.outbound.view"];

const salesPermissions = PERMISSION_CATALOG.filter((permission) => permission.startsWith("sales.") || permission.startsWith("crm.") || permission === "dashboard.view");
// Finance gets base Paraşüt access ("parasut.view") only — NOT "parasut.sync.view".
// Do not widen this to `permission.startsWith("parasut.")`: that would also match
// "parasut.sync.view" and grant finance a permission reserved for admin/system.manage
// or an explicit per-user grant (see resolveAccess in supabase/functions/parasut-api).
// Also excludes OUTBOUND_WRITE_ONLY_PERMISSIONS despite matching "accounting." —
// see that constant's own doc comment.
const financePermissions = PERMISSION_CATALOG.filter(
  (permission) =>
    (permission.startsWith("finance.") || permission.startsWith("accounting.") || permission.startsWith("invoicing.") || permission.startsWith("expenses.") || permission === "parasut.view" || permission === "dashboard.view") &&
    !OUTBOUND_WRITE_ONLY_PERMISSIONS.includes(permission),
);
const productionPermissions = PERMISSION_CATALOG.filter((permission) => permission.startsWith("production.") || permission.startsWith("maintenance.") || permission.startsWith("repair.") || permission === "dashboard.view");
const purchasingPermissions = PERMISSION_CATALOG.filter((permission) => permission.startsWith("purchasing.") || permission.startsWith("inventory.purchasing") || permission === "dashboard.view");
const inventoryPermissions = PERMISSION_CATALOG.filter((permission) => permission.startsWith("inventory.") || permission === "dashboard.view");
const qualityPermissions = PERMISSION_CATALOG.filter((permission) => permission.startsWith("quality.") || permission === "dashboard.view");

export const ROLE_DEFINITIONS: RoleDefinition[] = [
  { id: "admin", label: "Süper Yönetici", description: "Tüm ERP uygulama, kullanıcı, rol ve ayar alanlarını yönetir.", permissions: PERMISSION_CATALOG },
  { id: "planner", label: "Yönetici", description: "Operasyonel modülleri yönetir, kullanıcı yönetimi dışında geniş erişim alır.", permissions: PERMISSION_CATALOG.filter((permission) => !permission.startsWith("users.delete")) },
  { id: "sales", label: "Satış", description: "CRM, teklif, sipariş ve satış faaliyetlerini yönetir.", permissions: salesPermissions },
  { id: "operator", label: "Üretim", description: "Üretim, bakım, tamir ve stok görüntüleme alanlarına erişir.", permissions: [...productionPermissions, ...inventoryPermissions.filter((permission) => permission.endsWith(".view") || permission === "inventory.items")] },
  { id: "finance", label: "Finans", description: "Fatura, muhasebe, ödeme, gider ve finans rapor alanlarına erişir.", permissions: financePermissions },
  { id: "purchasing", label: "Satın Alma", description: "Satın alma talepleri, siparişleri ve tedarik süreçlerine erişir.", permissions: purchasingPermissions },
  { id: "warehouse", label: "Depo", description: "Stok, depo ve hareket kayıtlarına erişir.", permissions: inventoryPermissions },
  { id: "hr", label: "İnsan Kaynakları", description: "Personel ve zaman kayıtları alanlarına erişir.", permissions: PERMISSION_CATALOG.filter((permission) => permission.startsWith("hr.") || permission === "dashboard.view") },
  { id: "quality", label: "Kalite", description: "Kalite kontrol ve ölçüm kayıtlarına erişir.", permissions: qualityPermissions },
  { id: "viewer", label: "Misafir", description: "Kontrol paneli ve kendisine açılan görüntüleme alanlarını izler.", permissions: ["dashboard.view"] },
];

export const FOUNDATION_ROLE_OPTIONS = [
  { id: "admin", label: "Süper Yönetici", description: "Tam yetkili sistem rolü." },
  { id: "planner", label: "Yönetici", description: "Operasyonel yönetim rolü." },
  { id: "sales", label: "Satış", description: "Satış ve CRM odaklı rol." },
  { id: "finance", label: "Finans", description: "Finans, muhasebe ve fatura rolü." },
  { id: "operator", label: "Üretim", description: "Üretim operasyon rolü." },
  { id: "purchasing", label: "Satın Alma", description: "Tedarik ve satın alma rolü." },
  { id: "warehouse", label: "Depo", description: "Stok ve depo operasyon rolü." },
  { id: "hr", label: "İnsan Kaynakları", description: "Personel süreçleri rolü." },
  { id: "quality", label: "Kalite", description: "Kalite kontrol rolü." },
  { id: "viewer", label: "Misafir", description: "Sınırlı görüntüleme rolü." },
] as const;

export const FOUNDATION_ROLE_PERMISSION_MAP: Record<string, string[]> = {
  admin: PERMISSION_CATALOG,
  planner: ROLE_DEFINITIONS.find((role) => role.id === "planner")?.permissions ?? [],
  sales: salesPermissions,
  finance: financePermissions,
  operator: productionPermissions,
  purchasing: purchasingPermissions,
  warehouse: inventoryPermissions,
  hr: PERMISSION_CATALOG.filter((permission) => permission.startsWith("hr.") || permission === "dashboard.view"),
  quality: qualityPermissions,
  viewer: ["dashboard.view"],
};

export function getUserRoles(user: ERPUser | null) {
  if (!user) return [] as string[];
  const roles = new Set<string>([user.role, ...(user.roles ?? [])].filter(Boolean));
  return Array.from(roles);
}

export function getUserPermissions(user: ERPUser | null) {
  if (!user) return [] as string[];
  const permissions = new Set<string>();
  for (const role of getUserRoles(user)) {
    const mapped = FOUNDATION_ROLE_PERMISSION_MAP[role] ?? ROLE_DEFINITIONS.find((item) => item.id === role)?.permissions ?? [];
    mapped.forEach((permission) => permissions.add(permission));
  }
  (user.permissions ?? []).forEach((permission) => permissions.add(permission));
  return Array.from(permissions);
}

export function hasPermission(user: ERPUser | null, permission?: string | null) {
  if (!permission) return true;
  if (!user) return false;
  if (getUserRoles(user).includes("admin")) return true;
  return getUserPermissions(user).includes(permission);
}

export function hasAnyPermission(user: ERPUser | null, permissions: Array<string | undefined | null>) {
  const required = permissions.filter(Boolean) as string[];
  if (required.length === 0) return true;
  return required.some((permission) => hasPermission(user, permission));
}

export function hasRole(user: ERPUser | null, roles: ERPRole[]) {
  if (!user) return false;
  const userRoles = getUserRoles(user);
  if (userRoles.includes("admin")) return true;
  return roles.some((role) => userRoles.includes(role));
}

export function canManageERP(user: ERPUser | null) {
  return hasPermission(user, "system.manage") || hasRole(user, ["admin", "planner"]);
}

export function canManageUsers(user: ERPUser | null) {
  return hasPermission(user, "users.edit") || hasPermission(user, "roles.manage");
}

export function canEditProduction(user: ERPUser | null) {
  return hasRole(user, ["admin", "planner", "operator"]) || hasPermission(user, "production.edit");
}

export function canEditFinance(user: ERPUser | null) {
  return hasRole(user, ["admin", "finance"]) || hasPermission(user, "finance.edit");
}

export function canViewReports(user: ERPUser | null) {
  return hasRole(user, ["admin", "planner", "finance", "viewer"]) || hasPermission(user, "reports.view");
}

export function filterApplicationsByPermission(user: ERPUser | null) {
  return erpApplications.filter((app) => hasPermission(user, app.permissionKey));
}

export function filterModulesByPermission<T extends { requiredPermission?: string; visible?: boolean }>(modules: T[], user: ERPUser | null) {
  return modules.filter((module) => module.visible !== false && hasPermission(user, module.requiredPermission));
}

const ROUTE_PERMISSIONS: Array<[RegExp, string]> = [
  [/^\/apps\/parasut\/senkronizasyon/, "parasut.sync.view"],
  [/^\/apps\/parasut/, "parasut.view"],
  [/^\/apps\/calculator(?:\/|$)/, "production.view"],
  [/^\/apps\/shop-orders(?:\/|$)/, "commerce.view"],
  [/^\/apps\/settings/, "settings.view"],
  [/^\/apps\/website/, "website.view"],
  [/^\/apps\/crm/, "crm.view"],
  [/^\/apps\/sales/, "sales.view"],
  [/^\/apps\/commerce/, "commerce.view"],
  [/^\/apps\/inventory/, "inventory.view"],
  [/^\/apps\/purchasing/, "purchasing.view"],
  [/^\/apps\/production/, "production.view"],
  [/^\/apps\/repair/, "production.view"],
  [/^\/apps\/maintenance/, "maintenance.view"],
  [/^\/apps\/quality/, "quality.view"],
  [/^\/apps\/accounting/, "finance.view"],
  [/^\/apps\/invoicing/, "finance.view"],
  [/^\/apps\/expenses/, "finance.view"],
  [/^\/apps\/reports/, "reports.view"],
  [/^\/apps\/hr/, "hr.view"],
  [/^\/ayarlar(?:\/|$)|^\/settings(?:\/|$)/, "settings.view"],
  [/^\/musteriler|^\/tedarikciler|^\/crm|^\/paydaslar|^\/stakeholders/, "crm.view"],
  [/^\/teklifler|^\/siparisler|^\/satis-faaliyetleri|^\/quotations|^\/sales-orders|^\/sales-activities/, "sales.view"],
  [/^\/finans|^\/finance|^\/invoices|^\/payments/, "finance.view"],
  [/^\/inventory|^\/inventory-movements/, "inventory.view"],
  [/^\/purchasing|^\/purchase-orders/, "purchasing.view"],
  [/^\/commerce/, "commerce.view"],
  [/^\/website/, "website.view"],
  [/^\/production|^\/work-orders|^\/routes|^\/subcontracting|^\/calculator/, "production.view"],
  [/^\/logistics|^\/shipments/, "production.view"],
  [/^\/kargo/, "inventory.view"],
  [/^\/quality/, "quality.view"],
  [/^\/maintenance/, "maintenance.view"],
  [/^\/documents/, "production.view"],
  [/^\/reports|^\/health/, "reports.view"],
  [/^\/hr|^\/time-entries/, "hr.view"],
  [/^\/notifications|^\/bildirimler|^\/gorevler|^\/notlar/, "dashboard.view"],
  [/^\/admin/, "settings.admin"],
  [/^\/dashboard|^\/$/, "dashboard.view"],
];

export function getRequiredPermissionForPath(pathname: string) {
  const normalized = pathname.replace(/^\/erp/, "") || "/";
  const directMatch = ROUTE_PERMISSIONS.find(([pattern]) => pattern.test(normalized));
  if (directMatch) return directMatch[1];

  // Real ERP module pages now mount under the unified /apps/* shell (e.g.
  // /apps/finans, /apps/musteriler, /apps/work-orders) without their own
  // dedicated /apps/... entry above — those entries only exist for the
  // application-registry's own synthetic /apps/<id> routes (sales, invoicing,
  // accounting, ...). Retry with the /apps prefix stripped so nested shell
  // routes resolve to exactly the same permission as their pre-migration bare
  // path, instead of silently falling back to the permissive dashboard.view.
  if (normalized === "/apps" || normalized.startsWith("/apps/")) {
    const withoutApps = normalized.replace(/^\/apps/, "") || "/";
    const fallbackMatch = ROUTE_PERMISSIONS.find(([pattern]) => pattern.test(withoutApps));
    if (fallbackMatch) return fallbackMatch[1];
  }

  return "dashboard.view";
}

export async function getCurrentERPUserSafe() {
  const result = await getCurrentERPUser();
  return result.data;
}
