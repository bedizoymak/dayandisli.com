import { ContactListPage } from "./ContactListPage";

export default function CustomersPage() {
  return (
    <ContactListPage
      resource="customers"
      title="Müşteriler"
      description="Paraşüt aynasında account_type = customer olarak işaretli cariler."
      detailBasePath="/apps/parasut/satislar/musteriler"
    />
  );
}
