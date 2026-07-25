import { useEffect, useRef, useState } from "react";
import { ChevronDown, Download, MoreHorizontal } from "lucide-react";
import { Link } from "react-router-dom";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import "./finance-navigation-tools.css";

export type ExportColumn<T> = {
  header: string;
  value: (row: T) => string | number;
};

const overview = "/apps";
function segmentRoute(label: string, all: string[]) {
  if (label === "Muhasebe ve Finans") return "/apps/finance";
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

export function downloadCsv<T>(
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

export type PdfKpi = { label: string; value: string };
export type PdfChartBar = { label: string; value: number };
export type PdfReportExtras = {
  kpis?: PdfKpi[];
  chart?: { title: string; bars: PdfChartBar[] };
};

function buildExtrasHtml(extras?: PdfReportExtras) {
  if (!extras) return "";
  let html = "";
  if (extras.kpis?.length) {
    html += `<section class="pdf-kpis">${extras.kpis
      .map(
        (kpi) =>
          `<article><span>${safe(kpi.label)}</span><strong>${safe(kpi.value)}</strong></article>`,
      )
      .join("")}</section>`;
  }
  if (extras.chart?.bars.length) {
    const max = Math.max(...extras.chart.bars.map((bar) => bar.value), 1);
    html += `<section class="pdf-chart"><h2>${safe(extras.chart.title)}</h2><div class="pdf-chart-bars">${extras.chart.bars
      .map((bar) => {
        const height = Math.max(4, Math.round((bar.value / max) * 100));
        return `<div class="pdf-bar-col"><span class="pdf-bar-value">${safe(bar.value)}</span><div class="pdf-bar" style="height:${height}px"></div><small>${safe(bar.label)}</small></div>`;
      })
      .join("")}</div><div class="pdf-chart-legend"><span>${safe(extras.chart.title)}</span></div></section>`;
  }
  return html;
}

export function printReport<T>(
  title: string,
  columns: ExportColumn<T>[],
  rows: T[],
  filterSummary: string,
  extras?: PdfReportExtras,
) {
  const report = window.open("", "_blank");
  if (!report) return;
  report.opener = null;
  const exported = new Intl.DateTimeFormat("tr-TR", {
    dateStyle: "long",
    timeStyle: "short",
    timeZone: "Europe/Istanbul",
  }).format(new Date());
  const extrasHtml = buildExtrasHtml(extras);
  report.document.write(
    // The escaped closing tag keeps the generated print document from ending this script context.
    // eslint-disable-next-line no-useless-escape
    `<!doctype html><html lang="tr"><head><title>${safe(title)}</title><style>body{font:12px Arial;color:#18212b;margin:30px}header{border-bottom:2px solid #173d65;margin-bottom:18px;padding-bottom:12px}h1{margin:5px 0}.meta{color:#596879}table{width:100%;border-collapse:collapse;margin-top:16px;page-break-inside:auto}tr{page-break-inside:avoid}th,td{border:1px solid #ccd5df;padding:7px;text-align:left}th{background:#e9f0f7}footer{margin-top:24px;border-top:1px solid #ccd5df;padding-top:10px;color:#687684}@page{size:landscape;margin:12mm}.pdf-kpis{display:flex;flex-wrap:wrap;gap:10px;margin:14px 0;page-break-inside:avoid}.pdf-kpis article{flex:1 1 150px;border:1px solid #ccd5df;border-radius:8px;padding:10px 12px}.pdf-kpis span{display:block;color:#687684;font-size:10px;text-transform:uppercase}.pdf-kpis strong{font-size:16px}.pdf-chart{margin:16px 0;page-break-inside:avoid}.pdf-chart h2{font-size:13px;margin:0 0 10px}.pdf-chart-bars{display:flex;align-items:flex-end;gap:14px;height:130px;border-bottom:1px solid #ccd5df;padding-bottom:4px}.pdf-bar-col{display:flex;flex-direction:column;align-items:center;justify-content:flex-end;gap:4px;flex:1;height:100%}.pdf-bar{width:100%;max-width:34px;background:#3f7fc1;border-radius:3px 3px 0 0}.pdf-bar-value{font-size:9px;color:#42536a}.pdf-chart-bars small{font-size:8px;color:#687684;text-align:center}.pdf-chart-legend{margin-top:6px;font-size:9px;color:#687684}</style></head><body><header><strong>Dayan Dişli</strong><h1>${safe(title)}</h1><div class="meta">${safe(filterSummary)} · Dışa aktarım: ${safe(exported)}</div></header>${extrasHtml}<table><thead><tr>${columns.map((column) => `<th>${safe(column.header)}</th>`).join("")}</tr></thead><tbody>${rows.map((row) => `<tr>${columns.map((column) => `<td>${safe(column.value(row))}</td>`).join("")}</tr>`).join("")}</tbody></table><footer>© 2026 Eclipse Mühendislik</footer><script>window.onload=()=>window.print();<\/script></body></html>`,
  );
  report.document.close();
}

export type RowAction = {
  label: string;
  href?: string;
  onSelect?: () => void;
  disabled?: boolean;
};

export function RowActionsMenu({
  actions,
  label = "İşlemler",
}: {
  actions: RowAction[];
  label?: string;
}) {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <button
          type="button"
          className="income-row-actions"
          aria-label={label}
        >
          <MoreHorizontal />
        </button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end">
        {actions.map((action) =>
          action.href ? (
            <DropdownMenuItem asChild key={action.label} disabled={action.disabled}>
              <Link to={action.href}>{action.label}</Link>
            </DropdownMenuItem>
          ) : (
            <DropdownMenuItem
              key={action.label}
              disabled={action.disabled}
              onSelect={action.onSelect}
            >
              {action.label}
            </DropdownMenuItem>
          ),
        )}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}

export function FinanceExportMenu<T>({
  title,
  filename,
  columns,
  rows,
  filterSummary = "Görüntülenen filtrelenmiş kayıtlar",
  pdfExtras,
}: {
  title: string;
  filename: string;
  columns: ExportColumn<T>[];
  rows: T[];
  filterSummary?: string;
  pdfExtras?: PdfReportExtras;
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
              printReport(title, columns, rows, filterSummary, pdfExtras);
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
