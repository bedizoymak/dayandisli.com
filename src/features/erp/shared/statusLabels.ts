import { InventoryItemType, SalesOrderStatus, StakeholderType, WorkOrderStatus } from "./types";

export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  new: "Yeni",
  confirmed: "Onaylandi",
  in_production: "Üretimde",
  waiting_subcontractor: "Fasonda Bekliyor",
  ready_to_ship: "Sevke Hazir",
  shipped: "Sevk Edildi",
  invoiced: "Faturalandi",
  closed: "Kapandi",
  cancelled: "Iptal",
};

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  planned: "Planlandi",
  released: "Yayinlandi",
  in_progress: "Devam Ediyor",
  paused: "Duraklatildi",
  waiting_subcontractor: "Fason Bekliyor",
  quality_check: "Kalite Kontrol",
  completed: "Tamamlandi",
  cancelled: "Iptal",
};

export const INVENTORY_ITEM_TYPE_LABELS: Record<InventoryItemType, string> = {
  raw_material: "Hammadde",
  consumable: "Sarf Malzeme",
  tool: "Takim",
  measuring_tool: "Ölçüm Aleti",
  finished_good: "Mamul",
  semi_finished: "Yari Mamul",
};

export const STAKEHOLDER_TYPE_LABELS: Record<StakeholderType, string> = {
  customer: "Müsteri",
  supplier: "Tedarikçi",
  subcontractor: "Fason",
  both: "Karma",
};

export const SHIPMENT_STATUS_LABELS: Record<string, string> = {
  planned: "Planlandi",
  packed: "Paketlendi",
  shipped: "Sevk Edildi",
  delivered: "Teslim Edildi",
  cancelled: "Iptal",
};

export const QUALITY_RESULT_LABELS: Record<string, string> = {
  pending: "Beklemede",
  passed: "Geçti",
  failed: "Kaldi",
  conditional: "Sartli",
};

export const MAINTENANCE_STATUS_LABELS: Record<string, string> = {
  planned: "Planlandi",
  in_progress: "Devam Ediyor",
  completed: "Tamamlandi",
  cancelled: "Iptal",
};
