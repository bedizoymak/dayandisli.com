import { useQueryClient } from "@tanstack/react-query";
import { ContactListPage } from "./ContactListPage";
import { CreateCustomerDialog } from "../components/CreateCustomerDialog";

export default function CustomersPage() {
  const queryClient = useQueryClient();
  return (
    <ContactListPage
      resource="customers"
      title="Müşteriler"
      description="Paraşüt aynasında account_type = customer olarak işaretli cariler."
      detailBasePath="/apps/parasut/satislar/musteriler"
      actions={<CreateCustomerDialog onCreated={() => void queryClient.invalidateQueries({ queryKey: ["parasut", "list", "customers"] })} />}
    />
  );
}
