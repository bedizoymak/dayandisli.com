import { Link } from "react-router-dom";
import { CrmPageHeader } from "./CrmShared";

const parent = "/apps/crm/customers";

export function CustomerDetailPage(_props: { customerId?: string }) {
  return (
    <div className="crm-page">
      <CrmPageHeader
        current="Müşteri bulunamadı"
        title="Müşteri bulunamadı"
        subtitle="Müşteri kaydı bulunamadı."
      >
        <Link className="crm-back" to={parent}>
          ← Müşteri listesine dön
        </Link>
      </CrmPageHeader>
    </div>
  );
}
