import { useState } from "react";
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
} from "../finance-preview/FinanceNavigationTools";
import { crmCustomers } from "./crmCustomerData";
import { CrmPageHeader } from "./CrmShared";
const columns: ExportColumn<(typeof crmCustomers)[number]>[] = [
  { header: "Müşteri", value: (r) => r.name },
  { header: "Tür", value: (r) => r.type },
  { header: "TC/VKN", value: (r) => r.taxNo },
  { header: "Telefon", value: (r) => r.phone },
  { header: "Projeler", value: (r) => r.projects.join(", ") },
  { header: "Planlanan Alacak", value: (r) => r.planned },
  { header: "Tahsil Edilen", value: (r) => r.collected },
  { header: "Kalan Bakiye", value: (r) => r.balance },
];
export function CustomerListPage() {
  const [search, setSearch] = useState("");
  const [type, setType] = useState("Tüm Türler");
  const rows = crmCustomers.filter(
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
        <Link className="crm-primary" to="/apps/demo/crm/customers/new">
          Yeni Müşteri
        </Link>
      </CrmPageHeader>
      <section className="crm-kpis">
        {[
          ["Toplam Müşteri", "128"],
          ["Toplam Tahsilat", "₺8,42M"],
          ["Bekleyen Tahsilat", "₺3,44M"],
          ["Bakiyesi Kapanan", "46"],
        ].map((item) => (
          <article className="ebru-card" key={item[0]}>
            <span>{item[0]}</span>
            <strong>{item[1]}</strong>
          </article>
        ))}
      </section>
      <div className="ebru-card crm-filters">
        <label className="search">
          <Search />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Firma, kişi, telefon, e-posta, TC/VKN ara"
          />
        </label>
        <select value={type} onChange={(e) => setType(e.target.value)}>
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
      <div className="ebru-card crm-table-wrap">
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
                      <Link to={`/apps/demo/crm/customers/${c.id}`}>
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
                      to={`/apps/demo/crm/customers/${c.id}`}
                    >
                      <Eye />
                    </Link>
                    <Link
                      title="Düzenle"
                      to={`/apps/demo/crm/customers/${c.id}/edit`}
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
        <footer className="crm-pagination">
          <span>
            1–{rows.length} / {rows.length}
          </span>
          <button disabled>Önceki</button>
          <button>Sonraki</button>
        </footer>
      </div>
    </div>
  );
}
