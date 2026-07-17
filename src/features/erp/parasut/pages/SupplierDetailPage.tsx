import { ContactDetailPage } from "./ContactDetailPage";

export default function SupplierDetailPage() {
  return <ContactDetailPage resource="suppliers" title="Tedarikçi Kartı" listRoute="/apps/parasut/alislar/tedarikciler" documentBasePath="/apps/parasut/alislar/faturalar" />;
}
