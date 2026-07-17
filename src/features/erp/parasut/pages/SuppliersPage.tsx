import { ContactListPage } from "./ContactListPage";

export default function SuppliersPage() {
  return <ContactListPage resource="suppliers" title="Tedarikçiler" description="Paraşüt aynasında account_type = supplier olarak işaretli cariler." detailBasePath="/apps/parasut/alislar/tedarikciler" />;
}
