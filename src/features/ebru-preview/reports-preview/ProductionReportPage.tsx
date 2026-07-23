import {
  FinanceBreadcrumb,
  FinanceExportMenu,
} from "../finance-preview/FinanceNavigationTools";
const productionReportRows: {
  workOrder: string;
  product: string;
  planned: string;
  completed: string;
  scrap: string;
  efficiency: string;
  status: string;
}[] = [];

const columns = [
  {
    header: "İş Emri",
    value: (row: (typeof productionReportRows)[number]) => row.workOrder,
  },
  {
    header: "Ürün",
    value: (row: (typeof productionReportRows)[number]) => row.product,
  },
  {
    header: "Planlanan",
    value: (row: (typeof productionReportRows)[number]) => row.planned,
  },
  {
    header: "Tamamlanan",
    value: (row: (typeof productionReportRows)[number]) => row.completed,
  },
  {
    header: "Durum",
    value: (row: (typeof productionReportRows)[number]) => row.status,
  },
];

export function ProductionReportPage() {
  return (
    <div className="report-page">
      <header className="report-head">
        <div>
          <FinanceBreadcrumb value="Raporlar / Üretim Raporu" />
          <h1>Üretim Raporu</h1>
          <p>Frontend placeholder üretim özeti</p>
        </div>
        <FinanceExportMenu
          title="Üretim Raporu"
          filename="uretim-raporu"
          rows={[...productionReportRows]}
          columns={columns}
          filterSummary="Frontend placeholder kayıtları"
        />
      </header>
      <section className="report-kpis">
        {[
          ["Aktif İş Emri", "18"],
          ["Tamamlanan", "42"],
          ["Planlanan Üretim", "1.240 adet"],
        ].map(([label, value]) => (
          <article className="ebru-card" key={label}>
            <span>{label}</span>
            <strong>{value}</strong>
          </article>
        ))}
      </section>
      <div className="ebru-card report-table">
        <table>
          <thead>
            <tr>
              {columns.map((column) => (
                <th key={column.header}>{column.header}</th>
              ))}
            </tr>
          </thead>
          <tbody>
            {productionReportRows.map((row) => (
              <tr key={row.workOrder}>
                {columns.map((column) => (
                  <td key={column.header}>{column.value(row)}</td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
