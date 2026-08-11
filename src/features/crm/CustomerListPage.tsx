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
};

type CustomerApiRow = {
  parasut_id?: unknown;
  attributes?: Record<string, unknown> | null;
};

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
  return typeof value === "string" && value.trim() ? value : "—";
}

function displayCustomerType(value: unknown) {
  if (value === "company") return "Tüzel Kişi";
  if (value === "person") return "Gerçek Kişi";
  return "—";
}

function displayBalance(value: unknown) {
  const amount = typeof value === "number" ? value : Number(value);
  return Number.isFinite(amount) ? formatMoney(amount) : "—";
}

function mapCustomer(row: CustomerApiRow): CustomerRow | null {
  if (typeof row.parasut_id !== "string" || !row.parasut_id) return null;
  const attributes = row.attributes ?? {};
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
    balance: displayBalance(attributes.trl_balance),
  };
}

export function CustomerListPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("Tüm Türler");
  const [customers, setCustomers] = useState<CustomerRow[]>([]);
  const [total, setTotal] = useState<number | null>(null);
  const [page, setPage] = useState(1);
  const pageSize = 100;

  useEffect(() => {
    let cancelled = false;
    supabase.functions
      .invoke("parasut-api", {
        body: {
          action: "list",
          resource: "customers",
          page,
          pageSize,
          search: search.trim() || undefined,
          filters: { archived: false },
        },
      })
      .then(({ data, error }) => {
        if (cancelled) return;
        const response = data as { rows?: unknown; total?: unknown } | null;
        if (error || !response || !Array.isArray(response.rows)) {
          setCustomers([]);
          setTotal(null);
          return;
        }
        setCustomers(
          (response.rows as CustomerApiRow[])
            .map(mapCustomer)
            .filter((row): row is CustomerRow => row !== null),
        );
        setTotal(typeof response.total === "number" ? response.total : null);
      })
      .catch(() => {
        if (!cancelled) {
          setCustomers([]);
          setTotal(null);
        }
      });
    return () => {
      cancelled = true;
    };
  }, [page, search]);

  const rows = customers.filter(
    (c) =>
      `${c.name} ${c.phone} ${c.email} ${c.taxNo}`
        .toLocaleLowerCase("tr-TR")
        .includes(search.toLocaleLowerCase("tr-TR")) &&
      (type === "Tüm Türler" || c.type === type),
  );
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
              {[
                "Müşteri",
                "Telefon",
                "Projeler",
                "Planlanan Alacak",
                "Tahsil Edilen",
                "Kalan Bakiye",
                "İşlemler",
              ].map((h) => (
                <th key={h}>{h}</th>
              ))}
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
