import { InvoiceLikeListPage } from "./InvoiceLikeListPage";

export default function PurchaseBillsPage() {
  return (
    <InvoiceLikeListPage
      resource="purchase_bills"
      title="Alış Faturaları"
      description="Paraşüt aynasına senkronize edilmiş alış faturaları."
      partyLabel="Tedarikçi"
      detailBasePath="/apps/parasut/alislar/faturalar"
    />
  );
}
