import { useMemo, useState } from "react";
import { Plus, Trash2 } from "lucide-react";
import { salesInvoiceDefaults } from "./financeFormData";

export function InvoiceLineItemsTable({
  taxLabel = "Toplam KDV",
}: {
  taxLabel?: string;
}) {
  const [lines, setLines] = useState(salesInvoiceDefaults.lines);
  const subtotal = useMemo(
    () => lines.reduce((sum, line) => sum + line.quantity * line.unitPrice, 0),
    [lines],
  );
  const vat = useMemo(
    () =>
      lines.reduce(
        (sum, line) => sum + (line.quantity * line.unitPrice * line.tax) / 100,
        0,
      ),
    [lines],
  );
  const money = (value: number) =>
    new Intl.NumberFormat("tr-TR", {
      style: "currency",
      currency: "TRY",
      maximumFractionDigits: 2,
    }).format(value);
  return (
    <div className="finance-lines">
      <div className="finance-lines-head">
        <span>Hizmet / Ürün</span>
        <span>Miktar</span>
        <span>Birim</span>
        <span>Birim Fiyat</span>
        <span>Vergi</span>
        <span>Toplam</span>
        <span />
      </div>
      {lines.map((line, index) => (
        <div className="finance-line" key={index}>
          <input defaultValue={line.product} />
          <input type="number" defaultValue={line.quantity} />
          <select defaultValue={line.unit}>
            <option>Adet</option>
            <option>Saat</option>
            <option>Kg</option>
          </select>
          <input type="number" defaultValue={line.unitPrice} />
          <select defaultValue={line.tax}>
            <option value="20">%20</option>
            <option value="10">%10</option>
            <option value="1">%1</option>
          </select>
          <strong>
            {money(line.quantity * line.unitPrice * (1 + line.tax / 100))}
          </strong>
          <button
            type="button"
            onClick={() =>
              setLines((items) =>
                items.filter((_, itemIndex) => itemIndex !== index),
              )
            }
            aria-label="Satırı kaldır"
          >
            <Trash2 />
          </button>
        </div>
      ))}
      <button
        className="finance-add-line"
        type="button"
        onClick={() =>
          setLines((items) => [
            ...items,
            {
              product: "Yeni Hizmet / Ürün",
              quantity: 1,
              unit: "Adet",
              unitPrice: 0,
              tax: 20,
            },
          ])
        }
      >
        <Plus />
        Yeni Satır Ekle
      </button>
      <div className="finance-totals">
        <div>
          <span>Ara Toplam</span>
          <strong>{money(subtotal)}</strong>
        </div>
        <div>
          <span>{taxLabel}</span>
          <strong>{money(vat)}</strong>
        </div>
        <div className="grand">
          <span>Genel Toplam</span>
          <strong>{money(subtotal + vat)}</strong>
        </div>
      </div>
    </div>
  );
}
