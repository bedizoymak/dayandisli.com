import { CalendarClock, CreditCard, FileText, ReceiptText, ShoppingBag, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/finance/financeLabels";
import type { PartyFinancialSummary } from "@/lib/finance/financeTypes";

type PartySummaryCardsProps = {
  summary: PartyFinancialSummary;
  mode: "customer" | "supplier";
  orderCount?: number;
  quotationCount?: number;
  purchaseCount?: number;
};

function summaryDate(value: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR").format(new Date(value));
}

export function PartySummaryCards({
  summary,
  mode,
  orderCount = 0,
  quotationCount = 0,
  purchaseCount = 0,
}: PartySummaryCardsProps) {
  const cards =
    mode === "customer"
      ? [
          { title: "Toplam Sipariş", value: orderCount.toString(), icon: ShoppingBag },
          { title: "Toplam Teklif", value: quotationCount.toString(), icon: FileText },
          { title: "Toplam Borç", value: formatMoney(summary.totalDebit), icon: ReceiptText },
          { title: "Toplam Ödeme", value: formatMoney(summary.totalPayment), icon: CreditCard },
          { title: "Güncel Bakiye", value: formatMoney(summary.currentBalance), icon: Wallet },
          { title: "Son İşlem Tarihi", value: summaryDate(summary.lastTransactionDate), icon: CalendarClock },
        ]
      : [
          { title: "Toplam Satın Alma", value: purchaseCount.toString(), icon: ShoppingBag },
          { title: "Toplam Borç", value: formatMoney(summary.totalDebit), icon: ReceiptText },
          { title: "Toplam Ödeme", value: formatMoney(summary.totalPayment), icon: CreditCard },
          { title: "Güncel Bakiye", value: formatMoney(summary.currentBalance), icon: Wallet },
          { title: "Son İşlem Tarihi", value: summaryDate(summary.lastTransactionDate), icon: CalendarClock },
        ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3 2xl:grid-cols-6">
      {cards.map((card) => (
        <Card key={card.title} className="border-border/70">
          <CardHeader className="flex flex-row items-center justify-between gap-3 space-y-0 pb-2">
            <CardTitle className="text-sm font-medium text-muted-foreground">{card.title}</CardTitle>
            <card.icon className="h-4 w-4 text-muted-foreground" />
          </CardHeader>
          <CardContent>
            <div className="text-xl font-semibold">{card.value}</div>
          </CardContent>
        </Card>
      ))}
    </div>
  );
}
