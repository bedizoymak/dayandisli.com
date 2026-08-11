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
  const hasAmounts = lines.some(
    (line) => line.quantity > 0 && line.unitPrice > 0,
  );
  const money = (value: number) =>
    new Intl.NumberFormat("tr-TR", {
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
          <input type="number" defaultValue={line.quantity || ""} />
          <select defaultValue={line.unit}>
            <option value="">—</option>
            <option>Adet</option>
            <option>Saat</option>
            <option>Kg</option>
          </select>
          <input type="number" defaultValue={line.unitPrice || ""} />
          <select defaultValue={line.tax}>
            <option value="0">—</option>
            <option value="20">%20</option>
            <option value="10">%10</option>
            <option value="1">%1</option>
          </select>
          <strong>
            {line.quantity > 0 && line.unitPrice > 0
              ? money(line.quantity * line.unitPrice * (1 + line.tax / 100))
              : "—"}
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
              product: "",
              quantity: 0,
              unit: "",
              unitPrice: 0,
              tax: 0,
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
          <strong>{hasAmounts ? money(subtotal) : "—"}</strong>
        </div>
        <div>
          <span>{taxLabel}</span>
          <strong>{hasAmounts ? money(vat) : "—"}</strong>
        </div>
        <div className="grand">
          <span>Genel Toplam</span>
          <strong>{hasAmounts ? money(subtotal + vat) : "—"}</strong>
        </div>
      </div>
    </div>
  );
}
