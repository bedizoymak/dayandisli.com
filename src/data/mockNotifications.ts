export type MockNotificationCategory = "assigned" | "system" | "activity";

export type MockNotification = {
  id: string;
  title: string;
  description: string;
  category: MockNotificationCategory;
  time: string;
  unread: boolean;
};

export const mockNotifications: MockNotification[] = [
  {
    id: "assigned-quotation-followup",
    title: "Teklif takibi bekliyor",
    description: "Açık teklifler için müşteri dönüşleri kontrol edilebilir.",
    category: "assigned",
    time: "Bugün",
    unread: true,
  },
  {
    id: "system-erp-shell",
    title: "ERP paneli hazırlandı",
    description: "Modül navigasyonu ve yeni dashboard görünümü devrede.",
    category: "system",
    time: "Sistem",
    unread: true,
  },
  {
    id: "activity-calculator",
    title: "Calculator modülü aktif",
    description: "Dişli hesaplama araçları ERP altında erişilebilir.",
    category: "activity",
    time: "Son işlem",
    unread: false,
  },
];
