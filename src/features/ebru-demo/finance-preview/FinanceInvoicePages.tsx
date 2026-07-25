import { useLocation } from "react-router-dom";
import {
  FinanceFormSection,
  FinanceMetadataPanel,
  FinancePageHeader,
} from "./FinanceFormComponents";
import { InvoiceLineItemsTable } from "./InvoiceLineItemsTable";
import { salesInvoiceCategories, salesInvoiceDefaults } from "./financeFormData";
import { invoiceRows } from "./financeIncomeData";
import "./finance-forms.css";

const incomeBase = "/demo/finance/income/invoices";

function lastPathSegment(pathname: string, dropTrailing?: string) {
  const trimmed = dropTrailing
    ? pathname.replace(new RegExp(`/${dropTrailing}$`), "")
    : pathname;
  const segments = trimmed.split("/").filter(Boolean);
  return decodeURIComponent(segments[segments.length - 1] ?? "");
}

export function SalesInvoiceForm({ mode = "create" }: { mode?: "create" | "edit" }) {
  const location = useLocation();
  const editingNo =
    mode === "edit" ? lastPathSegment(location.pathname, "edit") : undefined;
  const editingRow = editingNo
    ? invoiceRows.find((row) => row.no === editingNo)
    : undefined;
  const data = editingRow
    ? {
        ...salesInvoiceDefaults,
        name: `${editingRow.no} Faturası`,
        customer: editingRow.customer,
        issueDate: salesInvoiceDefaults.issueDate,
        dueDate: salesInvoiceDefaults.dueDate,
      }
    : salesInvoiceDefaults;
  const title = editingRow ? `Fatura Düzenle · ${editingRow.no}` : "Yeni Fatura";
  const cancelTo = editingRow ? `${incomeBase}/${editingRow.no}` : incomeBase;

  return (
    <div className="finance-form-page">
      <FinancePageHeader
        breadcrumb={`Muhasebe ve Finans / Gelir Yönetimi / Faturalar / ${title}`}
        title={title}
        cancelTo={cancelTo}
        backLabel={editingRow ? "Faturaya Dön" : "Faturalara Dön"}
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
          categoryOptions={salesInvoiceCategories}
          tags={data.tags}
        />
      </form>
    </div>
  );
}
