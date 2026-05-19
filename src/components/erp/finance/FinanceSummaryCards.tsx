import { AlertTriangle, Banknote, CircleDollarSign, CreditCard, ReceiptText, Wallet } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { formatMoney } from "@/lib/finance/financeLabels";
import type { FinanceDashboardSummary } from "@/lib/finance/financeTypes";

type FinanceSummaryCardsProps = {
  summary: FinanceDashboardSummary;
};

export function FinanceSummaryCards({ summary }: FinanceSummaryCardsProps) {
  const cards = [
    { title: "Toplam Alacak", value: formatMoney(summary.totalReceivable), icon: CircleDollarSign },
    { title: "Toplam Borç", value: formatMoney(summary.totalPayable), icon: ReceiptText },
    { title: "Tahsil Edilen", value: formatMoney(summary.collected), icon: Banknote },
    { title: "Ödenen", value: formatMoney(summary.paid), icon: CreditCard },
    { title: "Bekleyen Ödemeler", value: summary.pendingPayments.toString(), icon: Wallet },
    { title: "Vadesi Geçenler", value: summary.overduePayments.toString(), icon: AlertTriangle },
    { title: "Resmi Hesap Bakiyesi", value: formatMoney(summary.officialBalance), icon: CircleDollarSign },
    { title: "Operasyonel Takip Bakiyesi", value: formatMoney(summary.operationalBalance), icon: Wallet },
  ];

  return (
    <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
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
