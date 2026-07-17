import { useQuery } from "@tanstack/react-query";
import { callParasutApi } from "./client";
import type {
  ContactDetailResponse,
  DashboardResponse,
  InvoiceLikeDetailResponse,
  ListQueryParams,
  ListResponse,
  ParasutListResource,
  ReportsResponse,
  SimpleDetailResponse,
  SyncRunDetailResponse,
  SyncStatusResponse,
} from "../types";

// Mirrored data changes only when a sync job runs (not on every user
// interaction), so a moderately long stale time avoids redundant refetches
// on component remounts while still feeling reasonably fresh.
const STALE_TIME_MS = 60_000;

export function useParasutDashboard() {
  return useQuery({
    queryKey: ["parasut", "dashboard"],
    queryFn: async () => {
      const result = await callParasutApi<DashboardResponse>("dashboard");
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    staleTime: STALE_TIME_MS,
  });
}

export function useParasutList<TRow = unknown>(resource: ParasutListResource, params: ListQueryParams) {
  return useQuery({
    queryKey: ["parasut", "list", resource, params],
    queryFn: async () => {
      const result = await callParasutApi<ListResponse<TRow>>("list", { resource, ...params });
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    staleTime: STALE_TIME_MS,
    placeholderData: (previous) => previous,
  });
}

export function useParasutInvoiceLikeDetail(resource: "sales_invoices" | "purchase_bills", parasutId: string | undefined) {
  return useQuery({
    queryKey: ["parasut", "detail", resource, parasutId],
    queryFn: async () => {
      const result = await callParasutApi<InvoiceLikeDetailResponse>("detail", { resource, parasutId });
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(parasutId),
    staleTime: STALE_TIME_MS,
  });
}

export function useParasutContactDetail(resource: "customers" | "suppliers", parasutId: string | undefined) {
  return useQuery({
    queryKey: ["parasut", "detail", resource, parasutId],
    queryFn: async () => {
      const result = await callParasutApi<ContactDetailResponse>("detail", { resource, parasutId });
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(parasutId),
    staleTime: STALE_TIME_MS,
  });
}

export function useParasutSimpleDetail<TAttributes>(resource: "products" | "accounts" | "payments", parasutId: string | undefined) {
  return useQuery({
    queryKey: ["parasut", "detail", resource, parasutId],
    queryFn: async () => {
      const result = await callParasutApi<SimpleDetailResponse<TAttributes>>("detail", { resource, parasutId });
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(parasutId),
    staleTime: STALE_TIME_MS,
  });
}

export function useParasutSyncRunDetail(runId: string | undefined) {
  return useQuery({
    queryKey: ["parasut", "detail", "sync_runs", runId],
    queryFn: async () => {
      const result = await callParasutApi<SyncRunDetailResponse>("detail", { resource: "sync_runs", parasutId: runId });
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    enabled: Boolean(runId),
    staleTime: STALE_TIME_MS,
  });
}

export function useParasutReports() {
  return useQuery({
    queryKey: ["parasut", "reports"],
    queryFn: async () => {
      const result = await callParasutApi<ReportsResponse>("reports");
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    staleTime: STALE_TIME_MS,
  });
}

export function useParasutSyncStatus(params: { page?: number; pageSize?: number }) {
  return useQuery({
    queryKey: ["parasut", "sync-status", params],
    queryFn: async () => {
      const result = await callParasutApi<SyncStatusResponse>("sync-status", params);
      if (result.error) throw new Error(result.error);
      return result.data;
    },
    staleTime: STALE_TIME_MS,
    placeholderData: (previous) => previous,
  });
}
