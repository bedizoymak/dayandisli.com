import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { formatMoney, PAYMENT_DOCUMENT_STATUS_LABELS, PAYMENT_DOCUMENT_TYPE_LABELS } from "@/lib/finance/financeLabels";
import type { PaymentDocument } from "@/lib/finance/financeTypes";

type PaymentDocumentTableProps = {
  documents: PaymentDocument[];
};

function dateLabel(value?: string | null) {
  if (!value) return "-";
  return new Intl.DateTimeFormat("tr-TR").format(new Date(value));
}

export function PaymentDocumentTable({ documents }: PaymentDocumentTableProps) {
  return (
    <Card className="overflow-hidden border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>Tür</TableHead>
            <TableHead>Belge No</TableHead>
            <TableHead>Vade Tarihi</TableHead>
            <TableHead>Banka</TableHead>
            <TableHead>Tutar</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead>Bağlı Firma</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {documents.map((document) => (
            <TableRow key={document.id}>
              <TableCell>{PAYMENT_DOCUMENT_TYPE_LABELS[document.document_type]}</TableCell>
              <TableCell>{document.document_no || "-"}</TableCell>
              <TableCell>{dateLabel(document.due_date)}</TableCell>
              <TableCell>{document.bank_name || "-"}</TableCell>
              <TableCell>{formatMoney(document.amount, document.currency)}</TableCell>
              <TableCell>
                <Badge variant="outline">{PAYMENT_DOCUMENT_STATUS_LABELS[document.status]}</Badge>
              </TableCell>
              <TableCell>{document.party?.title || "-"}</TableCell>
            </TableRow>
          ))}
        </TableBody>
      </Table>
    </Card>
  );
}
