import { Link } from "react-router-dom";
import { CrmPageHeader } from "./CrmShared";
const parent = "/apps/crm/customers";
export function CustomerFormPage({ edit = false }: { edit?: boolean }) {
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
        <section className="erp-card">
          <h2>Temel Bilgiler</h2>
          <div className="crm-fields">
            <label>
              Firma Ünvanı *
              <input />
            </label>
            <label>
              Kişi Tipi *
              <select>
                <option value="">—</option>
                <option>Firma</option>
                <option>Gerçek Kişi</option>
              </select>
            </label>
            <label>
              TC/VKN *<input />
            </label>
            <label>
              İlgili Kişi Adı Soyadı
              <input />
            </label>
            <label>
              Vergi Dairesi
              <input />
            </label>
          </div>
        </section>
        <section className="erp-card">
          <h2>İletişim ve Adres</h2>
          <div className="crm-fields">
            <label>
              Telefon
              <input />
            </label>
            <label>
              Email
              <input type="email" />
            </label>
            <label>
              İl
              <input />
            </label>
            <label>
              İlçe
              <input />
            </label>
            <label>
              Web Sitesi
              <input />
            </label>
            <label className="wide">
              Adres
              <textarea />
            </label>
          </div>
        </section>
        <section className="erp-card">
          <h2>Cari ve Finans Ayarları</h2>
          <div className="crm-fields">
            <label>
              Cari Durum
              <select>
                <option value="">—</option>
                <option>Aktif</option>
                <option>Pasif</option>
              </select>
            </label>
            <label>
              Varsayılan Hesap Tipi
              <select>
                <option value="">—</option>
                <option>Resmi Hesap</option>
                <option>Gayri Resmi Hesap</option>
              </select>
            </label>
            <label>
              Risk Limiti
              <input type="number" />
            </label>
            <label>
              Ödeme Vadesi Günü
              <input type="number" />
            </label>
            <label>
              Para Birimi
              <select>
                <option value="">—</option>
                <option>TRY</option>
                <option>USD</option>
                <option>EUR</option>
              </select>
            </label>
            <label>
              Etiketler
              <input />
            </label>
            <label className="wide">
              Notlar
              <textarea />
            </label>
          </div>
        </section>
      </form>
    </div>
  );
}
