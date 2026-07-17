import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import type { DataTableColumn } from "@/components/erp/DataTable";
import { ParasutListPage } from "../components/ParasutListPage";
import { formatParasutCurrency, formatParasutDateTime } from "../utils/format";
import type { AccountAttributes, MirrorRowBase } from "../types";

type AccountRow = MirrorRowBase & { attributes: AccountAttributes };

export default function AccountsPage() {
  const navigate = useNavigate();

  const columns: DataTableColumn<AccountRow>[] = [
    { key: "name", header: "Hesap Adı", render: (row) => row.attributes.name ?? "—" },
    { key: "type", header: "Hesap Türü", render: (row) => (row.attributes.account_type === "bank" ? "Banka" : row.attributes.account_type === "cash" ? "Kasa" : row.attributes.account_type ?? "—") },
    { key: "bank", header: "Banka", render: (row) => row.attributes.bank_name ?? "—" },
    { key: "branch", header: "Şube", render: (row) => row.attributes.bank_branch ?? "—" },
    { key: "iban", header: "IBAN", className: "font-mono text-xs", render: (row) => row.attributes.iban ?? "—" },
    { key: "currency", header: "Para Birimi", render: (row) => row.attributes.currency ?? "—" },
    { key: "balance", header: "Bakiye", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.balance, row.attributes.currency) },
    { key: "active", header: "Aktiflik", render: (row) => <Badge variant={row.attributes.archived ? "secondary" : "outline"}>{row.attributes.archived ? "Arşivlendi" : "Aktif"}</Badge> },
    { key: "updated", header: "Son Güncelleme", render: (row) => formatParasutDateTime(row.last_seen_at) },
  ];

  return (
    <ParasutListPage
      title="Kasa ve Bankalar"
      description="Paraşüt aynasına senkronize edilmiş kasa ve banka hesapları."
      resource="accounts"
      columns={columns}
      searchPlaceholder="Hesap adı, banka veya IBAN ara..."
      emptyDescription="Senkronize edilmiş kasa/banka hesabı bulunmuyor."
      rowKey={(row) => row.parasut_id}
      onRowClick={(row) => navigate(`/apps/parasut/kasa-banka/${row.parasut_id}`)}
    />
  );
}
