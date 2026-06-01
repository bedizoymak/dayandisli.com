import { useEffect, useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import AdminLayout from "./AdminLayout";
import { AdminEmptyState, AdminMetricGrid, AdminSection } from "./AdminPage";
import { formatAdminValue, getAdminFinanceSummary, getAdminOperationsSummary } from "./adminData";

type Operations = Awaited<ReturnType<typeof getAdminOperationsSummary>>;
type Finance = Awaited<ReturnType<typeof getAdminFinanceSummary>>;

export function AdminOperationsPage({ mode }: { mode: "stakeholders" | "production" | "stock" | "quality" | "media" }) {
  const [data, setData] = useState<Operations | null>(null);

  useEffect(() => {
    getAdminOperationsSummary().then(setData);
  }, []);

  if (mode === "media") {
    return (
      <AdminLayout title="Medya" description="Ürün görselleri ve teknik doküman akışları">
        <AdminSection title="Medya Yönetimi">
          <AdminEmptyState message="Bu proje ürün görsellerini ve teknik evrakları Supabase üzerinde tutuyor. Görsel yükleme için mevcut mağaza ve ERP dosya akışı kullanılmalı." />
          <div className="mt-4 flex gap-2">
            <Button asChild variant="outline"><Link to="/admin/urunler">Ürün Görselleri</Link></Button>
            <Button asChild variant="outline"><Link to="/documents">Dokümanlar</Link></Button>
          </div>
        </AdminSection>
      </AdminLayout>
    );
  }

  const titleMap = {
    stakeholders: ["Cari Yönetimi", "Müşteri, tedarikçi ve fason paydaş kayıtları"],
    production: ["Üretim", "Siparişten iş emrine üretim akışı"],
    stock: ["Stok ve Satın Alma", "Malzeme, hareket ve satın alma yönetimi"],
    quality: ["Kalite ve Bakım", "Kalite raporları ve bakım görevleri"],
  } as const;

  const [title, description] = titleMap[mode];
  const metrics =
    mode === "production"
      ? [
          { label: "Satış Siparişleri", value: String(data?.salesOrders.data.length ?? 0) },
          { label: "İş Emirleri", value: String(data?.workOrders.data.length ?? 0) },
          { label: "Fason İşleri", value: String(data?.subcontracting.data.length ?? 0) },
          { label: "Sevkiyat", value: String(data?.shipments.data.length ?? 0) },
        ]
      : mode === "stock"
        ? [
            { label: "Stok Kartları", value: String(data?.inventory.data.length ?? 0) },
            { label: "Satın Alma", value: String(data?.purchaseOrders.data.length ?? 0) },
            { label: "Kritik Stok", value: String(data?.inventory.data.filter((item) => item.current_stock <= item.min_stock).length ?? 0) },
            { label: "Aktif Kart", value: String(data?.inventory.data.filter((item) => item.is_active).length ?? 0) },
          ]
        : mode === "quality"
          ? [
              { label: "Kalite Raporları", value: String(data?.quality.data.length ?? 0) },
              { label: "Bakım Görevleri", value: String(data?.maintenance.data.length ?? 0) },
              { label: "Açık Bakım", value: String(data?.maintenance.data.filter((item) => !["completed", "cancelled"].includes(item.status)).length ?? 0) },
              { label: "Açık Kalite", value: String(data?.quality.data.filter((item) => item.result === "pending").length ?? 0) },
            ]
          : [
              { label: "Müşteri", value: "-" },
              { label: "Tedarikçi", value: "-" },
              { label: "Fason", value: String(data?.subcontracting.data.length ?? 0) },
              { label: "Bağlı Modül", value: "ERP" },
            ];

  return (
    <AdminLayout title={title} description={description}>
      <AdminMetricGrid metrics={metrics} />
      <AdminSection title="Hızlı Geçişler">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Satış Siparişleri", "/sales-orders"],
            ["İş Emirleri", "/work-orders"],
            ["Stok Kartları", "/inventory"],
            ["Satın Alma", "/purchase-orders"],
            ["Kalite", "/quality"],
            ["Bakım", "/maintenance"],
            ["Sevkiyat", "/logistics"],
            ["Cari Kartlar", "/crm"],
          ].map(([label, path]) => (
            <Button key={path} asChild variant="outline" className="justify-start">
              <Link to={path}>{label}</Link>
            </Button>
          ))}
        </div>
      </AdminSection>
    </AdminLayout>
  );
}

export function AdminFinancePage() {
  const [data, setData] = useState<Finance | null>(null);

  useEffect(() => {
    getAdminFinanceSummary().then(setData);
  }, []);

  const summary = data?.reports.data;
  const metrics = [
    { label: "Fatura Toplamı", value: formatAdminValue(summary?.invoiceTotal ?? 0, "currency") },
    { label: "Tahsilat/Ödeme", value: formatAdminValue(summary?.paymentTotal ?? 0, "currency") },
    { label: "Fatura Sayısı", value: String(data?.invoices.data.length ?? 0) },
    { label: "Hareket Sayısı", value: String(data?.payments.data.length ?? 0) },
  ];

  return (
    <AdminLayout title="Finans" description="Tahsilat, ödeme ve fatura özeti">
      <AdminMetricGrid metrics={metrics} />
      <AdminSection
        title="Son Finans Hareketleri"
        action={<Button asChild size="sm" variant="outline"><Link to="/finance">ERP Finans</Link></Button>}
      >
        {data?.payments.error ? (
          <AdminEmptyState message={data.payments.error} />
        ) : data?.payments.data.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Tip</TableHead>
                <TableHead>Tutar</TableHead>
                <TableHead>Tarih</TableHead>
                <TableHead>Açıklama</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {data.payments.data.slice(0, 12).map((row) => (
                <TableRow key={row.id}>
                  <TableCell>{row.payment_type}</TableCell>
                  <TableCell>{formatAdminValue(row.amount, "currency")}</TableCell>
                  <TableCell>{formatAdminValue(row.payment_date, "date")}</TableCell>
                  <TableCell>{row.description || "-"}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <AdminEmptyState message="Finans hareketi bulunamadı." />
        )}
      </AdminSection>
    </AdminLayout>
  );
}

export function AdminReportsPage() {
  const [data, setData] = useState<Finance | null>(null);

  useEffect(() => {
    getAdminFinanceSummary().then(setData);
  }, []);

  return (
    <AdminLayout title="Raporlar" description="Yönetim raporları ve ERP özetleri">
      <AdminMetricGrid
        metrics={[
          { label: "Müşteri Bakiyesi", value: formatAdminValue(data?.reports.data.customerBalance ?? 0, "currency") },
          { label: "Tedarikçi Bakiyesi", value: formatAdminValue(data?.reports.data.supplierBalance ?? 0, "currency") },
          { label: "Müşteri Sayısı", value: String(data?.customers.data.length ?? 0) },
          { label: "Tedarikçi Sayısı", value: String(data?.suppliers.data.length ?? 0) },
        ]}
      />
      <AdminSection title="Rapor Modülleri">
        <div className="grid gap-2 sm:grid-cols-2 xl:grid-cols-4">
          {[
            ["Finans Raporları", "/finans/raporlar"],
            ["Üretim Raporları", "/work-orders"],
            ["Kalite Raporları", "/quality"],
            ["Stok Raporları", "/inventory"],
          ].map(([label, path]) => (
            <Button key={path} asChild variant="outline" className="justify-start">
              <Link to={path}>{label}</Link>
            </Button>
          ))}
        </div>
      </AdminSection>
    </AdminLayout>
  );
}
