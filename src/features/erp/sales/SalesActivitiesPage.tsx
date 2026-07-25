import { FormEvent, useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { useToast } from "@/hooks/use-toast";
import { ERPLayout } from "../layout/ERPLayout";
import { createCRMActivity, listCRMActivities } from "../shared/erpApi";
import { formatDateTime } from "../shared/formatters";
import { CRM_ACTIVITY_TYPE_LABELS, CRM_RELATED_TYPE_LABELS } from "../shared/statusLabels";
import { CRMActivity, CRMActivityType, CRMRelatedType } from "../shared/types";

const activityTypes: CRMActivityType[] = ["note", "call", "meeting", "email", "visit", "status_change"];
const relatedTypes: CRMRelatedType[] = ["opportunity", "quotation", "sales_order", "stakeholder"];

export default function SalesActivitiesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<CRMActivity[]>([]);
  const [search, setSearch] = useState("");
  const [relatedType, setRelatedType] = useState<CRMRelatedType | "all">("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [form, setForm] = useState({ subject: "", activity_type: "note" as CRMActivityType, related_type: "opportunity" as CRMRelatedType, related_id: "", notes: "" });

  const load = async () => {
    setLoading(true);
    const result = await listCRMActivities(search, relatedType === "all" ? undefined : relatedType);
    setRows(result.data);
    setError(result.error);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await createCRMActivity({
      subject: form.subject,
      activity_type: form.activity_type,
      related_type: form.related_type,
      related_id: form.related_id || null,
      notes: form.notes,
    });
    if (result.error) {
      toast({ title: "Hata", description: result.error, variant: "destructive" });
      return;
    }
    setForm({ subject: "", activity_type: "note", related_type: "opportunity", related_id: "", notes: "" });
    toast({ title: "Kaydedildi", description: "Satış faaliyeti kaydedildi." });
    await load();
  };

  return (
    <ERPLayout title="Satış Faaliyetleri">
      <PageHeader title="Satış Faaliyetleri" description="Fırsat, teklif, sipariş ve müşteri temaslarını tek ekranda takip edin." />

      {error ? <MigrationNotice message={error} /> : null}

      <Card>
        <CardHeader><CardTitle className="text-lg">Yeni Satış Faaliyeti</CardTitle></CardHeader>
        <CardContent>
          <form className="grid gap-3 md:grid-cols-5" onSubmit={submit}>
            <label className="text-sm">
              Konu
              <Input className="mt-1" required value={form.subject} onChange={(event) => setForm((prev) => ({ ...prev, subject: event.target.value }))} />
            </label>
            <label className="text-sm">
              Tip
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={form.activity_type} onChange={(event) => setForm((prev) => ({ ...prev, activity_type: event.target.value as CRMActivityType }))}>
                {activityTypes.map((type) => <option key={type} value={type}>{CRM_ACTIVITY_TYPE_LABELS[type]}</option>)}
              </select>
            </label>
            <label className="text-sm">
              Bağlantı
              <select className="mt-1 h-10 w-full rounded-md border bg-background px-3" value={form.related_type} onChange={(event) => setForm((prev) => ({ ...prev, related_type: event.target.value as CRMRelatedType }))}>
                {relatedTypes.map((type) => <option key={type} value={type}>{CRM_RELATED_TYPE_LABELS[type]}</option>)}
              </select>
            </label>
            <label className="text-sm">
              Bağlantı ID
              <Input className="mt-1" value={form.related_id} onChange={(event) => setForm((prev) => ({ ...prev, related_id: event.target.value }))} />
            </label>
            <label className="text-sm">
              Not
              <Textarea className="mt-1" value={form.notes} onChange={(event) => setForm((prev) => ({ ...prev, notes: event.target.value }))} />
            </label>
            <div className="flex items-end">
              <Button type="submit">Kaydet</Button>
            </div>
          </form>
        </CardContent>
      </Card>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_220px_auto]">
          <Input placeholder="Konu veya not ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
          <select className="h-10 rounded-md border bg-background px-3 text-sm" value={relatedType} onChange={(event) => setRelatedType(event.target.value as CRMRelatedType | "all")}>
            <option value="all">Tüm Bağlantılar</option>
            {relatedTypes.map((type) => <option key={type} value={type}>{CRM_RELATED_TYPE_LABELS[type]}</option>)}
          </select>
          <Button onClick={load}>Filtrele</Button>
        </CardContent>
      </Card>

      {loading ? (
        <p className="text-sm text-muted-foreground">Yükleniyor...</p>
      ) : rows.length ? (
        <DataTable
          columns={[
            { key: "subject", header: "Konu", render: (row) => row.subject },
            { key: "type", header: "Tip", render: (row) => CRM_ACTIVITY_TYPE_LABELS[row.activity_type] },
            { key: "related", header: "Bağlantı", render: (row) => row.related_type ? CRM_RELATED_TYPE_LABELS[row.related_type] : "-" },
            { key: "date", header: "Tarih", render: (row) => formatDateTime(row.activity_date) },
            { key: "notes", header: "Not", render: (row) => row.notes || "-" },
          ]}
          data={rows}
          rowKey={(row) => row.id}
        />
      ) : (
        <EmptyState title="Satış faaliyeti yok" description="İlk satış faaliyeti kaydedildiğinde burada görünecek." />
      )}
    </ERPLayout>
  );
}
