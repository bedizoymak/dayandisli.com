export type OperationalTone = "success" | "warning" | "danger" | "muted" | "default";

export type HealthStatus = "healthy" | "warning" | "critical" | "unknown";

export type OperationalMetric = {
  key: string;
  label: string;
  value: number | string;
  description: string;
  tone: OperationalTone;
};

export type HealthItem = {
  key: string;
  title: string;
  status: HealthStatus;
  value: string;
  description: string;
};

export type AlertDefinition = {
  key: string;
  title: string;
  severity: "bilgi" | "uyarı" | "kritik";
  active: boolean;
  count: number;
  description: string;
};

export type PlatformTimelineEvent = {
  id: string;
  module: string;
  title: string;
  description: string;
  actor: string;
  companyId?: string | null;
  branchId?: string | null;
  createdAt: string;
  tone: OperationalTone;
};

export function healthTone(status: HealthStatus): OperationalTone {
  if (status === "healthy") return "success";
  if (status === "warning") return "warning";
  if (status === "critical") return "danger";
  return "muted";
}

export function percentage(part: number, total: number) {
  if (!total) return "0%";
  return `${Math.round((part / total) * 100)}%`;
}

export function summarizeStatus(count: number, warningLimit: number, criticalLimit: number): HealthStatus {
  if (count >= criticalLimit) return "critical";
  if (count >= warningLimit) return "warning";
  return "healthy";
}

export function buildMetric(key: string, label: string, value: number | string, description: string, tone: OperationalTone = "default"): OperationalMetric {
  return { key, label, value, description, tone };
}

export function sortTimeline(events: PlatformTimelineEvent[]) {
  return [...events].sort((left, right) => right.createdAt.localeCompare(left.createdAt));
}
