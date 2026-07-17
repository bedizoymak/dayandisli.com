import { InvoiceLikeDetailPage } from "./InvoiceLikeDetailPage";

export default function PurchaseBillDetailPage() {
  return <InvoiceLikeDetailPage resource="purchase_bills" title="Alış Faturası Detayı" partyLabel="Tedarikçi" listRoute="/apps/parasut/alislar/faturalar" />;
}
