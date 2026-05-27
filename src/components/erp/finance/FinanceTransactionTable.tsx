import { Link } from "react-router-dom";
import { Eye } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ACCOUNT_TYPE_LABELS, formatMoney, TRANSACTION_STATUS_LABELS, TRANSACTION_TYPE_LABELS } from "@/lib/finance/financeLabels";
import type { FinancialTransaction } from "@/lib/finance/financeTypes";
import { PaymentMethodBadge } from "./PaymentMethodBadge";

type FinanceTransactionTableProps = {
  transactions: FinancialTransaction[];
  compact?: boolean;
};

function dateLabel(value: string) {
  return new Intl.DateTimeFormat("tr-TR").format(new Date(value));
}

function statusTone(status: FinancialTransaction["status"]) {
  if (status === "completed") return "success" as const;
  if (status === "cancelled") return "danger" as const;
  return "warning" as const;
}

export function FinanceTransactionTable({ transactions, compact = false }: FinanceTransactionTableProps) {
  return (
    <Card className="overflow-hidden border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tarih</TableHead>
            {!compact ? <TableHead>Firma</TableHead> : null}
            <TableHead>Tip</TableHead>
            <TableHead>Hesap</TableHead>
            <TableHead>Yöntem</TableHead>
            <TableHead>Tutar</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Açıklama</TableHead>
            <TableHead className="text-right">Aksiyonlar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {transactions.map((transaction) => (
            <TableRow key={transaction.id}>
              <TableCell>{dateLabel(transaction.transaction_date)}</TableCell>
              {!compact ? <TableCell className="font-medium">{transaction.party?.title || "-"}</TableCell> : null}
              <TableCell>{TRANSACTION_TYPE_LABELS[transaction.transaction_type]}</TableCell>
              <TableCell>{ACCOUNT_TYPE_LABELS[transaction.account_type]}</TableCell>
              <TableCell>
                <PaymentMethodBadge method={transaction.payment_method} />
              </TableCell>
              <TableCell>{formatMoney(transaction.amount, transaction.currency)}</TableCell>
              <TableCell>
                <StatusBadge label={TRANSACTION_STATUS_LABELS[transaction.status]} tone={statusTone(transaction.status)} />
              </TableCell>
              <TableCell className="max-w-[260px] truncate">{transaction.description || "-"}</TableCell>
              <TableCell className="text-right">
                <Button asChild variant="ghost" size="icon" title="Görüntüle">
                  <Link to={`/finans/hareketler/${transaction.id}`}>
                    <Eye className="h-4 w-4" />
                  </Link>
                </Button>
              </TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
