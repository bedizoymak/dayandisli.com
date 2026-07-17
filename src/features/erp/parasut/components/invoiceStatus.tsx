import { StatusBadge } from "@/components/erp/StatusBadge";
import type { InvoiceLikeAttributes } from "../types";

/**
 * Derives a display status purely from confirmed fields (remaining balance,
 * days_overdue, archived flag) rather than the unconfirmed `payment_status`
 * enum — we've only ever observed "paid" in real captures, so the full value
 * set isn't known and shouldn't be guessed at. `Number()` is safe here (unlike
 * summation elsewhere) because this only checks a single value against zero.
 */
export function InvoiceStatusBadge({ attributes }: { attributes: Pick<InvoiceLikeAttributes, "remaining" | "days_overdue" | "archived"> }) {
  const remaining = Number(attributes.remaining ?? 0);
  if (attributes.archived) return <StatusBadge label="Arşivlendi" tone="muted" />;
  if (!(remaining > 0)) return <StatusBadge label="Tahsil Edildi" tone="success" />;
  if ((attributes.days_overdue ?? 0) > 0) return <StatusBadge label="Gecikmiş" tone="danger" />;
  return <StatusBadge label="Açık" tone="warning" />;
}
