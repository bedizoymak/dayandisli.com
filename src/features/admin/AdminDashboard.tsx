import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AdminLayout from "./AdminLayout";
import { AdminEmptyState, AdminMetricGrid, AdminSection } from "./AdminPage";
import { formatAdminValue, getAdminOverview } from "./adminData";

type Overview = Awaited<ReturnType<typeof getAdminOverview>>;

export default function AdminDashboard() {
  const [overview, setOverview] = useState<Overview | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    getAdminOverview().then((data) => {
      setOverview(data);
      setLoading(false);
    });
  }, []);

  const metrics = [
    { label: "Müşteriler", value: String(overview?.customers.data.length ?? 0), detail: "Aktif cari kayıtları" },
    { label: "Teklifler", value: String(overview?.quotations.data.length ?? 0), detail: "Son teklif kayıtları" },
    { label: "Satış Siparişleri", value: String(overview?.salesOrders.data.length ?? 0), detail: "ERP satış akışı" },
    { label: "Açık İş Emirleri", value: String(overview?.workOrders.data.filter((row) => !["completed", "cancelled"].includes(row.status)).length ?? 0), detail: "Üretim takibi" },
  ];

  return (
    <AdminLayout title="Genel Bakış" description="Dayan Dişli içerik, satış ve üretim yönetimi">
      <AdminMetricGrid metrics={metrics} />

      {overview?.database.error ? (
        <div className="rounded-md border border-amber-200 bg-amber-50 px-4 py-3 text-sm text-amber-900">{overview.database.error}</div>
      ) : null}

      <div className="grid gap-4 xl:grid-cols-[1.2fr_0.8fr]">
        <AdminSection
          title="Son Teklifler"
          action={
            <Button asChild size="sm" variant="outline">
              <Link to="/teklifler">Tümünü Gör</Link>
            </Button>
          }
        >
          {loading ? (
            <AdminEmptyState message="Veriler yükleniyor..." />
          ) : overview?.quotations.data.length ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead>Teklif</TableHead>
                  <TableHead>Firma</TableHead>
                  <TableHead>Toplam</TableHead>
                  <TableHead>Tarih</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {overview.quotations.data.map((row) => (
                  <TableRow key={row.id}>
                    <TableCell className="font-medium">{row.teklif_no}</TableCell>
                    <TableCell>{row.firma}</TableCell>
                    <TableCell>{formatAdminValue(row.total, "currency")}</TableCell>
                    <TableCell>{formatAdminValue(row.created_at, "date")}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <AdminEmptyState message={overview?.quotations.error || "Henüz teklif kaydı yok."} />
          )}
        </AdminSection>

        <AdminSection title="Operasyon Durumu">
          <div className="space-y-3">
            {[
              ["Tedarikçiler", overview?.suppliers.data.length ?? 0, "/tedarikciler"],
              ["Stok Kartları", overview?.inventory.data.length ?? 0, "/inventory"],
              ["Personeller", overview?.employees.data.length ?? 0, "/hr"],
              ["Veritabanı", overview?.database.data.label ?? "Kontrol ediliyor", "/ayarlar"],
            ].map(([label, value, path]) => (
              <Link key={String(label)} to={String(path)} className="flex items-center justify-between rounded-md border px-3 py-2 text-sm hover:bg-slate-50">
                <span className="text-slate-600">{label}</span>
                <span className="font-semibold">{value}</span>
              </Link>
            ))}
          </div>
        </AdminSection>
      </div>
    </AdminLayout>
  );
}
