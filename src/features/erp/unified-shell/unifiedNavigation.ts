import { visibleErpModules, type ErpModuleConfig } from "@/config/erpModules";

export type UnifiedNavGroup = {
  id: string;
  label: string;
  items: ErpModuleConfig[];
};

const GROUP_ORDER = ["main", "commercial", "finance", "operations", "people", "system"] as const;

const GROUP_LABELS: Record<(typeof GROUP_ORDER)[number], string> = {
  main: "ANA MENÜ",
  commercial: "TİCARİ",
  finance: "FİNANS",
  operations: "OPERASYON",
  people: "İNSAN VE İÇERİK",
  system: "SİSTEM",
};

// Maps each existing sidebar module id (src/config/erpModules.ts) to the
// Ebru-style navigation group it belongs to. Grouping is derived here rather
// than duplicating module metadata, so permission filtering and route data
// stay defined in exactly one place.
const MODULE_GROUP: Record<string, (typeof GROUP_ORDER)[number]> = {
  dashboard: "main",
  customers: "commercial",
  suppliers: "commercial",
  quotations: "commercial",
  orders: "commercial",
  finance: "finance",
  "parasut-module": "finance",
  cargo: "operations",
  calculator: "operations",
  "production-module": "operations",
  "inventory-module": "operations",
  "purchasing-module": "operations",
  "quality-module": "operations",
  "maintenance-module": "operations",
  logistics: "operations",
  "hr-module": "people",
  "website-module": "people",
  "commerce-module": "people",
  "documents-module": "people",
  tasks: "people",
  notes: "people",
  notifications: "system",
  health: "system",
  "reports-module": "system",
  settings: "system",
};

export function buildUnifiedNavigation(hasPermission: (permission?: string) => boolean): UnifiedNavGroup[] {
  const groups = new Map<string, ErpModuleConfig[]>();

  for (const module of visibleErpModules) {
    if (!hasPermission(module.requiredPermission)) continue;
    const groupId = MODULE_GROUP[module.id] ?? "system";
    const list = groups.get(groupId) ?? [];
    list.push(module);
    groups.set(groupId, list);
  }

  return GROUP_ORDER.filter((id) => (groups.get(id)?.length ?? 0) > 0).map((id) => ({
    id,
    label: GROUP_LABELS[id],
    items: groups.get(id) ?? [],
  }));
}
