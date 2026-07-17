import { InvoiceLikeListPage } from "./InvoiceLikeListPage";

export default function SalesInvoicesPage() {
  return (
    <InvoiceLikeListPage
      resource="sales_invoices"
      title="Faturalar"
      description="Paraşüt aynasına senkronize edilmiş satış faturaları."
      partyLabel="Müşteri"
      detailBasePath="/apps/parasut/satislar/faturalar"
    />
  );
}
