import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { FinanceExportMenu, type ExportColumn } from "../FinanceNavigationTools";
import { checkDirectionLabel, checkPartyLabel, effectiveStatusLabel, formatCheckMoney } from "./checkDomain";
import { listChecks } from "./checksApi";
import type { CheckDirection, CheckListRow } from "./types";
import "./checks.css";

const columns: ExportColumn<CheckListRow>[] = [
  { header: "Kaynak", value: (row) => row.sourceLabel },
  { header: "Yön", value: (row) => checkDirectionLabel(row.direction) },
  { header: "Taraf", value: (row) => checkPartyLabel(row.party) },
  { header: "Banka", value: (row) => row.bankName || "—" },
  { header: "Çek No", value: (row) => row.checkNumber || "—" },
  { header: "Vade", value: (row) => row.dueDate || "—" },
  { header: "Tutar", value: (row) => formatCheckMoney(row.originalAmount, row.currency) },
  { header: "Kalan", value: (row) => formatCheckMoney(row.remainingAmount, row.currency) },
  { header: "Durum", value: (row) => effectiveStatusLabel(row.effectiveStatus) },
];

export async function fetchAllOpenChecks(direction: CheckDirection) {
  const pageSize = 100;
  const first = await listChecks({ page: 1, pageSize, filters: { direction, openOnly: true } });
  if (first.ok === false) return first;
  const rows = [...first.data.rows];
  const pageCount = Math.ceil(first.data.total / pageSize);
  for (let page = 2; page <= pageCount; page += 1) {
    const next = await listChecks({ page, pageSize, filters: { direction, openOnly: true } });
    if (next.ok === false) return next;
    rows.push(...next.data.rows);
  }
  return { ok: true as const, data: rows };
}

export function OpenChecksReportSection({
  direction,
  title,
}: {
  direction: CheckDirection;
  title: string;
}) {
  const [rows, setRows] = useState<CheckListRow[]>([]);
  const [status, setStatus] = useState<"loading" | "ready" | "error">("loading");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    let cancelled = false;
    fetchAllOpenChecks(direction).then((result) => {
      if (cancelled) return;
      if (result.ok === false) {
        setRows([]);
        setError(result.message);
        setStatus("error");
        return;
      }
      setRows(result.data);
      setError(null);
      setStatus("ready");
    });
    return () => {
      cancelled = true;
    };
  }, [direction]);

  return (
    <section className="erp-card checks-table-card" aria-label={title}>
      <header className="checks-report-head">
        <div>
          <h2>{title}</h2>
          <p>Açık çekler fatura tahsilatı/ödemesi sayılmaz; kalan tutar ve vade ayrı kategoride gösterilir.</p>
        </div>
        <div className="checks-head-actions">
          <FinanceExportMenu title={title} filename={direction === "received" ? "acik-alinan-cekler" : "acik-verilen-cekler"} rows={rows} columns={columns} />
          <Link className="checks-row-link" to="/apps/finance/cash/checks">Tüm Filtreler</Link>
        </div>
      </header>
      {status === "loading" && <div className="checks-state" role="status">Gerçek çek verisi yükleniyor…</div>}
      {status === "error" && <div className="checks-error" role="alert">{error}</div>}
      {status === "ready" && rows.length === 0 && <div className="checks-state">Açık çek bulunmuyor.</div>}
      {status === "ready" && rows.length > 0 && (
        <div className="checks-table-scroll">
          <table className="checks-table">
            <thead><tr>{columns.map((column) => <th key={column.header}>{column.header}</th>)}<th>Detay</th></tr></thead>
            <tbody>
              {rows.map((row) => (
                <tr key={row.id}>
                  {columns.map((column) => <td key={column.header}>{column.value(row)}</td>)}
                  <td><Link className="checks-row-link" to={`/apps/finance/cash/checks/${encodeURIComponent(row.id)}`}>Görüntüle</Link></td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
