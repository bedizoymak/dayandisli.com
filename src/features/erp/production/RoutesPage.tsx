import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { createProductionRoute, createProductionRouteStep, listMachines, listProductionRoutes, listProductionRouteSteps } from "../shared/erpApi";
import { Machine, ProductionRoute, ProductionRouteStep } from "../shared/types";
import { formatDateTime } from "../shared/formatters";
import { useToast } from "@/hooks/use-toast";

export default function RoutesPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<ProductionRoute[]>([]);
  const [steps, setSteps] = useState<ProductionRouteStep[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedRouteId, setSelectedRouteId] = useState("");
  const [routeForm, setRouteForm] = useState({ name: "", description: "", is_template: true });
  const [stepForm, setStepForm] = useState({ step_no: "10", operation_name: "", machine_id: "", estimated_minutes: "0" });
  const [error, setError] = useState<string | null>(null);

  const load = async () => {
    setLoading(true);
    const [routesResult, machinesResult] = await Promise.all([listProductionRoutes(), listMachines()]);
    if (routesResult.error) {
      setError(routesResult.error);
      toast({ title: "Hata", description: `Rotalar yüklenemedi: ${routesResult.error}`, variant: "destructive" });
    } else {
      setError(null);
    }
    setRows(routesResult.data);
    setMachines(machinesResult.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, [toast]);

  const loadSteps = async (routeId: string) => {
    setSelectedRouteId(routeId);
    if (!routeId) {
      setSteps([]);
      return;
    }

    const result = await listProductionRouteSteps(routeId);
    if (result.error) {
      toast({ title: "Hata", description: result.error, variant: "destructive" });
      return;
    }
    setSteps(result.data);
  };

  return (
    <ERPLayout title="Üretim Rotaları">
      <PageHeader
        title="Üretim ve Rota Yönetimi"
        description="Rota şablonlarını ve operasyon sıralarını yönetin."
      />

      {error ? <MigrationNotice message={error} /> : null}

      <FormSection title="Yeni Rota" description="Sık kullanılan üretim rotalarını şablon olarak tanımlayın.">
        <form
          className="grid gap-3 md:grid-cols-[1fr_1fr_180px_auto]"
          onSubmit={async (event) => {
            event.preventDefault();
            if (!routeForm.name.trim()) return;
            const result = await createProductionRoute(routeForm);
            if (result.error) {
              toast({ title: "Rota Eklenemedi", description: result.error, variant: "destructive" });
              return;
            }
            setRouteForm({ name: "", description: "", is_template: true });
            await load();
          }}
        >
          <Input placeholder="Rota adı" value={routeForm.name} onChange={(event) => setRouteForm((prev) => ({ ...prev, name: event.target.value }))} />
          <Input placeholder="Açıklama" value={routeForm.description} onChange={(event) => setRouteForm((prev) => ({ ...prev, description: event.target.value }))} />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={routeForm.is_template ? "template" : "normal"}
            onChange={(event) => setRouteForm((prev) => ({ ...prev, is_template: event.target.value === "template" }))}
          >
            <option value="template">Şablon</option>
            <option value="normal">Normal</option>
          </select>
          <Button type="submit">Rota Ekle</Button>
        </form>
      </FormSection>

      {loading ? (
        <p className="text-sm text-muted-foreground">Rotalar yükleniyor...</p>
      ) : rows.length === 0 ? (
        <EmptyState
          title="Rota kaydı bulunamadı"
          description="İlk sürümde rota adımları için metadata yapısı hazırdır. Sonraki fazda rota adım editörü eklenecektir."
        />
      ) : (
        <DataTable
          columns={[
            { key: "name", header: "Rota Adı", render: (row) => row.name },
            { key: "description", header: "Açıklama", render: (row) => row.description || "-" },
            { key: "template", header: "Şablon", render: (row) => (row.is_template ? "Evet" : "Hayır") },
            { key: "created", header: "Oluşturulma", render: (row) => formatDateTime(row.created_at) },
            {
              key: "actions",
              header: "Adımlar",
              className: "text-right",
              render: (row) => (
                <Button variant="outline" size="sm" onClick={() => loadSteps(row.id)}>
                  Adımları Yönet
                </Button>
              ),
            },
          ]}
          data={rows}
          rowKey={(row) => row.id}
          emptyMessage="Rota kaydı yok"
        />
      )}

      {selectedRouteId ? (
        <FormSection title="Rota Adımları" description="Operasyon sırasını 10, 20, 30 gibi aralıklı numaralarla yönetin.">
          <form
            className="grid gap-3 md:grid-cols-[120px_1fr_220px_160px_auto]"
            onSubmit={async (event) => {
              event.preventDefault();
              if (!stepForm.operation_name.trim()) return;
              const result = await createProductionRouteStep({
                route_id: selectedRouteId,
                step_no: Number(stepForm.step_no || 10),
                operation_name: stepForm.operation_name,
                machine_id: stepForm.machine_id || null,
                estimated_minutes: Number(stepForm.estimated_minutes || 0),
              });
              if (result.error) {
                toast({ title: "Adım Eklenemedi", description: result.error, variant: "destructive" });
                return;
              }
              setStepForm((prev) => ({ ...prev, step_no: String(Number(prev.step_no || 0) + 10), operation_name: "", machine_id: "", estimated_minutes: "0" }));
              await loadSteps(selectedRouteId);
            }}
          >
            <Input type="number" value={stepForm.step_no} onChange={(event) => setStepForm((prev) => ({ ...prev, step_no: event.target.value }))} />
            <Input placeholder="Operasyon adı" value={stepForm.operation_name} onChange={(event) => setStepForm((prev) => ({ ...prev, operation_name: event.target.value }))} />
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={stepForm.machine_id} onChange={(event) => setStepForm((prev) => ({ ...prev, machine_id: event.target.value }))}>
              <option value="">Makine seçiniz</option>
              {machines.map((machine) => (
                <option key={machine.id} value={machine.id}>
                  {machine.name}
                </option>
              ))}
            </select>
            <Input type="number" placeholder="Tahmini dk" value={stepForm.estimated_minutes} onChange={(event) => setStepForm((prev) => ({ ...prev, estimated_minutes: event.target.value }))} />
            <Button type="submit">Adım Ekle</Button>
          </form>

          <DataTable
            columns={[
              { key: "step", header: "Sıra", render: (row) => row.step_no },
              { key: "operation", header: "Operasyon", render: (row) => row.operation_name },
              { key: "machine", header: "Makine", render: (row) => machines.find((machine) => machine.id === row.machine_id)?.name || "-" },
              { key: "minutes", header: "Tahmini Dk", className: "text-right", render: (row) => row.estimated_minutes },
            ]}
            data={steps}
            rowKey={(row) => row.id}
            emptyMessage="Rota adımı yok"
          />
        </FormSection>
      ) : null}
    </ERPLayout>
  );
}
