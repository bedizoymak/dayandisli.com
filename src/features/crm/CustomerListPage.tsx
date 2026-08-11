import { useEffect, useState } from "react";
import {
  Building2,
  Eye,
  MoreHorizontal,
  Pencil,
  Search,
  Trash2,
  UserRound,
} from "lucide-react";
import { Link } from "react-router-dom";
import {
  FinanceExportMenu,
  type ExportColumn,
} from "../finance/FinanceNavigationTools";
import { supabase } from "@/integrations/supabase/client";
import { formatMoney } from "@/lib/finance/financeLabels";
import { CrmPageHeader } from "./CrmShared";

type CustomerRow = {
  id: string;
  name: string;
  type: string;
  taxNo: string;
  phone: string;
  whatsapp?: string;
  email: string;
  projects: string[];
  planned: string;
  collected: string;
  balance: string;
  balanceValue: number | null;
};

type CustomerApiRow = {
  parasut_id?: unknown;
  attributes?: Record<string, unknown> | null;
};

type CustomerSortKey = "name" | "balance";
type SortDirection = "asc" | "desc";
type CustomerSortState = {
  key: CustomerSortKey;
  direction: SortDirection;
} | null;

const defaultSort = {
  key: "balance",
  direction: "desc",
} as const;

const columns: ExportColumn<CustomerRow>[] = [
  { header: "Müşteri", value: (r) => r.name },
  { header: "Tür", value: (r) => r.type },
  { header: "TC/VKN", value: (r) => r.taxNo },
  { header: "Telefon", value: (r) => r.phone },
  { header: "Projeler", value: (r) => r.projects.join(", ") },
  { header: "Planlanan Alacak", value: (r) => r.planned },
  { header: "Tahsil Edilen", value: (r) => r.collected },
  { header: "Kalan Bakiye", value: (r) => r.balance },
];

function displayText(value: unknown) {
  return typeof value === "string" && value.trim() ? value.trim() : "—";
}

function displayCustomerType(value: unknown) {
  if (value === "company") return "Tüzel Kişi";
  if (value === "person") return "Gerçek Kişi";
  return "—";
}

function numericBalance(value: unknown) {
  if (typeof value === "number") return Number.isFinite(value) ? value : null;
  if (typeof value !== "string" || !value.trim()) return null;
  const amount = Number(value);
  return Number.isFinite(amount) ? amount : null;
}

function mapCustomerCard(row: CustomerApiRow): CustomerRow | null {
  if (typeof row.parasut_id !== "string" || !row.parasut_id) return null;
  const attributes = row.attributes ?? {};
  const balanceValue = numericBalance(attributes.trl_balance);
  return {
    id: row.parasut_id,
    name: displayText(attributes.name),
    type: displayCustomerType(attributes.contact_type),
    taxNo: displayText(attributes.tax_number),
    phone: displayText(attributes.phone),
    email: displayText(attributes.email),
    projects: [],
    planned: "—",
    collected: "—",
    balance: balanceValue === null ? "—" : formatMoney(balanceValue),
    balanceValue,
  };
}

function sortCustomerRows(rows: CustomerRow[], state: CustomerSortState) {
  const activeSort = state ?? defaultSort;
  return [...rows].sort((left, right) => {
    if (activeSort.key === "balance") {
      if (left.balanceValue === null && right.balanceValue === null) return 0;
      if (left.balanceValue === null) return 1;
      if (right.balanceValue === null) return -1;
      return activeSort.direction === "asc"
        ? left.balanceValue - right.balanceValue
        : right.balanceValue - left.balanceValue;
    }

    const leftMissing = left.name === "—";
    const rightMissing = right.name === "—";
    if (leftMissing && rightMissing) return 0;
    if (leftMissing) return 1;
    if (rightMissing) return -1;
    const comparison = left.name.localeCompare(right.name, "tr-TR", {
      sensitivity: "base",
    });
    return activeSort.direction === "asc" ? comparison : -comparison;
  });
}

async function fetchAllCustomers(search: string, cancelledRef: { cancelled: boolean }) {
  const pageSize = 100;
  const fetchPage = (page: number) =>
    supabase.functions.invoke("parasut-api", {
      body: {
        action: "list",
        resource: "customers",
        page,
        pageSize,
        search: search.trim() || undefined,
        filters: { archived: false },
      },
    });

  const first = await fetchPage(1);
  if (cancelledRef.cancelled) return { rows: [] as CustomerApiRow[], total: null as number | null };
  const firstResponse = first.data as { rows?: unknown; total?: unknown } | null;
  if (first.error || !firstResponse || !Array.isArray(firstResponse.rows)) {
    return { rows: [] as CustomerApiRow[], total: null };
  }
  const total = typeof firstResponse.total === "number" ? firstResponse.total : null;
  const rows = [...(firstResponse.rows as CustomerApiRow[])];

  if (total !== null) {
    const remainingPages = Math.ceil(total / pageSize) - 1;
    for (let page = 2; page <= remainingPages + 1; page += 1) {
      if (cancelledRef.cancelled) break;
      const next = await fetchPage(page);
      const nextResponse = next.data as { rows?: unknown } | null;
      if (next.error || !nextResponse || !Array.isArray(nextResponse.rows)) break;
      rows.push(...(nextResponse.rows as CustomerApiRow[]));
    }
  }

  return { rows, total };
}

export function CustomerListPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("Tüm Türler");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const [sortState, setSortState] = useState<CustomerSortState>(null);
  const pageSize = 100;

  useEffect(() => {
    const cancelledRef = { cancelled: false };
    setPage(1);
    fetchAllCustomers(search, cancelledRef)
      .then(({ rows, total: fetchedTotal }) => {
        if (cancelledRef.cancelled) return;
        setCustomers(
          rows.map(mapCustomerCard).filter((row): row is CustomerRow => row !== null),
        );
        setTotal(fetchedTotal);
      })
      .catch(() => {
        if (!cancelledRef.cancelled) {
          setCustomers([]);
          setTotal(null);
        }
      });
    return () => {
      cancelledRef.cancelled = true;
    };
  }, [search]);

  const sortedRows = sortCustomerRows(
    customers.filter((c) => type === "Tüm Türler" || c.type === type),
    sortState,
  );
  const rows = sortedRows.slice((page - 1) * pageSize, page * pageSize);

  const activeSort = sortState ?? defaultSort;
  const changeSort = (key: CustomerSortKey) => {
    setSortState((current) => {
      if (!current || current.key !== key) return { key, direction: "asc" };
      if (current.direction === "asc") return { key, direction: "desc" };
      return null;
    });
  };

  const sortIndicator = (key: CustomerSortKey) => {
    if (activeSort.key !== key) return "↕";
    return activeSort.direction === "asc" ? "↑" : "↓";
  };

  return (
    <div className="crm-page">
      <CrmPageHeader
        title="Müşteriler"
        subtitle="Müşteri ilişkilerini, proje bağlantılarını, tahsilatları ve kalan bakiyeleri tek yerden izleyin."
      >
        <FinanceExportMenu
          title="Müşteriler"
          filename="crm-musteriler"
          rows={rows}
          columns={columns}
        />
        <Link className="crm-primary" to="/apps/crm/customers/new">
          Yeni Müşteri
        </Link>
      </CrmPageHeader>
      <section className="crm-kpis">
        <article className="erp-card">
          <span>Toplam Müşteri</span>
          <strong>{total === null ? "—" : total.toLocaleString("tr-TR")}</strong>
        </article>
        <article className="erp-card">
          <span>Toplam Tahsilat</span>
          <strong>—</strong>
        </article>
        <article className="erp-card">
          <span>Bekleyen Tahsilat</span>
          <strong>—</strong>
        </article>
        <article className="erp-card">
          <span>Bakiyesi Kapanan</span>
          <strong>—</strong>
        </article>
      </section>
      <div className="erp-card crm-filters">
        <label className="search">
          <Search />
          <input
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              setPage(1);
            }}
          />
        </label>
        <select
          value={type}
          onChange={(e) => {
            setType(e.target.value);
            setPage(1);
          }}
        >
          <option>Tüm Türler</option>
          <option>Tüzel Kişi</option>
          <option>Gerçek Kişi</option>
        </select>
        <select>
          <option>Tüm Projeler</option>
        </select>
        <select>
          <option>Tüm Bakiyeler</option>
          <option>Bakiyesi Açık</option>
          <option>Bakiyesi Kapalı</option>
        </select>
      </div>
      <div className="erp-card crm-table-wrap">
        <table className="crm-table">
          <thead>
            <tr>
              <th
                aria-sort={
                  activeSort.key === "name"
                    ? activeSort.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button
                  type="button"
                  onClick={() => changeSort("name")}
                  aria-label="Müşteri adına göre sırala"
                  style={{
                    alignItems: "center",
                    background: "none",
                    border: 0,
                    color: "inherit",
                    cursor: "pointer",
                    display: "inline-flex",
                    font: "inherit",
                    gap: "0.3rem",
                    padding: 0,
                  }}
                >
                  Müşteri <span aria-hidden="true">{sortIndicator("name")}</span>
                </button>
              </th>
              <th>Telefon</th>
              <th>Projeler</th>
              <th>Planlanan Alacak</th>
              <th>Tahsil Edilen</th>
              <th
                aria-sort={
                  activeSort.key === "balance"
                    ? activeSort.direction === "asc"
                      ? "ascending"
                      : "descending"
                    : "none"
                }
              >
                <button
                  type="button"
                  onClick={() => changeSort("balance")}
                  aria-label="Kalan bakiyeye göre sırala"
                  style={{
                    alignItems: "center",
                    background: "none",
                    border: 0,
                    color: "inherit",
                    cursor: "pointer",
                    display: "inline-flex",
                    font: "inherit",
                    gap: "0.3rem",
                    padding: 0,
                  }}
                >
                  Kalan Bakiye{" "}
                  <span aria-hidden="true">{sortIndicator("balance")}</span>
                </button>
              </th>
              <th>İşlemler</th>
            </tr>
          </thead>
          <tbody>
            {rows.map((c) => (
              <tr key={c.id}>
                <td>
                  <div className="crm-customer-cell">
                    <i>
                      {c.type === "Tüzel Kişi" ? <Building2 /> : <UserRound />}
                    </i>
                    <span>
                      <Link to={`/apps/crm/customers/${c.id}`}>
                        {c.name}
                      </Link>
                      <small>
                        {c.type} · {c.taxNo}
                      </small>
                    </span>
                  </div>
                </td>
                <td>
                  {c.phone}
                  <small>{c.whatsapp && `WhatsApp: ${c.whatsapp}`}</small>
                </td>
                <td>{c.projects.join(", ")}</td>
                <td>{c.planned}</td>
                <td>{c.collected}</td>
                <td>
                  <strong>{c.balance}</strong>
                </td>
                <td>
                  <div className="crm-row-actions">
                    <Link
                      title="Görüntüle"
                      to={`/apps/crm/customers/${c.id}`}
                    >
                      <Eye />
                    </Link>
                    <Link
                      title="Düzenle"
                      to={`/apps/crm/customers/${c.id}/edit`}
                    >
                      <Pencil />
                    </Link>
                    <button title="Sil" type="button">
                      <Trash2 />
                    </button>
                    <button title="Diğer" type="button">
                      <MoreHorizontal />
                    </button>
                  </div>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
        {!rows.length && (
          <div className="crm-empty">Gösterilecek müşteri bulunamadı.</div>
        )}
        {rows.length > 0 && (
          <footer className="crm-pagination">
            <span>
              {(page - 1) * pageSize + 1}–{(page - 1) * pageSize + rows.length} / {total ?? "—"}
            </span>
            <button
              disabled={page === 1}
              onClick={() => setPage((current) => Math.max(1, current - 1))}
            >
              Önceki
            </button>
            <button
              disabled={total === null || page * pageSize >= total}
              onClick={() => setPage((current) => current + 1)}
            >
              Sonraki
            </button>
          </footer>
        )}
      </div>
    </div>
  );
}
