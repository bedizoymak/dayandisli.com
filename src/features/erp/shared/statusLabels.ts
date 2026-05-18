import {
  InventoryItemType,
  InventoryMovementType,
  MaintenanceStatus,
  PurchaseOrderStatus,
  QualityResult,
  SalesOrderStatus,
  ShipmentStatus,
  StakeholderType,
  SubcontractingStatus,
  WorkOrderOperationStatus,
  WorkOrderStatus,
} from "./types";

export const SALES_ORDER_STATUS_LABELS: Record<SalesOrderStatus, string> = {
  new: "Yeni",
  confirmed: "Onaylandı",
  in_production: "Üretimde",
  waiting_subcontractor: "Fasonda Bekliyor",
  ready_to_ship: "Sevke Hazır",
  shipped: "Sevk Edildi",
  invoiced: "Faturalandı",
  closed: "Kapandı",
  cancelled: "İptal",
};

export const WORK_ORDER_STATUS_LABELS: Record<WorkOrderStatus, string> = {
  planned: "Planlandı",
  released: "Yayınlandı",
  in_progress: "Devam Ediyor",
  paused: "Duraklatıldı",
  waiting_subcontractor: "Fason Bekliyor",
  quality_check: "Kalite Kontrol",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

export const WORK_ORDER_OPERATION_STATUS_LABELS: Record<WorkOrderOperationStatus, string> = {
  pending: "Bekliyor",
  in_progress: "Devam Ediyor",
  paused: "Duraklatıldı",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

export const INVENTORY_ITEM_TYPE_LABELS: Record<InventoryItemType, string> = {
  raw_material: "Hammadde",
  consumable: "Sarf Malzeme",
  tool: "Takım",
  measuring_tool: "Ölçüm Aleti",
  finished_good: "Mamul",
  semi_finished: "Yarı Mamul",
};

export const INVENTORY_MOVEMENT_TYPE_LABELS: Record<InventoryMovementType, string> = {
  in: "Giriş",
  out: "Çıkış",
  adjustment: "Düzeltme",
  reservation: "Rezervasyon",
  return: "İade",
};

export const STAKEHOLDER_TYPE_LABELS: Record<StakeholderType, string> = {
  customer: "Müşteri",
  supplier: "Tedarikçi",
  subcontractor: "Fason",
  both: "Karma",
};

export const SUBCONTRACTING_STATUS_LABELS: Record<SubcontractingStatus, string> = {
  planned: "Planlandı",
  sent: "Gönderildi",
  in_process: "İşlemde",
  returned: "Geri Geldi",
  cancelled: "İptal",
};

export const SHIPMENT_STATUS_LABELS: Record<ShipmentStatus, string> = {
  planned: "Planlandı",
  packed: "Paketlendi",
  shipped: "Sevk Edildi",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
};

export const QUALITY_RESULT_LABELS: Record<QualityResult, string> = {
  pending: "Bekliyor",
  passed: "Geçti",
  failed: "Kaldı",
  conditional: "Şartlı Kabul",
};

export const MAINTENANCE_STATUS_LABELS: Record<MaintenanceStatus, string> = {
  planned: "Planlandı",
  in_progress: "Devam Ediyor",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

export const PURCHASE_ORDER_STATUS_LABELS: Record<PurchaseOrderStatus, string> = {
  draft: "Taslak",
  sent: "Gönderildi",
  partially_received: "Kısmi Geldi",
  received: "Teslim Alındı",
  cancelled: "İptal",
};

export const AUDIT_ACTION_LABELS: Record<string, string> = {
  created: "Oluşturuldu",
  updated: "Güncellendi",
  status_changed: "Durum Değişti",
  quotation_converted: "Siparişe Dönüştürüldü",
  sales_order_converted: "İş Emrine Dönüştürüldü",
  operation_started: "Operasyon Başlatıldı",
  operation_paused: "Operasyon Duraklatıldı",
  operation_completed: "Operasyon Tamamlandı",
  subcontracting_sent: "Fasona Gönderildi",
  subcontracting_returned: "Fason Geri Geldi",
  quality_result_updated: "Kalite Sonucu Güncellendi",
  shipment_status_updated: "Sevkiyat Durumu Güncellendi",
  inventory_movement_created: "Stok Hareketi Oluşturuldu",
  purchase_order_received: "Satın Alma Teslim Alındı",
};
