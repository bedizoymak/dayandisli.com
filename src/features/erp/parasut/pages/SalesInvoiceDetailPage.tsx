import { InvoiceLikeDetailPage } from "./InvoiceLikeDetailPage";

export default function SalesInvoiceDetailPage() {
  return <InvoiceLikeDetailPage resource="sales_invoices" title="Fatura Detayı" partyLabel="Müşteri" listRoute="/apps/parasut/satislar/faturalar" />;
}
