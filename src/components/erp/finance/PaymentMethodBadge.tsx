import { Badge } from "@/components/ui/badge";
import { PAYMENT_METHOD_LABELS } from "@/lib/finance/financeLabels";
import type { PaymentMethod } from "@/lib/finance/financeTypes";

export function PaymentMethodBadge({ method }: { method?: PaymentMethod | null }) {
  if (!method) return <Badge variant="outline">-</Badge>;
  return <Badge variant="outline">{PAYMENT_METHOD_LABELS[method]}</Badge>;
}
