import {
  InventoryItemType,
  InventoryMovementType,
  InvoiceStatus,
  InvoiceType,
  MaintenanceStatus,
  MeasurementResult,
  PaymentType,
  PurchaseOrderStatus,
  QualityResult,
  SalesOrderStatus,
  ShipmentStatus,
  StakeholderType,
  SubcontractingStatus,
  WorkOrderOperationStatus,
  WorkOrderStatus,
  FinancialAccountType,
  ERPNotificationCategory,
  ERPNotificationSeverity,
  CRMActivityType,
  CRMLeadStatus,
  CRMOpportunityStatus,
  CRMRelatedType,
  CRMTaskStatus,
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

export const MEASUREMENT_RESULT_LABELS: Record<MeasurementResult, string> = {
  pending: "Bekliyor",
  passed: "Geçti",
  failed: "Kaldı",
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

export const INVOICE_STATUS_LABELS: Record<InvoiceStatus, string> = {
  draft: "Taslak",
  issued: "Kesildi",
  paid: "Ödendi",
  partial: "Kısmi Ödendi",
  cancelled: "İptal",
};

export const INVOICE_TYPE_LABELS: Record<InvoiceType, string> = {
  sales: "Satış",
  purchase: "Alış",
};

export const PAYMENT_TYPE_LABELS: Record<PaymentType, string> = {
  collection: "Tahsilat",
  payment: "Ödeme",
};

export const FINANCIAL_ACCOUNT_TYPE_LABELS: Record<FinancialAccountType, string> = {
  cash: "Kasa",
  bank: "Banka",
  customer: "Müşteri Cari",
  supplier: "Tedarikçi Cari",
};

export const NOTIFICATION_SEVERITY_LABELS: Record<ERPNotificationSeverity, string> = {
  info: "Bilgi",
  success: "Tamamlandı",
  warning: "Dikkat",
  danger: "Kritik",
};

export const NOTIFICATION_CATEGORY_LABELS: Record<ERPNotificationCategory, string> = {
  workflow: "Akış",
  quality: "Kalite",
  subcontracting: "Fason",
  shipment: "Sevkiyat",
  inventory: "Stok",
  maintenance: "Bakım",
  system: "Sistem",
};

export const DOCUMENT_ENTITY_LABELS: Record<string, string> = {
  quotation: "Teklif",
  sales_order: "Satış Siparişi",
  work_order: "İş Emri",
  quality_report: "Kalite Raporu",
  subcontracting_job: "Fason Kaydı",
  inventory_item: "Stok Kartı",
  shipment: "Sevkiyat",
  purchase_order: "Satın Alma Siparişi",
  machine: "Makine",
  employee: "Personel",
};

export const DOCUMENT_TYPE_LABELS: Record<string, string> = {
  technical_drawing: "Teknik Resim",
  cad: "CAD",
  cam: "CAM",
  pdf: "PDF",
  photo: "Fotoğraf",
  invoice: "Fatura",
  delivery_note: "İrsaliye",
  quality_report: "Kalite Raporu",
  other: "Diğer",
};

export const INVENTORY_SOURCE_TYPE_LABELS: Record<string, string> = {
  manual: "Manuel",
  purchase_order: "Satın Alma",
  sales_order: "Satış Siparişi",
  work_order: "İş Emri",
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
  work_order_completed: "İş Emri Tamamlandı",
  subcontracting_sent: "Fasona Gönderildi",
  subcontracting_returned: "Fason Geri Geldi",
  quality_report_created: "Kalite Raporu Oluştu",
  quality_result_updated: "Kalite Sonucu Güncellendi",
  shipment_status_updated: "Sevkiyat Durumu Güncellendi",
  delivery_completed: "Teslim Tamamlandı",
  inventory_movement_created: "Stok Hareketi Oluşturuldu",
  purchase_order_received: "Satın Alma Teslim Alındı",
};

export const CRM_LEAD_STATUS_LABELS: Record<CRMLeadStatus, string> = {
  new: "Yeni",
  contacted: "İletişime Geçildi",
  qualified: "Nitelikli",
  converted: "Fırsata Dönüştü",
  lost: "Kaybedildi",
};

export const CRM_OPPORTUNITY_STATUS_LABELS: Record<CRMOpportunityStatus, string> = {
  open: "Açık",
  proposal: "Teklif Aşaması",
  won: "Kazanıldı",
  lost: "Kaybedildi",
  cancelled: "İptal",
};

export const CRM_TASK_STATUS_LABELS: Record<CRMTaskStatus, string> = {
  open: "Açık",
  in_progress: "Devam Ediyor",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

export const CRM_ACTIVITY_TYPE_LABELS: Record<CRMActivityType, string> = {
  note: "Not",
  call: "Telefon",
  meeting: "Toplantı",
  email: "E-posta",
  visit: "Ziyaret",
  status_change: "Durum Değişimi",
};

export const CRM_RELATED_TYPE_LABELS: Record<CRMRelatedType, string> = {
  lead: "Potansiyel Müşteri",
  opportunity: "Fırsat",
  stakeholder: "Firma",
  quotation: "Teklif",
  sales_order: "Sipariş",
};
