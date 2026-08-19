import { useEffect, useState } from "react";
import { ArrowUpDown, Filter, Plus, RefreshCw, Search } from "lucide-react";
import { Link } from "react-router-dom";
import { useErpIdentity } from "@/features/erp-shell/erpIdentity";
import { formatMoney } from "@/lib/finance/financeLabels";
import {
  FinanceBreadcrumb,
  FinanceExportMenu,
  type ExportColumn,
} from "../FinanceNavigationTools";
import { checkDirectionLabel, checkPartyLabel, effectiveStatusLabel } from "./checkDomain";
import { listChecks, refreshParasutChecks } from "./checksApi";
import type {
  CheckCurrency,
  CheckDirection,
  CheckEffectiveStatus,
  CheckListFilters,
  CheckListRow,
  CheckSort,
  CheckSortField,
  CheckSource,
} from "./types";
import "./checks.css";

const checksBase = "/apps/finance/cash/checks";

function displayDate(value: string | null): string {
  if (!value) return "—";
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("tr-TR");
}

function displayTimestamp(value: string | null): string {
  if (!value) return "Henüz senkron bilgisi yok";
  const date = new Date(value);
  return Number.isNaN(date.getTime())
    ? value
    : new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short", timeZone: "Europe/Istanbul" }).format(date);
}

function displayAmount(value: number | null, currency: CheckCurrency | null): string {
  if (value === null || currency === null) return "—";
  try {
    return formatMoney(value, currency);
  } catch {
    return `${value.toLocaleString("tr-TR")} ${currency}`;
  }
}

const exportColumns: ExportColumn<CheckListRow>[] = [
  { header: "Kaynak", value: (row) => row.sourceLabel },
  { header: "Yön", value: (row) => checkDirectionLabel(row.direction) },
  { header: "Müşteri / Tedarikçi", value: (row) => checkPartyLabel(row.party) },
  { header: "Banka", value: (row) => row.bankName ?? "—" },
  { header: "Çek No", value: (row) => row.checkNumber ?? "—" },
  { header: "Düzenleme Tarihi", value: (row) => row.issueDate ?? "—" },
  { header: "Vade Tarihi", value: (row) => row.dueDate ?? "—" },
  { header: "Tutar", value: (row) => displayAmount(row.originalAmount, row.currency) },
  { header: "Kalan", value: (row) => displayAmount(row.remainingAmount, row.currency) },
  { header: "Durum", value: (row) => effectiveStatusLabel(row.effectiveStatus) },
];

type FilterState = {
  source: "" | CheckSource;
  direction: "" | CheckDirection;
  effectiveStatus: "" | CheckEffectiveStatus;
  dueFrom: string;
  dueTo: string;
  partySearch: string;
  bank: string;
  currency: "" | CheckCurrency;
  balanceState: "all" | "open" | "paid";
};

const EMPTY_FILTERS: FilterState = {
  source: "",
  direction: "",
  effectiveStatus: "",
  dueFrom: "",
  dueTo: "",
  partySearch: "",
  bank: "",
  currency: "",
  balanceState: "all",
};

function apiFilters(filters: FilterState): CheckListFilters {
  return {
    ...(filters.source ? { source: filters.source } : {}),
    ...(filters.direction ? { direction: filters.direction } : {}),
    ...(filters.effectiveStatus ? { effectiveStatus: filters.effectiveStatus } : {}),
    ...(filters.dueFrom ? { dueFrom: filters.dueFrom } : {}),
    ...(filters.dueTo ? { dueTo: filters.dueTo } : {}),
    ...(filters.partySearch.trim() ? { partySearch: filters.partySearch.trim() } : {}),
    ...(filters.bank.trim() ? { bank: filters.bank.trim() } : {}),
    ...(filters.currency ? { currency: filters.currency } : {}),
    ...(filters.balanceState === "open" ? { openOnly: true } : {}),
    ...(filters.balanceState === "paid" ? { effectiveStatus: "paid" } : {}),
  };
}

function SortButton({
  field,
  activeSort,
  onToggle,
  children,
}: {
  field: CheckSortField;
  activeSort?: CheckSort;
  onToggle: (field: CheckSortField) => void;
  children: string;
}) {
  const active = activeSort?.field === field;
  const indicator = active ? (activeSort.direction === "asc" ? "↑" : "↓") : "↕";
  return (
    <button
      type="button"
      className="checks-sort-button"
      onClick={() => onToggle(field)}
      aria-label={`${children} sıralamasını değiştir`}
    >
      {children} <span aria-hidden="true">{indicator}</span>
    </button>
  );
}

export function ChecksPage() {
  const { roles } = useErpIdentity();
  const isAdmin = roles.includes("admin");
  const [rows, setRows] = useState<CheckListRow[]>([]);
  const [total, setTotal] = useState(0);
  const [latestSyncAt, setLatestSyncAt] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [notice, setNotice] = useState<string | null>(null);
  const [refreshing, setRefreshing] = useState(false);
  const [search, setSearch] = useState("");
  const [filters, setFilters] = useState<FilterState>(EMPTY_FILTERS);
  const [sort, setSort] = useState<CheckSort | undefined>();
  const [page, setPage] = useState(1);
  const [reloadKey, setReloadKey] = useState(0);
  const pageSize = 100;

  useEffect(() => {
    setPage(1);
  }, [search, filters, sort]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    setError(null);
    const timer = window.setTimeout(() => {
      listChecks({ page, pageSize, search: search.trim(), filters: apiFilters(filters), sort }).then((result) => {
        if (cancelled) return;
        if (result.ok === false) {
          setRows([]);
          setTotal(0);
          setError(result.message);
        } else {
          setRows(result.data.rows);
          setTotal(result.data.total);
          setLatestSyncAt(result.data.latestSyncAt);
        }
        setLoading(false);
      });
    }, 200);
    return () => {
      cancelled = true;
      window.clearTimeout(timer);
    };
  }, [filters, page, reloadKey, search, sort]);

  // The API sorts the complete filtered dataset before pagination. Re-sorting
  // only the current page would make global ordering inconsistent.
  const visibleRows = rows;

  const toggleSort = (field: CheckSortField) => {
    setSort((current) => {
      if (current?.field !== field) return { field, direction: "asc" };
      if (current.direction === "asc") return { field, direction: "desc" };
      return undefined;
    });
  };

  const refresh = async () => {
    setRefreshing(true);
    setNotice(null);
    setError(null);
    const result = await refreshParasutChecks();
    if (result.ok === false) setError(result.message);
    else {
      setNotice("Paraşüt çekleri güvenli salt okunur senkronla yenilendi.");
      setReloadKey((value) => value + 1);
    }
    setRefreshing(false);
  };

  const pageCount = Math.max(1, Math.ceil(total / pageSize));

  return (
    <div className="checks-page">
      <header className="checks-page-head">
        <div>
          <FinanceBreadcrumb value="Muhasebe ve Finans / Kasa / Çekler" />
          <h1>Çekler</h1>
          <p>Paraşüt aynasındaki ve ERP'de yönetilen gerçek çek kayıtları.</p>
          <small>Son Paraşüt senkronu: {displayTimestamp(latestSyncAt)}</small>
        </div>
        <div className="checks-head-actions">
          {isAdmin && (
            <button type="button" onClick={refresh} disabled={refreshing}>
              <RefreshCw className={refreshing ? "spin" : ""} />
              {refreshing ? "Yenileniyor…" : "Paraşüt'ten Yenile"}
            </button>
          )}
          <FinanceExportMenu
            title="Çekler"
            filename="cekler"
            rows={visibleRows}
            columns={exportColumns}
            filterSummary={`Görüntülenen ${visibleRows.length} filtrelenmiş kayıt`}
          />
          <Link className="checks-primary-link" to={`${checksBase}/new`}>
            <Plus /> Yeni ERP Çeki
          </Link>
        </div>
      </header>

      {notice && <div className="checks-notice" role="status">{notice}</div>}
      {error && (
        <div className="checks-error" role="alert">
          <span>{error}</span>
          <button type="button" onClick={() => setReloadKey((value) => value + 1)}>Tekrar Dene</button>
        </div>
      )}

      <section className="erp-card checks-filters" aria-label="Çek filtreleri">
        <label className="checks-search-field wide">
          <Search aria-hidden="true" />
          <input value={search} onChange={(event) => setSearch(event.target.value)} placeholder="Çek no, banka, açıklama veya taraf ara" />
        </label>
        <label>
          Kaynak
          <select value={filters.source} onChange={(event) => setFilters((current) => ({ ...current, source: event.target.value as FilterState["source"] }))}>
            <option value="">Tümü</option>
            <option value="parasut">Paraşüt</option>
            <option value="erp">ERP</option>
          </select>
        </label>
        <label>
          Yön
          <select value={filters.direction} onChange={(event) => setFilters((current) => ({ ...current, direction: event.target.value as FilterState["direction"] }))}>
            <option value="">Tümü</option>
            <option value="received">Alınan</option>
            <option value="issued">Verilen</option>
          </select>
        </label>
        <label>
          Etkin Durum
          <select
            value={filters.effectiveStatus}
            onChange={(event) => setFilters((current) => ({ ...current, effectiveStatus: event.target.value as FilterState["effectiveStatus"], balanceState: "all" }))}
          >
            <option value="">Tümü</option>
            {(Object.keys({ open: 1, upcoming: 1, due_today: 1, overdue: 1, paid: 1, returned: 1, cancelled: 1 }) as CheckEffectiveStatus[]).map((status) => (
              <option value={status} key={status}>{effectiveStatusLabel(status)}</option>
            ))}
          </select>
        </label>
        <label>
          Açık / Ödenmiş
          <select
            value={filters.balanceState}
            onChange={(event) => setFilters((current) => ({ ...current, balanceState: event.target.value as FilterState["balanceState"], effectiveStatus: "" }))}
          >
            <option value="all">Tümü</option>
            <option value="open">Yalnız Açık</option>
            <option value="paid">Yalnız Ödenmiş</option>
          </select>
        </label>
        <label>
          Vade Başlangıç
          <input type="date" value={filters.dueFrom} onChange={(event) => setFilters((current) => ({ ...current, dueFrom: event.target.value }))} />
        </label>
        <label>
          Vade Bitiş
          <input type="date" value={filters.dueTo} onChange={(event) => setFilters((current) => ({ ...current, dueTo: event.target.value }))} />
        </label>
        <label>
          Taraf
          <input
            value={filters.partySearch}
            onChange={(event) => setFilters((current) => ({ ...current, partySearch: event.target.value }))}
            placeholder="Taraf adına göre filtrele"
          />
        </label>
        <label>
          Banka
          <input value={filters.bank} onChange={(event) => setFilters((current) => ({ ...current, bank: event.target.value }))} />
        </label>
        <label>
          Para Birimi
          <select value={filters.currency} onChange={(event) => setFilters((current) => ({ ...current, currency: event.target.value as FilterState["currency"] }))}>
            <option value="">Tümü</option>
            <option value="TRY">TRY</option>
            <option value="USD">USD</option>
            <option value="EUR">EUR</option>
          </select>
        </label>
        <button type="button" className="checks-clear-button" onClick={() => { setSearch(""); setFilters(EMPTY_FILTERS); setSort(undefined); }}>
          <Filter /> Filtreleri Temizle
        </button>
      </section>

      <section className="erp-card checks-table-card">
        {loading ? (
          <div className="checks-state" role="status">Gerçek çek kayıtları yükleniyor…</div>
        ) : !error && !visibleRows.length ? (
          <div className="checks-state">Filtrelerle eşleşen gerçek çek kaydı bulunamadı.</div>
        ) : !error ? (
          <div className="checks-table-scroll">
            <table className="checks-table">
              <thead>
                <tr>
                  <th>Kaynak</th>
                  <th>Yön</th>
                  <th>Müşteri / Tedarikçi</th>
                  <th>Banka / Çek No</th>
                  <th>Düzenleme</th>
                  <th aria-sort={sort?.field === "dueDate" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                    <SortButton field="dueDate" activeSort={sort} onToggle={toggleSort}>Vade</SortButton>
                  </th>
                  <th aria-sort={sort?.field === "originalAmount" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                    <SortButton field="originalAmount" activeSort={sort} onToggle={toggleSort}>Tutar</SortButton>
                  </th>
                  <th aria-sort={sort?.field === "remainingAmount" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                    <SortButton field="remainingAmount" activeSort={sort} onToggle={toggleSort}>Kalan</SortButton>
                  </th>
                  <th aria-sort={sort?.field === "effectiveStatus" ? (sort.direction === "asc" ? "ascending" : "descending") : "none"}>
                    <SortButton field="effectiveStatus" activeSort={sort} onToggle={toggleSort}>Durum</SortButton>
                  </th>
                  <th><span className="sr-only">İşlemler</span></th>
                </tr>
              </thead>
              <tbody>
                {visibleRows.map((row) => (
                  <tr key={row.id}>
                    <td><span className={`checks-source-badge ${row.source}`}>{row.sourceLabel}</span></td>
                    <td><span className={`checks-direction-badge ${row.direction ?? "unknown"}`}>{checkDirectionLabel(row.direction)}</span></td>
                    <td>{checkPartyLabel(row.party)}</td>
                    <td><strong>{row.bankName ?? "—"}</strong><small>{row.checkNumber ?? "—"}</small></td>
                    <td>{displayDate(row.issueDate)}</td>
                    <td>{displayDate(row.dueDate)}</td>
                    <td>{displayAmount(row.originalAmount, row.currency)}</td>
                    <td>{displayAmount(row.remainingAmount, row.currency)}</td>
                    <td><span className={`checks-status-badge ${row.effectiveStatus}`}>{effectiveStatusLabel(row.effectiveStatus)}</span></td>
                    <td><Link className="checks-row-link" to={`${checksBase}/${encodeURIComponent(row.id)}`}>Görüntüle</Link></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : null}
      </section>

      <footer className="checks-pagination">
        <span>{total} kayıt · Sayfa {page} / {pageCount}</span>
        <div>
          <button type="button" disabled={page <= 1 || loading} onClick={() => setPage((value) => Math.max(1, value - 1))}>Önceki</button>
          <button type="button" disabled={page >= pageCount || loading} onClick={() => setPage((value) => value + 1)}>Sonraki</button>
        </div>
      </footer>
    </div>
  );
}
