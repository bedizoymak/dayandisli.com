export type MockNotificationCategory = "assigned" | "system" | "activity";

export type MockNotification = {
  id: string;
  title: string;
  description: string;
  category: MockNotificationCategory;
  time: string;
  unread: boolean;
};

export const mockNotifications: MockNotification[] = [];
