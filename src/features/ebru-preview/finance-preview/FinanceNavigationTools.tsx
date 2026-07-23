import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download } from "lucide-react";
import { Link } from "react-router-dom";
import "./finance-navigation-tools.css";

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => string | number;
};

const overview = "/apps";
function segmentRoute(label: string, all: string[]) {
  if (label === "Muhasebe ve Finans") return overview;
  if (label === "Gelir Yönetimi")
    return "/apps/finance/income/invoices";
  if (label === "Gider Yönetimi")
    return "/apps/finance/expense/list";
  if (label === "Kasa") return "/apps/finance/cash/accounts";
  if (label === "Stok Yönetimi")
    return "/apps/finance/inventory/products";
  if (label === "Hizmet ve Ürünler")
    return "/apps/finance/inventory/products";
  if (label === "Giden İrsaliyeler")
    return "/apps/finance/inventory/outgoing-dispatches";
  if (label === "Gelen İrsaliyeler")
    return "/apps/finance/inventory/incoming-dispatches";
  if (label === "Satın Alma")
    return "/apps/finance/purchasing/orders";
  if (label === "Siparişler")
    return "/apps/finance/purchasing/orders";
  if (label === "Tedarikçiler")
    return "/apps/finance/purchasing/suppliers";
  if (label === "Faturalar")
    return "/apps/finance/income/invoices";
  if (label === "Müşteriler")
    return "/apps/finance/income/customers";
  if (label === "Tahsilat Raporu")
    return "/apps/finance/income/collection-report";
  if (label === "Gider Listesi")
    return "/apps/finance/expense/list";
  if (label === "Gelen Faturalar")
    return "/apps/finance/expense/incoming-invoices";
  return all.includes(label) ? overview : undefined;
}

export function FinanceBreadcrumb({ value }: { value: string }) {
  const parts = value.split(" / ");
  return (
    <nav className="finance-form-breadcrumb" aria-label="Sayfa yolu">
      {parts.map((part, index) =>
        index === parts.length - 1 ? (
          <span key={part} aria-current="page">
            {part}
          </span>
        ) : (
          <span className="finance-crumb-part" key={`${part}-${index}`}>
            <Link to={segmentRoute(part, parts) ?? overview}>{part}</Link>
            <i aria-hidden="true">/</i>
          </span>
        ),
      )}
    </nav>
  );
}

export function FinanceBackLink({
  to,
  children,
}: {
  to: string;
  children: string;
}) {
  return (
    <Link className="finance-back-link" to={to}>
      ← {children}
    </Link>
  );
}

const safe = (value: unknown) =>
  String(value ?? "").replace(
    /[&<>"']/g,
    (character) =>
      ({
        "&": "&amp;",
        "<": "&lt;",
        ">": "&gt;",
        '"': "&quot;",
        "'": "&#039;",
      })[character] ?? character,
  );
const dateStamp = () =>
  new Intl.DateTimeFormat("en-CA", { timeZone: "Europe/Istanbul" }).format(
    new Date(),
  );

function downloadCsv<T>(
  filename: string,
  columns: ExportColumn<T>[],
  rows: T[],
) {
  const quote = (value: string | number) =>
    `"${String(value).replaceAll('"', '""')}"`;
  const csv = [
    columns.map((column) => quote(column.header)).join(";"),
    ...rows.map((row) =>
      columns.map((column) => quote(column.value(row))).join(";"),
    ),
  ].join("\r\n");
  const url = URL.createObjectURL(
    new Blob(["\uFEFF", csv], { type: "text/csv;charset=utf-8" }),
  );
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = `${filename}-${dateStamp()}.csv`;
  anchor.click();
  URL.revokeObjectURL(url);
}

function printReport<T>(
  title: string,
  columns: ExportColumn<T>[],
  rows: T[],
  filterSummary: string,
) {
  const report = window.open("", "_blank");
  if (!report) return;
  report.opener = null;
  const exported = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date());
  report.document.write(
    // The escaped closing tag keeps the generated print document from ending this script context.
    // eslint-disable-next-line no-useless-escape
    `<!doctype html><html lang="tr"><head><title>${safe(title)}</title><style>body{font:12px Arial;color:#18212b;margin:30px}header{border-bottom:2px solid #173d65;margin-bottom:18px;padding-bottom:12px}h1{margin:5px 0}.meta{color:#596879}table{width:100%;border-collapse:collapse;margin-top:16px}th,td{border:1px solid #ccd5df;padding:7px;text-align:left}th{background:#e9f0f7}footer{margin-top:24px;border-top:1px solid #ccd5df;padding-top:10px;color:#687684}@page{size:landscape;margin:12mm}</style></head><body><header><strong>Dayan Dişli</strong><h1>${safe(title)}</h1><div class="meta">${safe(filterSummary)} · Dışa aktarım: ${safe(exported)}</div></header><table><thead><tr>${columns.map((column) => `<th>${safe(column.header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${safe(column.value(row))}</td>`).join("")}</tr>`).join("")}</tbody></table><footer>© 2026 Eclipse Mühendislik</footer><script>window.onload=()=>window.print();<\/script></body></html>`,
  );
  report.document.close();
}

export function FinanceExportMenu<T>({
  title,
  filename,
  columns,
  rows,
  filterSummary = "Görüntülenen filtrelenmiş kayıtlar",
}: {
  title: string;
  filename: string;
  columns: ExportColumn<T>[];
  rows: T[];
  filterSummary?: string;
}) {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLDivElement>(null);
  useEffect(() => {
    const close = (event: MouseEvent) => {
      if (!ref.current?.contains(event.target as Node)) setOpen(false);
    };
    const escape = (event: KeyboardEvent) => {
      if (event.key === "Escape") setOpen(false);
    };
    document.addEventListener("mousedown", close);
    document.addEventListener("keydown", escape);
    return () => {
      document.removeEventListener("mousedown", close);
      document.removeEventListener("keydown", escape);
    };
  }, []);
  return (
    <div className="finance-export" ref={ref}>
      <button
        type="button"
        onClick={() => setOpen((value) => !value)}
        aria-expanded={open}
        aria-haspopup="menu"
      >
        <Download /> Dışa Aktar <ChevronDown />
      </button>
      {open && (
        <div role="menu">
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              printReport(title, columns, rows, filterSummary);
            }}
          >
            PDF Olarak İndir
          </button>
          <button
            role="menuitem"
            type="button"
            onClick={() => {
              setOpen(false);
              downloadCsv(filename, columns, rows);
            }}
          >
            Excel Olarak İndir
          </button>
        </div>
      )}
    </div>
  );
}
