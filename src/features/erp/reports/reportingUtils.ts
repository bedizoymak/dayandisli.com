export type ReportFilters = {
  startDate: string;
  endDate: string;
  department: string;
  module: string;
  status: string;
};

export type KPIItem = {
  title: string;
  value: number | string;
  description?: string;
  tone?: "default" | "success" | "warning" | "danger";
};

export type TrendPoint = {
  label: string;
  value: number;
};

export function isWithinDateRange(value: string | null | undefined, filters: ReportFilters) {
  if (!value) return true;
  const day = value.slice(0, 10);
  if (filters.startDate && day < filters.startDate) return false;
  if (filters.endDate && day > filters.endDate) return false;
  return true;
}

export function countByStatus<T>(rows: T[], statusGetter: (row: T) => string | null | undefined) {
  return rows.reduce<Record<string, number>>((acc, row) => {
    const status = statusGetter(row) || "Tanımsız";
    acc[status] = (acc[status] ?? 0) + 1;
    return acc;
  }, {});
}

export function groupCountByMonth<T>(rows: T[], dateGetter: (row: T) => string | null | undefined) {
  const grouped = rows.reduce<Record<string, number>>((acc, row) => {
    const value = dateGetter(row);
    if (!value) return acc;
    const key = value.slice(0, 7);
    acc[key] = (acc[key] ?? 0) + 1;
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, value]) => ({ label, value }));
}

export function groupSumByMonth<T>(rows: T[], dateGetter: (row: T) => string | null | undefined, valueGetter: (row: T) => number | null | undefined) {
  const grouped = rows.reduce<Record<string, number>>((acc, row) => {
    const value = dateGetter(row);
    if (!value) return acc;
    const key = value.slice(0, 7);
    acc[key] = (acc[key] ?? 0) + Number(valueGetter(row) ?? 0);
    return acc;
  }, {});

  return Object.entries(grouped)
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([label, value]) => ({ label, value }));
}
