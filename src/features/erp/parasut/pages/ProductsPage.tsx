import { useNavigate } from "react-router-dom";
import { Badge } from "@/components/ui/badge";
import type { DataTableColumn } from "@/components/erp/DataTable";
import { ParasutListPage } from "../components/ParasutListPage";
import { formatParasutCurrency, formatParasutDateTime } from "../utils/format";
import type { MirrorRowBase, ProductAttributes } from "../types";

type ProductRow = MirrorRowBase & { attributes: ProductAttributes };

export default function ProductsPage() {
  const navigate = useNavigate();

  const columns: DataTableColumn<ProductRow>[] = [
    { key: "code", header: "Kod", render: (row) => row.attributes.code ?? "—" },
    { key: "name", header: "Ad", render: (row) => row.attributes.name ?? "—" },
    { key: "type", header: "Tür", render: (row) => (row.attributes.inventory_tracking ? "Stoklu Ürün" : "Hizmet / Stoksuz") },
    { key: "unit", header: "Birim", render: (row) => row.attributes.unit ?? "—" },
    { key: "sale_price", header: "Satış Fiyatı", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.list_price, row.attributes.currency) },
    { key: "buy_price", header: "Alış Fiyatı", className: "text-right", render: (row) => formatParasutCurrency(row.attributes.buying_price, row.attributes.buying_currency) },
    { key: "vat", header: "KDV", className: "text-right", render: (row) => (row.attributes.vat_rate ? `%${row.attributes.vat_rate}` : "—") },
    { key: "currency", header: "Para Birimi", render: (row) => row.attributes.currency ?? "—" },
    { key: "active", header: "Aktiflik", render: (row) => <Badge variant={row.attributes.archived ? "secondary" : "outline"}>{row.attributes.archived ? "Arşivlendi" : "Aktif"}</Badge> },
    { key: "updated", header: "Son Güncelleme", render: (row) => formatParasutDateTime(row.last_seen_at) },
  ];

  return (
    <ParasutListPage
      title="Ürünler ve Hizmetler"
      description="Paraşüt aynasına senkronize edilmiş ürün ve hizmet kartları."
      resource="products"
      columns={columns}
      searchPlaceholder="Ad, kod veya barkod ara..."
      emptyDescription="Senkronize edilmiş ürün/hizmet kaydı bulunmuyor."
      rowKey={(row) => row.parasut_id}
      onRowClick={(row) => navigate(`/apps/parasut/urunler/${row.parasut_id}`)}
    />
  );
}
