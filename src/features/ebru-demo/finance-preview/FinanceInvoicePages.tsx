import {
  FinanceFormSection,
  FinanceMetadataPanel,
  FinancePageHeader,
} from "./FinanceFormComponents";
import { InvoiceLineItemsTable } from "./InvoiceLineItemsTable";
import { salesInvoiceDefaults } from "./financeFormData";
import "./finance-forms.css";

const incomeBase = "/apps/demo/finance/income/invoices";
export function SalesInvoiceForm() {
  const data = salesInvoiceDefaults;
  return (
    <div className="finance-form-page">
      <FinancePageHeader
        breadcrumb="Muhasebe ve Finans / Gelir Yönetimi / Faturalar / Yeni Fatura"
        title="Yeni Fatura"
        cancelTo={incomeBase}
        backLabel="Faturalara Dön"
      />
      <form
        className="finance-form-layout"
        onSubmit={(event) => event.preventDefault()}
      >
        <main>
          <FinanceFormSection title="Fatura Bilgileri">
            <div className="finance-fields two">
              <label>
                Fatura İsmi
                <input defaultValue={data.name} />
              </label>
              <label>
                Müşteri
                <select defaultValue={data.customer}>
                  <option>{data.customer}</option>
                </select>
              </label>
              <label className="wide">
                Müşteri Bilgileri
                <textarea defaultValue={data.customerInfo} />
              </label>
              <fieldset className="wide">
                <legend>Tahsilat Durumu</legend>
                <label>
                  <input type="radio" name="collection" defaultChecked /> Tahsil
                  Edilecek
                </label>
                <label>
                  <input type="radio" name="collection" /> Tahsil Edildi
                </label>
              </fieldset>
              <label>
                Düzenleme Tarihi
                <input type="date" defaultValue={data.issueDate} />
              </label>
              <label>
                Vade Tarihi
                <input type="date" defaultValue={data.dueDate} />
              </label>
              <div className="wide finance-due-buttons">
                {["Aynı Gün", "7 Gün", "14 Gün", "30 Gün", "60 Gün"].map(
                  (item) => (
                    <button type="button" key={item}>
                      {item}
                    </button>
                  ),
                )}
              </div>
            </div>
            <div className="finance-inline-actions">
              {[
                "Fatura No Ekle",
                "Döviz Değiştir",
                "Sipariş Bilgisi Ekle",
                "IBAN Bilgisi Ekle",
              ].map((item) => (
                <button type="button" key={item}>
                  ＋ {item}
                </button>
              ))}
            </div>
            <label>
              Fatura Notu
              <textarea defaultValue={data.note} />
            </label>
            <label className="finance-check">
              <input type="checkbox" /> Müşteri bakiyesini not olarak ekle
            </label>
            <fieldset>
              <legend>Stok Takibi</legend>
              <label>
                <input type="radio" name="stock" defaultChecked /> Stok Çıkışı
                Yapılsın
              </label>
              <label>
                <input type="radio" name="stock" /> Stok Çıkışı Yapılmasın
              </label>
            </fieldset>
          </FinanceFormSection>
          <FinanceFormSection title="Fatura Satırları">
            <InvoiceLineItemsTable />
          </FinanceFormSection>
        </main>
        <FinanceMetadataPanel
          categoryLabel="Fatura Kategorisi"
          category={data.category}
          tags={data.tags}
        />
      </form>
    </div>
  );
}
