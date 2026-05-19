import { useEffect, useMemo, useState } from "react";
import { Link, useParams } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { AuditTimeline } from "@/components/erp/AuditTimeline";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { PageHeader } from "@/components/erp/PageHeader";
import { PrintPage } from "@/components/erp/PrintPage";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import { DocumentLinksPanel } from "../documents/DocumentLinksPanel";
import { WorkOrderPrintSheet } from "../production/WorkOrderPrintSheet";
import {
  createShipmentFromSalesOrder,
  createWorkOrderFromSalesOrder,
  getInventoryItemById,
  getQualityReportById,
  getSalesOrderById,
  getShipmentById,
  getStakeholderById,
  getSubcontractingJobById,
  getWorkOrderById,
  listEmployees,
  listERPQuotationsFromExistingTable,
  listInventoryMovementsForItem,
  listInvoices,
  listMachines,
  listQualityMeasurements,
  listQualityReports,
  listSalesOrderItems,
  listSalesOrders,
  listShipmentItems,
  listShipments,
  listStakeholders,
  listSubcontractingJobs,
  listWorkOrderOperations,
  listWorkOrders,
} from "../shared/erpApi";
import { formatCurrency, formatDate, formatDateTime, formatNumber } from "../shared/formatters";
import {
  INVENTORY_ITEM_TYPE_LABELS,
  INVENTORY_MOVEMENT_TYPE_LABELS,
  MEASUREMENT_RESULT_LABELS,
  QUALITY_RESULT_LABELS,
  SALES_ORDER_STATUS_LABELS,
  SHIPMENT_STATUS_LABELS,
  STAKEHOLDER_TYPE_LABELS,
  SUBCONTRACTING_STATUS_LABELS,
  WORK_ORDER_OPERATION_STATUS_LABELS,
  WORK_ORDER_STATUS_LABELS,
} from "../shared/statusLabels";
import {
  InventoryItem,
  InventoryMovement,
  Invoice,
  Employee,
  Machine,
  QualityMeasurement,
  QualityReport,
  SalesOrder,
  SalesOrderItem,
  Shipment,
  ShipmentItem,
  Stakeholder,
  SubcontractingJob,
  WorkOrder,
  WorkOrderOperation,
} from "../shared/types";
import { useToast } from "@/hooks/use-toast";

function BackButton({ to }: { to: string }) {
  return <Button asChild variant="outline"><Link to={to}>Listeye Dön</Link></Button>;
}

export function SalesOrderDetailPage() {
  const { id } = useParams();
  const { toast } = useToast();
  const [order, setOrder] = useState<SalesOrder | null>(null);
  const [items, setItems] = useState<SalesOrderItem[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [workOrders, setWorkOrders] = useState<WorkOrder[]>([]);
  const [shipments, setShipments] = useState<Shipment[]>([]);
  const [invoices, setInvoices] = useState<Invoice[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [orderResult, itemResult, stakeholderResult, workOrderResult, shipmentResult, invoiceResult] = await Promise.all([
      getSalesOrderById(id),
      listSalesOrderItems(id),
      listStakeholders(),
      listWorkOrders(),
      listShipments(),
      listInvoices(),
    ]);
    setOrder(orderResult.data);
    setItems(itemResult.data);
    setStakeholders(stakeholderResult.data);
    setWorkOrders(workOrderResult.data.filter((row) => row.sales_order_id === id));
    setShipments(shipmentResult.data.filter((row) => row.sales_order_id === id));
    setInvoices(invoiceResult.data.filter((row) => row.stakeholder_id && row.stakeholder_id === orderResult.data?.stakeholder_id));
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  const stakeholderName = order?.stakeholder_id ? stakeholders.find((item) => item.id === order.stakeholder_id)?.company_name : null;

  if (loading) return <ERPLayout title="Sipariş Detayı"><p className="text-sm text-muted-foreground">Sipariş yükleniyor...</p></ERPLayout>;
  if (!order) return <ERPLayout title="Sipariş Detayı"><EmptyState title="Sipariş bulunamadı" description="Kayıt görüntülenemedi." /></ERPLayout>;

  return (
    <ERPLayout title={order.order_no}>
      <PageHeader title={order.order_no} description={order.title} actions={<BackButton to="/erp/siparisler" />} />
      <section className="grid gap-3 rounded-md border bg-card p-4 text-sm md:grid-cols-4">
        <div><span className="text-muted-foreground">Müşteri</span><p className="font-medium">{stakeholderName || "-"}</p></div>
        <div><span className="text-muted-foreground">Durum</span><p><StatusBadge label={SALES_ORDER_STATUS_LABELS[order.status]} /></p></div>
        <div><span className="text-muted-foreground">Termin</span><p className="font-medium">{formatDate(order.due_date)}</p></div>
        <div><span className="text-muted-foreground">Tutar</span><p className="font-medium">{formatCurrency(order.grand_total || 0, order.currency)}</p></div>
      </section>
      <div className="flex flex-wrap gap-2">
        <Button onClick={async () => { const result = await createWorkOrderFromSalesOrder(order); if (result.error && !result.data) toast({ title: "İş Emri", description: result.error, variant: "destructive" }); else toast({ title: "İş Emri", description: result.error || "İş emri oluşturuldu." }); await load(); }}>İş Emrine Dönüştür</Button>
        <Button variant="outline" onClick={async () => { const result = await createShipmentFromSalesOrder(order); if (result.error && !result.data) toast({ title: "Sevkiyat", description: result.error, variant: "destructive" }); else toast({ title: "Sevkiyat", description: result.error || "Sevkiyat oluşturuldu." }); await load(); }}>Sevkiyat Oluştur</Button>
      </div>
      <DataTable columns={[
        { key: "desc", header: "Kalem", render: (row) => row.description },
        { key: "qty", header: "Miktar", className: "text-right", render: (row) => formatNumber(row.quantity, 3) },
        { key: "total", header: "Tutar", className: "text-right", render: (row) => formatCurrency(row.total || 0, order.currency) },
      ]} data={items} rowKey={(row) => row.id} emptyMessage="Sipariş kalemi yok." />
      <RelatedMiniList title="İlgili İş Emirleri" rows={workOrders.map((row) => `${row.work_order_no} - ${row.title}`)} />
      <RelatedMiniList title="İlgili Sevkiyatlar" rows={shipments.map((row) => `${row.shipment_no} - ${SHIPMENT_STATUS_LABELS[row.status]}`)} />
      <RelatedMiniList title="İlgili Faturalar" rows={invoices.map((row) => `${row.invoice_no || "Fatura"} - ${formatCurrency(row.grand_total || 0, row.currency)}`)} />
      <DocumentLinksPanel entityType="sales_order" entityId={order.id} />
      <AuditTimeline entityType="sales_order" entityId={order.id} />
    </ERPLayout>
  );
}

export function WorkOrderDetailPage() {
  const { id } = useParams();
  const [workOrder, setWorkOrder] = useState<WorkOrder | null>(null);
  const [operations, setOperations] = useState<WorkOrderOperation[]>([]);
  const [machines, setMachines] = useState<Machine[]>([]);
  const [subcontracting, setSubcontracting] = useState<SubcontractingJob[]>([]);
  const [qualityReports, setQualityReports] = useState<QualityReport[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);

  const load = async () => {
    if (!id) return;
    setLoading(true);
    const [wo, ops, machineResult, subResult, qualityResult, stakeholderResult] = await Promise.all([
      getWorkOrderById(id),
      listWorkOrderOperations(id),
      listMachines(),
      listSubcontractingJobs(),
      listQualityReports(),
      listStakeholders(),
    ]);
    setWorkOrder(wo.data);
    setOperations(ops.data);
    setMachines(machineResult.data);
    setSubcontracting(subResult.data.filter((row) => row.work_order_id === id));
    setQualityReports(qualityResult.data.filter((row) => row.work_order_id === id));
    setStakeholders(stakeholderResult.data);
    setLoading(false);
  };

  useEffect(() => { load(); }, [id]);

  if (loading) return <ERPLayout title="İş Emri Detayı"><p className="text-sm text-muted-foreground">İş emri yükleniyor...</p></ERPLayout>;
  if (!workOrder) return <ERPLayout title="İş Emri Detayı"><EmptyState title="İş emri bulunamadı" description="Kayıt görüntülenemedi." /></ERPLayout>;

  const stakeholderName = workOrder.stakeholder_id ? stakeholders.find((item) => item.id === workOrder.stakeholder_id)?.company_name : undefined;

  return (
    <ERPLayout title={workOrder.work_order_no}>
      <PageHeader title={workOrder.work_order_no} description={workOrder.title} actions={<BackButton to="/erp/work-orders" />} />
      <section className="grid gap-3 rounded-md border bg-card p-4 text-sm md:grid-cols-4">
        <div><span className="text-muted-foreground">Müşteri</span><p className="font-medium">{stakeholderName || "-"}</p></div>
        <div><span className="text-muted-foreground">Parça</span><p className="font-medium">{workOrder.part_name || "-"}</p></div>
        <div><span className="text-muted-foreground">Durum</span><p><StatusBadge label={WORK_ORDER_STATUS_LABELS[workOrder.status]} /></p></div>
        <div><span className="text-muted-foreground">Termin</span><p className="font-medium">{formatDate(workOrder.planned_end_date)}</p></div>
      </section>
      <DataTable columns={[
        { key: "step", header: "Sıra", render: (row) => row.step_no },
        { key: "op", header: "Operasyon", render: (row) => row.operation_name },
        { key: "status", header: "Durum", render: (row) => WORK_ORDER_OPERATION_STATUS_LABELS[row.status] },
        { key: "time", header: "Plan Süre", className: "text-right", render: (row) => `${formatNumber(row.planned_minutes, 0)} dk` },
      ]} data={operations} rowKey={(row) => row.id} emptyMessage="Operasyon yok." />
      <RelatedMiniList title="Fason Kayıtları" rows={subcontracting.map((row) => `${row.process_type} - ${SUBCONTRACTING_STATUS_LABELS[row.status]}`)} />
      <RelatedMiniList title="Kalite Raporları" rows={qualityReports.map((row) => `${row.report_no} - ${QUALITY_RESULT_LABELS[row.result]}`)} />
      <WorkOrderPrintSheet workOrder={workOrder} operations={operations} machines={machines} stakeholderName={stakeholderName} />
      <DocumentLinksPanel entityType="work_order" entityId={workOrder.id} />
      <AuditTimeline entityType="work_order" entityId={workOrder.id} />
    </ERPLayout>
  );
}

export function StakeholderDetailPage() {
  const { id } = useParams();
  const [stakeholder, setStakeholder] = useState<Stakeholder | null>(null);
  const [salesOrders, setSalesOrders] = useState<SalesOrder[]>([]);
  const [quotations, setQuotations] = useState<string[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      const [stakeholderResult, ordersResult, quotationResult] = await Promise.all([getStakeholderById(id), listSalesOrders(), listERPQuotationsFromExistingTable()]);
      setStakeholder(stakeholderResult.data);
      setSalesOrders(ordersResult.data.filter((row) => row.stakeholder_id === id));
      setQuotations(quotationResult.data.filter((row) => stakeholderResult.data?.company_name && row.firma.toLowerCase().includes(stakeholderResult.data.company_name.toLowerCase())).map((row) => `${row.teklif_no} - ${formatCurrency(row.total || 0, row.active_currency || "TRY")}`));
      setLoading(false);
    };
    load();
  }, [id]);

  if (loading) return <ERPLayout title="Paydaş Detayı"><p className="text-sm text-muted-foreground">Paydaş yükleniyor...</p></ERPLayout>;
  if (!stakeholder) return <ERPLayout title="Paydaş Detayı"><EmptyState title="Paydaş bulunamadı" description="Kayıt görüntülenemedi." /></ERPLayout>;

  return (
    <ERPLayout title={stakeholder.company_name}>
      <PageHeader title={stakeholder.company_name} description={STAKEHOLDER_TYPE_LABELS[stakeholder.type]} actions={<BackButton to="/erp/crm" />} />
      <section className="grid gap-3 rounded-md border bg-card p-4 text-sm md:grid-cols-3">
        <div><span className="text-muted-foreground">Yetkili</span><p className="font-medium">{stakeholder.contact_name || "-"}</p></div>
        <div><span className="text-muted-foreground">Telefon</span><p className="font-medium">{stakeholder.phone || "-"}</p></div>
        <div><span className="text-muted-foreground">E-posta</span><p className="font-medium">{stakeholder.email || "-"}</p></div>
        <div><span className="text-muted-foreground">Şehir</span><p className="font-medium">{stakeholder.city || "-"}</p></div>
        <div><span className="text-muted-foreground">Risk Limiti</span><p className="font-medium">{formatCurrency(stakeholder.risk_limit || 0)}</p></div>
        <div><span className="text-muted-foreground">Bakiye</span><p className="font-medium">{formatCurrency(stakeholder.current_balance || 0)}</p></div>
      </section>
      <RelatedMiniList title="İlgili Teklifler" rows={quotations} />
      <RelatedMiniList title="İlgili Satış Siparişleri" rows={salesOrders.map((row) => `${row.order_no} - ${row.title}`)} />
      <DocumentLinksPanel entityType="stakeholder" entityId={stakeholder.id} />
      <AuditTimeline entityType="stakeholder" entityId={stakeholder.id} />
    </ERPLayout>
  );
}

export function InventoryDetailPage() {
  const { id } = useParams();
  const [item, setItem] = useState<InventoryItem | null>(null);
  const [movements, setMovements] = useState<InventoryMovement[]>([]);
  const [loading, setLoading] = useState(true);
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      setLoading(true);
      const [itemResult, movementResult] = await Promise.all([getInventoryItemById(id), listInventoryMovementsForItem(id)]);
      setItem(itemResult.data);
      setMovements(movementResult.data);
      setLoading(false);
    };
    load();
  }, [id]);
  if (loading) return <ERPLayout title="Stok Detayı"><p className="text-sm text-muted-foreground">Stok kartı yükleniyor...</p></ERPLayout>;
  if (!item) return <ERPLayout title="Stok Detayı"><EmptyState title="Stok kartı bulunamadı" description="Kayıt görüntülenemedi." /></ERPLayout>;
  return (
    <ERPLayout title={item.name}>
      <PageHeader title={item.name} description={item.code || INVENTORY_ITEM_TYPE_LABELS[item.item_type]} actions={<BackButton to="/erp/inventory" />} />
      <section className="grid gap-3 rounded-md border bg-card p-4 text-sm md:grid-cols-4">
        <div><span className="text-muted-foreground">Tip</span><p className="font-medium">{INVENTORY_ITEM_TYPE_LABELS[item.item_type]}</p></div>
        <div><span className="text-muted-foreground">Stok</span><p className="font-medium">{formatNumber(item.current_stock, 3)} {item.unit}</p></div>
        <div><span className="text-muted-foreground">Min Stok</span><p className="font-medium">{formatNumber(item.min_stock, 3)} {item.unit}</p></div>
        <div><span className="text-muted-foreground">Lokasyon</span><p className="font-medium">{item.location || "-"}</p></div>
      </section>
      {item.current_stock <= item.min_stock ? <div className="rounded-md border border-red-500/30 bg-red-500/10 p-3 text-sm text-red-500">Kritik stok uyarısı: stok seviyesi minimum değerin altında veya eşit.</div> : null}
      <DataTable columns={[
        { key: "type", header: "Hareket", render: (row) => INVENTORY_MOVEMENT_TYPE_LABELS[row.movement_type] },
        { key: "qty", header: "Miktar", className: "text-right", render: (row) => formatNumber(row.quantity, 3) },
        { key: "date", header: "Tarih", render: (row) => formatDateTime(row.movement_date) },
        { key: "notes", header: "Not", render: (row) => row.notes || "-" },
      ]} data={movements} rowKey={(row) => row.id} emptyMessage="Stok hareketi yok." />
      <DocumentLinksPanel entityType="inventory_item" entityId={item.id} />
      <AuditTimeline entityType="inventory_item" entityId={item.id} />
    </ERPLayout>
  );
}

export function ShipmentDetailPage() {
  const { id } = useParams();
  const [shipment, setShipment] = useState<Shipment | null>(null);
  const [items, setItems] = useState<ShipmentItem[]>([]);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const [shipmentResult, itemResult, stakeholderResult] = await Promise.all([getShipmentById(id), listShipmentItems(id), listStakeholders()]);
      setShipment(shipmentResult.data);
      setItems(itemResult.data);
      setStakeholders(stakeholderResult.data);
    };
    load();
  }, [id]);
  if (!shipment) return <ERPLayout title="Sevkiyat Detayı"><p className="text-sm text-muted-foreground">Sevkiyat yükleniyor...</p></ERPLayout>;
  const stakeholderName = shipment.stakeholder_id ? stakeholders.find((item) => item.id === shipment.stakeholder_id)?.company_name : "-";
  return (
    <ERPLayout title={shipment.shipment_no}>
      <PageHeader title={shipment.shipment_no} description="Sevkiyat detayı" actions={<BackButton to="/erp/logistics" />} />
      <PrintPage title="Sevk İrsaliyesi Önizleme" subtitle="Yazdırılabilir sevkiyat çıktısı.">
        <div className="grid gap-3 text-sm md:grid-cols-3">
          <div><span className="text-muted-foreground">Müşteri</span><p className="font-medium">{stakeholderName || "-"}</p></div>
          <div><span className="text-muted-foreground">Durum</span><p className="font-medium">{SHIPMENT_STATUS_LABELS[shipment.status]}</p></div>
          <div><span className="text-muted-foreground">Paket</span><p className="font-medium">{shipment.package_count}</p></div>
        </div>
      </PrintPage>
      <DataTable columns={[
        { key: "desc", header: "Açıklama", render: (row) => row.description },
        { key: "qty", header: "Miktar", className: "text-right", render: (row) => formatNumber(row.quantity, 3) },
        { key: "unit", header: "Birim", render: (row) => row.unit },
      ]} data={items} rowKey={(row) => row.id} emptyMessage="Sevkiyat kalemi yok." />
      <DocumentLinksPanel entityType="shipment" entityId={shipment.id} />
      <AuditTimeline entityType="shipment" entityId={shipment.id} />
    </ERPLayout>
  );
}

export function QualityDetailPage() {
  const { id } = useParams();
  const [report, setReport] = useState<QualityReport | null>(null);
  const [measurements, setMeasurements] = useState<QualityMeasurement[]>([]);
  const [employees, setEmployees] = useState<Employee[]>([]);
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const [reportResult, measurementResult, employeeResult] = await Promise.all([getQualityReportById(id), listQualityMeasurements(id), listEmployees()]);
      setReport(reportResult.data);
      setMeasurements(measurementResult.data);
      setEmployees(employeeResult.data);
    };
    load();
  }, [id]);
  if (!report) return <ERPLayout title="Kalite Detayı"><p className="text-sm text-muted-foreground">Kalite raporu yükleniyor...</p></ERPLayout>;
  const inspectorName = report.inspector_employee_id ? employees.find((employee) => employee.id === report.inspector_employee_id)?.full_name : null;
  return (
    <ERPLayout title={report.report_no}>
      <PageHeader title={report.report_no} description={QUALITY_RESULT_LABELS[report.result]} actions={<BackButton to="/erp/quality" />} />
      <section className="grid gap-3 rounded-md border bg-card p-4 text-sm md:grid-cols-3">
        <div><span className="text-muted-foreground">Sonuç</span><p className="font-medium">{QUALITY_RESULT_LABELS[report.result]}</p></div>
        <div><span className="text-muted-foreground">Kontrol Eden</span><p className="font-medium">{inspectorName || "-"}</p></div>
        <div><span className="text-muted-foreground">Kontrol Tarihi</span><p className="font-medium">{formatDate(report.inspection_date)}</p></div>
      </section>
      <DataTable columns={[
        { key: "c", header: "Karakteristik", render: (row) => row.characteristic },
        { key: "n", header: "Nominal", render: (row) => row.nominal_value || "-" },
        { key: "t", header: "Tolerans", render: (row) => row.tolerance || "-" },
        { key: "m", header: "Ölçülen", render: (row) => row.measured_value || "-" },
        { key: "r", header: "Sonuç", render: (row) => MEASUREMENT_RESULT_LABELS[row.result] },
      ]} data={measurements} rowKey={(row) => row.id} emptyMessage="Ölçüm satırı yok." />
      <DocumentLinksPanel entityType="quality_report" entityId={report.id} />
      <AuditTimeline entityType="quality_report" entityId={report.id} />
    </ERPLayout>
  );
}

export function SubcontractingDetailPage() {
  const { id } = useParams();
  const [job, setJob] = useState<SubcontractingJob | null>(null);
  const [stakeholders, setStakeholders] = useState<Stakeholder[]>([]);
  useEffect(() => {
    const load = async () => {
      if (!id) return;
      const [jobResult, stakeholderResult] = await Promise.all([getSubcontractingJobById(id), listStakeholders()]);
      setJob(jobResult.data);
      setStakeholders(stakeholderResult.data);
    };
    load();
  }, [id]);
  if (!job) return <ERPLayout title="Fason Detayı"><p className="text-sm text-muted-foreground">Fason kaydı yükleniyor...</p></ERPLayout>;
  const supplierName = job.supplier_id ? stakeholders.find((item) => item.id === job.supplier_id)?.company_name : "-";
  return (
    <ERPLayout title={job.process_type}>
      <PageHeader title={job.process_type} description={SUBCONTRACTING_STATUS_LABELS[job.status]} actions={<BackButton to="/erp/subcontracting" />} />
      <section className="grid gap-3 rounded-md border bg-card p-4 text-sm md:grid-cols-4">
        <div><span className="text-muted-foreground">Fason Firma</span><p className="font-medium">{supplierName || "-"}</p></div>
        <div><span className="text-muted-foreground">Gönderim</span><p className="font-medium">{formatDate(job.sent_date)}</p></div>
        <div><span className="text-muted-foreground">Beklenen Dönüş</span><p className="font-medium">{formatDate(job.expected_return_date)}</p></div>
        <div><span className="text-muted-foreground">Maliyet</span><p className="font-medium">{formatCurrency(job.total_cost || 0)}</p></div>
      </section>
      <DocumentLinksPanel entityType="subcontracting_job" entityId={job.id} />
      <AuditTimeline entityType="subcontracting_job" entityId={job.id} />
    </ERPLayout>
  );
}

function RelatedMiniList({ title, rows }: { title: string; rows: string[] }) {
  return (
    <section className="rounded-md border bg-card p-4">
      <h2 className="mb-2 text-lg font-semibold">{title}</h2>
      {rows.length === 0 ? <p className="text-sm text-muted-foreground">Kayıt yok.</p> : rows.map((row) => <p key={row} className="rounded-md border p-2 text-sm">{row}</p>)}
    </section>
  );
}
