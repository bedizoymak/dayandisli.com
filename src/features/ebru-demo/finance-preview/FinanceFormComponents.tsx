import { ReactNode } from "react";
import { Link } from "react-router-dom";
import { FinanceBackLink, FinanceBreadcrumb } from "./FinanceNavigationTools";

export function FinanceActionBar({ cancelTo }: { cancelTo: string }) {
  return (
    <div className="finance-form-actions">
      <Link to={cancelTo}>Vazgeç</Link>
      <button type="button" onClick={(event) => event.preventDefault()}>
        Kaydet
      </button>
    </div>
  );
}
export function FinancePageHeader({
  breadcrumb,
  title,
  cancelTo,
  backLabel,
}: {
  breadcrumb: string;
  title: string;
  cancelTo: string;
  backLabel?: string;
}) {
  return (
    <header className="finance-form-header">
      <div>
        <FinanceBreadcrumb value={breadcrumb} />
        <FinanceBackLink to={cancelTo}>
          {backLabel ?? "Listeye Dön"}
        </FinanceBackLink>
        <h1>{title}</h1>
      </div>
      <FinanceActionBar cancelTo={cancelTo} />
    </header>
  );
}
export function FinanceFormSection({
  title,
  children,
}: {
  title: string;
  children: ReactNode;
}) {
  return (
    <section className="ebru-card finance-form-section">
      <h2>{title}</h2>
      {children}
    </section>
  );
}
export function FinanceMetadataPanel({
  categoryLabel,
  category,
  tags,
  showSpender = false,
}: {
  categoryLabel: string;
  category: string;
  tags: string;
  showSpender?: boolean;
}) {
  return (
    <aside className="ebru-card finance-metadata">
      <h2>Detaylar</h2>
      <label>
        {categoryLabel}
        <select defaultValue={category}>
          <option>{category}</option>
        </select>
      </label>
      <label>
        Etiketler
        <input defaultValue={tags} />
      </label>
      {showSpender && (
        <label className="finance-check">
          <input type="checkbox" /> Harcamayı Yapanı Takip Et
        </label>
      )}
    </aside>
  );
}
