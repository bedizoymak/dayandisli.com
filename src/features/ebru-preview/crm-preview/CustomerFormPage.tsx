import { Link, useParams } from "react-router-dom";
import { CrmPageHeader } from "./CrmShared";
import { useParasutContactDetail } from "@/features/erp/parasut/api/queries";
const parent = "/apps/crm/customers";
export function CustomerFormPage({ edit = false }: { edit?: boolean }) {
  const { customerId } = useParams();
  const detail = useParasutContactDetail("customers", edit ? customerId : undefined);
  const attributes = detail.data?.contact.attributes;
  const d = {
    companyName: attributes?.name ?? "",
    personType: attributes?.contact_type === "person" ? "Gerçek Kişi" : "Firma",
    taxNo: attributes?.tax_number ?? "",
    contact: attributes?.short_name ?? "",
    taxOffice: attributes?.tax_office ?? "",
    phone: attributes?.phone ?? "",
    email: attributes?.email ?? "",
    city: attributes?.city ?? "",
    district: attributes?.district ?? "",
    website: "",
    address: attributes?.address ?? "",
    status: attributes?.archived ? "Pasif" : "Aktif",
    accountType: "Resmi Hesap",
    riskLimit: "",
    dueDays: String(attributes?.term_days ?? ""),
    currency: "TRY",
    tags: "",
    notes: "",
  };
  return (
    <div className="crm-page">
      <CrmPageHeader
        current={edit ? "Müşteri Düzenle" : "Yeni Müşteri"}
        title={edit ? "Müşteri Düzenle" : "Yeni Müşteri"}
        subtitle="Müşteri cari kart bilgilerini yönetin."
      >
        <Link className="crm-back" to={parent}>
          ← Geri
        </Link>
        <button className="crm-primary" type="submit" form="crm-customer-form">
          Kaydet
        </button>
      </CrmPageHeader>
      <form
        id="crm-customer-form"
        className="crm-form"
        onSubmit={(e) => e.preventDefault()}
      >
        <section className="ebru-card">
          <h2>Temel Bilgiler</h2>
          <div className="crm-fields">
            <label>
              Firma Ünvanı *
              <input defaultValue={d.companyName} />
            </label>
            <label>
              Kişi Tipi *
              <select defaultValue={d.personType}>
                <option>Firma</option>
                <option>Gerçek Kişi</option>
              </select>
            </label>
            <label>
              TC/VKN *<input defaultValue={d.taxNo} />
            </label>
            <label>
              İlgili Kişi Adı Soyadı
              <input defaultValue={d.contact} />
            </label>
            <label>
              Vergi Dairesi
              <input defaultValue={d.taxOffice} />
            </label>
          </div>
        </section>
        <section className="ebru-card">
          <h2>İletişim ve Adres</h2>
          <div className="crm-fields">
            <label>
              Telefon
              <input defaultValue={d.phone} />
            </label>
            <label>
              Email
              <input type="email" defaultValue={d.email} />
            </label>
            <label>
              İl
              <input defaultValue={d.city} />
            </label>
            <label>
              İlçe
              <input defaultValue={d.district} />
            </label>
            <label>
              Web Sitesi
              <input defaultValue={d.website} />
            </label>
            <label className="wide">
              Adres
              <textarea defaultValue={d.address} />
            </label>
          </div>
        </section>
        <section className="ebru-card">
          <h2>Cari ve Finans Ayarları</h2>
          <div className="crm-fields">
            <label>
              Cari Durum
              <select defaultValue={d.status}>
                <option>Aktif</option>
                <option>Pasif</option>
              </select>
            </label>
            <label>
              Varsayılan Hesap Tipi
              <select defaultValue={d.accountType}>
                <option>Resmi Hesap</option>
                <option>Gayri Resmi Hesap</option>
              </select>
            </label>
            <label>
              Risk Limiti
              <input type="number" defaultValue={d.riskLimit} />
            </label>
            <label>
              Ödeme Vadesi Günü
              <input type="number" defaultValue={d.dueDays} />
            </label>
            <label>
              Para Birimi
              <select defaultValue={d.currency}>
                <option>TRY</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
            </label>
            <label>
              Etiketler
              <input defaultValue={d.tags} />
            </label>
            <label className="wide">
              Notlar
              <textarea defaultValue={d.notes} />
            </label>
          </div>
        </section>
      </form>
    </div>
  );
}
