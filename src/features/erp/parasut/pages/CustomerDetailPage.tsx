import { ContactDetailPage } from "./ContactDetailPage";

export default function CustomerDetailPage() {
  return <ContactDetailPage resource="customers" title="Müşteri Kartı" listRoute="/apps/parasut/satislar/musteriler" documentBasePath="/apps/parasut/satislar/faturalar" />;
}
