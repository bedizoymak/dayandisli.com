import { FormEvent, useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Plus, RefreshCw } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { ERPLayout } from "../layout/ERPLayout";
import {
  convertLeadToOpportunity,
  createCRMActivity,
  createCRMLead,
  createCRMOpportunity,
  createCRMTask,
  createStakeholder,
  listCRMActivities,
  listCRMLeads,
  listCRMOpportunities,
  listCRMTasks,
  listStakeholders,
  updateCRMLead,
  updateCRMOpportunity,
  updateCRMTask,
} from "../shared/erpApi";
import { formatCurrency, formatDate, formatDateTime } from "../shared/formatters";
import {
  CRM_ACTIVITY_TYPE_LABELS,
  CRM_LEAD_STATUS_LABELS,
  CRM_OPPORTUNITY_STATUS_LABELS,
  CRM_RELATED_TYPE_LABELS,
  CRM_TASK_STATUS_LABELS,
  STAKEHOLDER_TYPE_LABELS,
} from "../shared/statusLabels";
import {
  CRMActivity,
  CRMActivityType,
  CRMLead,
  CRMLeadStatus,
  CRMOpportunity,
  CRMOpportunityStatus,
  CRMRelatedType,
  CRMTask,
  CRMTaskStatus,
  Priority,
  Stakeholder,
} from "../shared/types";

type TabKey = "leads" | "opportunities" | "companies" | "contacts" | "tasks" | "activities";

const tabs: Array<{ key: TabKey; label: string }> = [
  { key: "leads", label: "Potansiyel Müşteriler" },
  { key: "opportunities", label: "Fırsatlar" },
  { key: "companies", label: "Firmalar" },
  { key: "contacts", label: "Kişiler" },
  { key: "tasks", label: "Görevler" },
  { key: "activities", label: "Etkinlikler" },
];

const leadStatuses: Array<CRMLeadStatus | "all"> = ["all", "new", "contacted", "qualified", "converted", "lost"];
const opportunityStatuses: Array<CRMOpportunityStatus | "all"> = ["all", "open", "proposal", "won", "lost", "cancelled"];
const taskStatuses: Array<CRMTaskStatus | "all"> = ["all", "open", "in_progress", "completed", "cancelled"];
const priorities: Priority[] = ["low", "normal", "high", "urgent"];
const activityTypes: CRMActivityType[] = ["note", "call", "meeting", "email", "visit", "status_change"];
const relatedTypes: CRMRelatedType[] = ["lead", "opportunity", "stakeholder", "quotation", "sales_order"];

const priorityLabels: Record<Priority, string> = {
  low: "Düşük",
  normal: "Normal",
  high: "Yüksek",
  urgent: "Acil",
};

function statusTone(status: string) {
  if (["converted", "won", "completed"].includes(status)) return "success" as const;
  if (["lost", "cancelled"].includes(status)) return "muted" as const;
  if (["proposal", "qualified", "in_progress"].includes(status)) return "warning" as const;
  return "default" as const;
}

function Field({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="text-sm">
      <span className="font-medium text-foreground">{label}</span>
      <div className="mt-1">{children}</div>
    </label>
  );
}

export default function CRMOperationsPage() {
  const { toast } = useToast();
  const [tab, setTab] = useState<TabKey>("leads");
  const [search, setSearch] = useState("");
  const [leadStatus, setLeadStatus] = useState<CRMLeadStatus | "all">("all");
  const [opportunityStatus, setOpportunityStatus] = useState<CRMOpportunityStatus | "all">("all");
  const [taskStatus, setTaskStatus] = useState<CRMTaskStatus | "all">("all");
  const [leads, setLeads] = useState<CRMLead[]>([]);
  const [opportunities, setOpportunities] = useState<CRMOpportunity[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [tasks, setTasks] = useState<CRMTask[]>([]);
  const [activities, setActivities] = useState<CRMActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [leadForm, setLeadForm] = useState({ company_name: "", contact_name: "", phone: "", email: "", source: "", priority: "normal" as Priority, notes: "" });
  const [opportunityForm, setOpportunityForm] = useState({ title: "", lead_id: "", stakeholder_id: "", expected_value: "", probability: "25", expected_close_date: "", notes: "" });
  const [companyForm, setCompanyForm] = useState({ company_name: "", contact_name: "", phone: "", email: "", notes: "" });
  const [taskForm, setTaskForm] = useState({ title: "", related_type: "" as CRMRelatedType | "", related_id: "", priority: "normal" as Priority, due_date: "", notes: "" });
  const [activityForm, setActivityForm] = useState({ subject: "", activity_type: "note" as CRMActivityType, related_type: "" as CRMRelatedType | "", related_id: "", notes: "" });

  const load = async () => {
    setLoading(true);
    const [leadResult, opportunityResult, stakeholderResult, taskResult, activityResult] = await Promise.all([
      listCRMLeads(search, leadStatus),
      listCRMOpportunities(search, opportunityStatus),
      listStakeholders(search),
      listCRMTasks(search, taskStatus),
      listCRMActivities(search),
    ]);

    const firstError = leadResult.error || opportunityResult.error || stakeholderResult.error || taskResult.error || activityResult.error;
    setError(firstError);
    setLeads(leadResult.data);
    setOpportunities(opportunityResult.data);
    setStakeholders(stakeholderResult.data);
    setTasks(taskResult.data);
    setActivities(activityResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const stakeholderNameById = useMemo(
    () => Object.fromEntries(stakeholders.map((item) => [item.id, item.company_name])),
    [stakeholders],
  );
  const leadNameById = useMemo(() => Object.fromEntries(leads.map((item) => [item.id, `${item.lead_no} - ${item.company_name}`])), [leads]);

  const reloadAfter = async (message: string) => {
    toast({ title: "Kaydedildi", description: message });
    await load();
  };

  const submitLead = async (event: FormEvent) => {
    event.preventDefault();
    const result = await createCRMLead({ ...leadForm, status: "new" });
    if (result.error) return toast({ title: "Hata", description: result.error, variant: "destructive" });
    setLeadForm({ company_name: "", contact_name: "", phone: "", email: "", source: "", priority: "normal", notes: "" });
    await reloadAfter("Potansiyel müşteri oluşturuldu.");
  };

  const submitOpportunity = async (event: FormEvent) => {
    event.preventDefault();
    const result = await createCRMOpportunity({
      title: opportunityForm.title,
      lead_id: opportunityForm.lead_id || null,
      stakeholder_id: opportunityForm.stakeholder_id || null,
      expected_value: Number(opportunityForm.expected_value || 0),
      probability: Number(opportunityForm.probability || 0),
      expected_close_date: opportunityForm.expected_close_date || null,
      notes: opportunityForm.notes,
    });
    if (result.error) return toast({ title: "Hata", description: result.error, variant: "destructive" });
    setOpportunityForm({ title: "", lead_id: "", stakeholder_id: "", expected_value: "", probability: "25", expected_close_date: "", notes: "" });
    await reloadAfter("Fırsat oluşturuldu.");
  };

  const submitCompany = async (event: FormEvent) => {
    event.preventDefault();
    const result = await createStakeholder({ type: "customer", is_active: true, country: "Türkiye", risk_limit: 0, current_balance: 0, ...companyForm });
    if (result.error) return toast({ title: "Hata", description: result.error, variant: "destructive" });
    setCompanyForm({ company_name: "", contact_name: "", phone: "", email: "", notes: "" });
    await reloadAfter("Firma kartı oluşturuldu.");
  };

  const submitTask = async (event: FormEvent) => {
    event.preventDefault();
    const result = await createCRMTask({
      title: taskForm.title,
      related_type: taskForm.related_type || null,
      related_id: taskForm.related_id || null,
      priority: taskForm.priority,
      due_date: taskForm.due_date || null,
      notes: taskForm.notes,
    });
    if (result.error) return toast({ title: "Hata", description: result.error, variant: "destructive" });
    setTaskForm({ title: "", related_type: "", related_id: "", priority: "normal", due_date: "", notes: "" });
    await reloadAfter("Görev oluşturuldu.");
  };

  const submitActivity = async (event: FormEvent) => {
    event.preventDefault();
    const result = await createCRMActivity({
      subject: activityForm.subject,
      activity_type: activityForm.activity_type,
      related_type: activityForm.related_type || null,
      related_id: activityForm.related_id || null,
      notes: activityForm.notes,
    });
    if (result.error) return toast({ title: "Hata", description: result.error, variant: "destructive" });
    setActivityForm({ subject: "", activity_type: "note", related_type: "", related_id: "", notes: "" });
    await reloadAfter("Etkinlik kaydedildi.");
  };

  return (
    <ERPLayout title="Müşteri İlişkileri">
      <PageHeader
        title="Müşteri İlişkileri"
        description="Potansiyel müşteri, fırsat, firma, kişi, görev ve etkinlik akışlarını yönetin."
        actions={<Button variant="outline" className="gap-2" onClick={load}><RefreshCw className="h-4 w-4" /> Yenile</Button>}
      />

      {error ? <MigrationNotice message={error} /> : null}

      <div className="flex gap-2 overflow-x-auto border-b pb-2">
        {tabs.map((item) => (
          <Button key={item.key} variant={tab === item.key ? "default" : "outline"} size="sm" onClick={() => setTab(item.key)}>
            {item.label}
          </Button>
        ))}
      </div>

      <Card>
        <CardContent className="grid gap-3 pt-6 md:grid-cols-[1fr_auto_auto_auto]">
          <Input placeholder="Ara..." value={search} onChange={(event) => setSearch(event.target.value)} />
          {tab === "leads" ? (
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={leadStatus} onChange={(event) => setLeadStatus(event.target.value as CRMLeadStatus | "all")}>
              {leadStatuses.map((status) => <option key={status} value={status}>{status === "all" ? "Tüm Durumlar" : CRM_LEAD_STATUS_LABELS[status]}</option>)}
            </select>
          ) : null}
          {tab === "opportunities" ? (
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={opportunityStatus} onChange={(event) => setOpportunityStatus(event.target.value as CRMOpportunityStatus | "all")}>
              {opportunityStatuses.map((status) => <option key={status} value={status}>{status === "all" ? "Tüm Durumlar" : CRM_OPPORTUNITY_STATUS_LABELS[status]}</option>)}
            </select>
          ) : null}
          {tab === "tasks" ? (
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={taskStatus} onChange={(event) => setTaskStatus(event.target.value as CRMTaskStatus | "all")}>
              {taskStatuses.map((status) => <option key={status} value={status}>{status === "all" ? "Tüm Durumlar" : CRM_TASK_STATUS_LABELS[status]}</option>)}
            </select>
          ) : null}
          <Button onClick={load}>Filtrele</Button>
        </CardContent>
      </Card>

      {tab === "leads" ? (
        <>
          <Card>
            <CardHeader><CardTitle className="text-lg">Yeni Potansiyel Müşteri</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-4" onSubmit={submitLead}>
                <Field label="Firma"><Input required value={leadForm.company_name} onChange={(e) => setLeadForm((p) => ({ ...p, company_name: e.target.value }))} /></Field>
                <Field label="Kişi"><Input value={leadForm.contact_name} onChange={(e) => setLeadForm((p) => ({ ...p, contact_name: e.target.value }))} /></Field>
                <Field label="Telefon"><Input value={leadForm.phone} onChange={(e) => setLeadForm((p) => ({ ...p, phone: e.target.value }))} /></Field>
                <Field label="E-posta"><Input value={leadForm.email} onChange={(e) => setLeadForm((p) => ({ ...p, email: e.target.value }))} /></Field>
                <Field label="Kaynak"><Input value={leadForm.source} onChange={(e) => setLeadForm((p) => ({ ...p, source: e.target.value }))} /></Field>
                <Field label="Öncelik"><select className="h-10 w-full rounded-md border bg-background px-3" value={leadForm.priority} onChange={(e) => setLeadForm((p) => ({ ...p, priority: e.target.value as Priority }))}>{priorities.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}</select></Field>
                <Field label="Not"><Textarea value={leadForm.notes} onChange={(e) => setLeadForm((p) => ({ ...p, notes: e.target.value }))} /></Field>
                <div className="flex items-end"><Button type="submit" className="gap-2"><Plus className="h-4 w-4" /> Oluştur</Button></div>
              </form>
            </CardContent>
          </Card>
          {loading ? <p className="text-sm text-muted-foreground">Yükleniyor...</p> : leads.length ? (
            <DataTable columns={[
              { key: "no", header: "No", render: (row) => row.lead_no },
              { key: "company", header: "Firma", render: (row) => row.company_name },
              { key: "contact", header: "Kişi", render: (row) => row.contact_name || "-" },
              { key: "phone", header: "Telefon", render: (row) => row.phone || "-" },
              { key: "status", header: "Durum", render: (row) => <StatusBadge label={CRM_LEAD_STATUS_LABELS[row.status]} tone={statusTone(row.status)} /> },
              { key: "action", header: "İşlem", className: "text-right", render: (row) => <Button size="sm" variant="outline" onClick={async () => { const result = await convertLeadToOpportunity(row); if (result.error) toast({ title: "Hata", description: result.error, variant: "destructive" }); else await reloadAfter("Potansiyel müşteri fırsata dönüştürüldü."); }}>Fırsata Dönüştür</Button> },
            ]} data={leads} rowKey={(row) => row.id} />
          ) : <EmptyState title="Potansiyel müşteri yok" description="Yeni kayıt oluşturduğunuzda burada görünecek." />}
        </>
      ) : null}

      {tab === "opportunities" ? (
        <>
          <Card>
            <CardHeader><CardTitle className="text-lg">Yeni Fırsat</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-4" onSubmit={submitOpportunity}>
                <Field label="Başlık"><Input required value={opportunityForm.title} onChange={(e) => setOpportunityForm((p) => ({ ...p, title: e.target.value }))} /></Field>
                <Field label="Potansiyel"><select className="h-10 w-full rounded-md border bg-background px-3" value={opportunityForm.lead_id} onChange={(e) => setOpportunityForm((p) => ({ ...p, lead_id: e.target.value }))}><option value="">Seçim Yok</option>{leads.map((item) => <option key={item.id} value={item.id}>{leadNameById[item.id]}</option>)}</select></Field>
                <Field label="Firma"><select className="h-10 w-full rounded-md border bg-background px-3" value={opportunityForm.stakeholder_id} onChange={(e) => setOpportunityForm((p) => ({ ...p, stakeholder_id: e.target.value }))}><option value="">Seçim Yok</option>{stakeholders.map((item) => <option key={item.id} value={item.id}>{item.company_name}</option>)}</select></Field>
                <Field label="Beklenen Tutar"><Input type="number" value={opportunityForm.expected_value} onChange={(e) => setOpportunityForm((p) => ({ ...p, expected_value: e.target.value }))} /></Field>
                <Field label="Olasılık %"><Input type="number" min="0" max="100" value={opportunityForm.probability} onChange={(e) => setOpportunityForm((p) => ({ ...p, probability: e.target.value }))} /></Field>
                <Field label="Beklenen Kapanış"><Input type="date" value={opportunityForm.expected_close_date} onChange={(e) => setOpportunityForm((p) => ({ ...p, expected_close_date: e.target.value }))} /></Field>
                <Field label="Not"><Textarea value={opportunityForm.notes} onChange={(e) => setOpportunityForm((p) => ({ ...p, notes: e.target.value }))} /></Field>
                <div className="flex items-end"><Button type="submit">Fırsat Oluştur</Button></div>
              </form>
            </CardContent>
          </Card>
          {opportunities.length ? (
            <DataTable columns={[
              { key: "no", header: "No", render: (row) => row.opportunity_no },
              { key: "title", header: "Başlık", render: (row) => row.title },
              { key: "company", header: "Firma", render: (row) => row.stakeholder_id ? stakeholderNameById[row.stakeholder_id] || "-" : "-" },
              { key: "value", header: "Tutar", className: "text-right", render: (row) => formatCurrency(row.expected_value) },
              { key: "probability", header: "Olasılık", render: (row) => `%${row.probability}` },
              { key: "status", header: "Durum", render: (row) => <select className="h-9 rounded-md border bg-background px-2 text-sm" value={row.status} onChange={async (e) => { const result = await updateCRMOpportunity(row.id, { status: e.target.value as CRMOpportunityStatus }); if (result.error) toast({ title: "Hata", description: result.error, variant: "destructive" }); else await load(); }}>{opportunityStatuses.filter((s) => s !== "all").map((s) => <option key={s} value={s}>{CRM_OPPORTUNITY_STATUS_LABELS[s]}</option>)}</select> },
            ]} data={opportunities} rowKey={(row) => row.id} />
          ) : <EmptyState title="Fırsat yok" description="Yeni fırsat oluşturduğunuzda burada görünecek." />}
        </>
      ) : null}

      {tab === "companies" || tab === "contacts" ? (
        <>
          {tab === "companies" ? (
            <Card>
              <CardHeader><CardTitle className="text-lg">Yeni Firma</CardTitle></CardHeader>
              <CardContent>
                <form className="grid gap-3 md:grid-cols-4" onSubmit={submitCompany}>
                  <Field label="Firma"><Input required value={companyForm.company_name} onChange={(e) => setCompanyForm((p) => ({ ...p, company_name: e.target.value }))} /></Field>
                  <Field label="Kişi"><Input value={companyForm.contact_name} onChange={(e) => setCompanyForm((p) => ({ ...p, contact_name: e.target.value }))} /></Field>
                  <Field label="Telefon"><Input value={companyForm.phone} onChange={(e) => setCompanyForm((p) => ({ ...p, phone: e.target.value }))} /></Field>
                  <Field label="E-posta"><Input value={companyForm.email} onChange={(e) => setCompanyForm((p) => ({ ...p, email: e.target.value }))} /></Field>
                  <Field label="Not"><Textarea value={companyForm.notes} onChange={(e) => setCompanyForm((p) => ({ ...p, notes: e.target.value }))} /></Field>
                  <div className="flex items-end"><Button type="submit">Firma Oluştur</Button></div>
                </form>
              </CardContent>
            </Card>
          ) : null}
          <DataTable columns={[
            { key: "company", header: "Firma", render: (row) => <Link className="text-primary underline-offset-4 hover:underline" to={`/stakeholders/${row.id}`}>{row.company_name}</Link> },
            { key: "type", header: "Tip", render: (row) => STAKEHOLDER_TYPE_LABELS[row.type] },
            { key: "contact", header: "Kişi", render: (row) => row.contact_name || "-" },
            { key: "phone", header: "Telefon", render: (row) => row.phone || "-" },
            { key: "email", header: "E-posta", render: (row) => row.email || "-" },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.is_active ? "Aktif" : "Pasif"} tone={row.is_active ? "success" : "muted"} /> },
          ]} data={stakeholders} rowKey={(row) => row.id} emptyMessage="Firma kaydı bulunamadı." />
        </>
      ) : null}

      {tab === "tasks" ? (
        <>
          <Card>
            <CardHeader><CardTitle className="text-lg">Yeni Görev</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-5" onSubmit={submitTask}>
                <Field label="Başlık"><Input required value={taskForm.title} onChange={(e) => setTaskForm((p) => ({ ...p, title: e.target.value }))} /></Field>
                <Field label="Bağlantı Tipi"><select className="h-10 w-full rounded-md border bg-background px-3" value={taskForm.related_type} onChange={(e) => setTaskForm((p) => ({ ...p, related_type: e.target.value as CRMRelatedType | "" }))}><option value="">Yok</option>{relatedTypes.map((t) => <option key={t} value={t}>{CRM_RELATED_TYPE_LABELS[t]}</option>)}</select></Field>
                <Field label="Bağlantı ID"><Input value={taskForm.related_id} onChange={(e) => setTaskForm((p) => ({ ...p, related_id: e.target.value }))} /></Field>
                <Field label="Öncelik"><select className="h-10 w-full rounded-md border bg-background px-3" value={taskForm.priority} onChange={(e) => setTaskForm((p) => ({ ...p, priority: e.target.value as Priority }))}>{priorities.map((p) => <option key={p} value={p}>{priorityLabels[p]}</option>)}</select></Field>
                <Field label="Termin"><Input type="date" value={taskForm.due_date} onChange={(e) => setTaskForm((p) => ({ ...p, due_date: e.target.value }))} /></Field>
                <Field label="Not"><Textarea value={taskForm.notes} onChange={(e) => setTaskForm((p) => ({ ...p, notes: e.target.value }))} /></Field>
                <div className="flex items-end"><Button type="submit">Görev Oluştur</Button></div>
              </form>
            </CardContent>
          </Card>
          <DataTable columns={[
            { key: "title", header: "Görev", render: (row) => row.title },
            { key: "related", header: "Bağlantı", render: (row) => row.related_type ? CRM_RELATED_TYPE_LABELS[row.related_type] : "-" },
            { key: "priority", header: "Öncelik", render: (row) => priorityLabels[row.priority] },
            { key: "due", header: "Termin", render: (row) => formatDate(row.due_date) },
            { key: "status", header: "Durum", render: (row) => <select className="h-9 rounded-md border bg-background px-2 text-sm" value={row.status} onChange={async (e) => { const result = await updateCRMTask(row.id, { status: e.target.value as CRMTaskStatus }); if (result.error) toast({ title: "Hata", description: result.error, variant: "destructive" }); else await load(); }}>{taskStatuses.filter((s) => s !== "all").map((s) => <option key={s} value={s}>{CRM_TASK_STATUS_LABELS[s]}</option>)}</select> },
          ]} data={tasks} rowKey={(row) => row.id} emptyMessage="Görev bulunamadı." />
        </>
      ) : null}

      {tab === "activities" ? (
        <>
          <Card>
            <CardHeader><CardTitle className="text-lg">Yeni Etkinlik</CardTitle></CardHeader>
            <CardContent>
              <form className="grid gap-3 md:grid-cols-5" onSubmit={submitActivity}>
                <Field label="Konu"><Input required value={activityForm.subject} onChange={(e) => setActivityForm((p) => ({ ...p, subject: e.target.value }))} /></Field>
                <Field label="Tip"><select className="h-10 w-full rounded-md border bg-background px-3" value={activityForm.activity_type} onChange={(e) => setActivityForm((p) => ({ ...p, activity_type: e.target.value as CRMActivityType }))}>{activityTypes.map((t) => <option key={t} value={t}>{CRM_ACTIVITY_TYPE_LABELS[t]}</option>)}</select></Field>
                <Field label="Bağlantı Tipi"><select className="h-10 w-full rounded-md border bg-background px-3" value={activityForm.related_type} onChange={(e) => setActivityForm((p) => ({ ...p, related_type: e.target.value as CRMRelatedType | "" }))}><option value="">Yok</option>{relatedTypes.map((t) => <option key={t} value={t}>{CRM_RELATED_TYPE_LABELS[t]}</option>)}</select></Field>
                <Field label="Bağlantı ID"><Input value={activityForm.related_id} onChange={(e) => setActivityForm((p) => ({ ...p, related_id: e.target.value }))} /></Field>
                <Field label="Not"><Textarea value={activityForm.notes} onChange={(e) => setActivityForm((p) => ({ ...p, notes: e.target.value }))} /></Field>
                <div className="flex items-end"><Button type="submit">Etkinlik Kaydet</Button></div>
              </form>
            </CardContent>
          </Card>
          <DataTable columns={[
            { key: "subject", header: "Konu", render: (row) => row.subject },
            { key: "type", header: "Tip", render: (row) => CRM_ACTIVITY_TYPE_LABELS[row.activity_type] },
            { key: "related", header: "Bağlantı", render: (row) => row.related_type ? CRM_RELATED_TYPE_LABELS[row.related_type] : "-" },
            { key: "date", header: "Tarih", render: (row) => formatDateTime(row.activity_date) },
            { key: "notes", header: "Not", render: (row) => row.notes || "-" },
          ]} data={activities} rowKey={(row) => row.id} emptyMessage="Etkinlik bulunamadı." />
        </>
      ) : null}
    </ERPLayout>
  );
}
