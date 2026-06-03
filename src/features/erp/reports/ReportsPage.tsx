import { useEffect, useMemo, useState } from "react";
import { Download, FileSpreadsheet, FileText } from "lucide-react";
import type React from "react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ERPLayout } from "../layout/ERPLayout";
import {
  listCRMLeads,
  listCRMOpportunities,
  listBranches,
  listCompanies,
  listEmployees,
  listFinancialAccounts,
  listHRDepartments,
  listInventoryItems,
  listInventoryMovements,
  listInvoices,
  listPayments,
  listPaymentProviderHealth,
  listPaymentReconciliationLogs,
  listPaymentRefundOperations,
  listPurchaseOrders,
  listSalesOrders,
  listShopPaymentStatuses,
  listStakeholders,
  listWorkOrders,
  listERPQuotationsFromExistingTable,
} from "../shared/erpApi";
import { exportRowsToCsv, exportRowsToExcel, exportRowsToPdf } from "../shared/exportUtils";
import { formatCurrency, formatNumber } from "../shared/formatters";
import {
  CRMLead,
  CRMOpportunity,
  Company,
  CompanyBranch,
  Employee,
  FinancialAccount,
  HRDepartment,
  InventoryItem,
  InventoryMovement,
  Invoice,
  Payment,
  PaymentProviderHealth,
  PaymentReconciliationLog,
  PaymentRefundOperation,
  PurchaseOrder,
  SalesOrder,
  Stakeholder,
  WorkOrder,
  ERPQuotation,
  ShopPaymentStatusRecord,
} from "../shared/types";
import {
  CRM_LEAD_STATUS_LABELS,
  CRM_OPPORTUNITY_STATUS_LABELS,
  INVOICE_STATUS_LABELS,
  PURCHASE_ORDER_STATUS_LABELS,
  SALES_ORDER_STATUS_LABELS,
  WORK_ORDER_STATUS_LABELS,
} from "../shared/statusLabels";
import { ReportChart } from "./ReportChart";
import { ReportKpiCard } from "./ReportKpiCard";
import { ReportFilters, countByStatus, groupCountByMonth, groupSumByMonth, isWithinDateRange } from "./reportingUtils";
import { useToast } from "@/hooks/use-toast";

type ReportsData = {
  companies: Company[];
  branches: CompanyBranch[];
  stakeholders: Stakeholder[];
  leads: CRMLead[];
  opportunities: CRMOpportunity[];
  quotations: ERPQuotation[];
  salesOrders: SalesOrder[];
  inventoryItems: InventoryItem[];
  inventoryMovements: InventoryMovement[];
  purchaseOrders: PurchaseOrder[];
  workOrders: WorkOrder[];
  invoices: Invoice[];
  payments: Payment[];
  shopPayments: ShopPaymentStatusRecord[];
  reconciliationLogs: PaymentReconciliationLog[];
  refundOperations: PaymentRefundOperation[];
  providerHealth: PaymentProviderHealth[];
  financialAccounts: FinancialAccount[];
  employees: Employee[];
  departments: HRDepartment[];
};

const emptyData: ReportsData = {
  companies: [],
  branches: [],
  stakeholders: [],
  leads: [],
  opportunities: [],
  quotations: [],
  salesOrders: [],
  inventoryItems: [],
  inventoryMovements: [],
  purchaseOrders: [],
  workOrders: [],
  invoices: [],
  payments: [],
  shopPayments: [],
  reconciliationLogs: [],
  refundOperations: [],
  providerHealth: [],
  financialAccounts: [],
  employees: [],
  departments: [],
};

const moduleOptions = [
  { value: "all", label: "Tüm Modüller" },
  { value: "sales", label: "Satış" },
  { value: "crm", label: "CRM" },
  { value: "inventory", label: "Stok" },
  { value: "purchasing", label: "Satın Alma" },
  { value: "production", label: "Üretim" },
  { value: "finance", label: "Finans" },
  { value: "hr", label: "İnsan Kaynakları" },
];

function statusMatches(status: string | null | undefined, filters: ReportFilters) {
  return filters.status === "all" || (status ?? "") === filters.status;
}

function sum(rows: number[]) {
  return rows.reduce((total, value) => total + Number(value || 0), 0);
}

function statusChart(statuses: Record<string, number>, labels: Record<string, string>) {
  return Object.entries(statuses).map(([label, value]) => ({ label: labels[label] ?? label, value }));
}

function countMap<T>(rows: T[], labelGetter: (row: T) => string) {
  return Object.entries(rows.reduce<Record<string, number>>((acc, row) => {
    const label = labelGetter(row);
    acc[label] = (acc[label] ?? 0) + 1;
    return acc;
  }, {})).map(([label, value]) => ({ label, value }));
}

function paymentStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Bekliyor",
    authorized: "Provizyon",
    paid: "Ödendi",
    failed: "Başarısız",
    refunded: "İade",
    cancelled: "İptal",
  };
  return labels[status] ?? status;
}

function reconciliationStatusLabel(status: string) {
  const labels: Record<string, string> = {
    pending: "Bekliyor",
    matched: "Eşleşti",
    mismatch: "Fark Var",
    duplicate: "Tekrar",
    manual_review: "İnceleme",
  };
  return labels[status] ?? status;
}

function normalizeRows(rows: Record<string, unknown>[]) {
  return rows.map((row) => Object.fromEntries(Object.entries(row).map(([key, value]) => [key, value ?? ""])));
}

export default function ReportsPage() {
  const { toast } = useToast();
  const [data, setData] = useState<ReportsData>(emptyData);
  const [loading, setLoading] = useState(true);
  const [filters, setFilters] = useState<ReportFilters>({
    startDate: "",
    endDate: "",
    company: "all",
    branch: "all",
    department: "all",
    module: "all",
    status: "all",
  });

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const [
        stakeholders,
        companies,
        branches,
        leads,
        opportunities,
        quotations,
        salesOrders,
        inventoryItems,
        inventoryMovements,
        purchaseOrders,
        workOrders,
        invoices,
        payments,
        shopPayments,
        reconciliationLogs,
        refundOperations,
        providerHealth,
        financialAccounts,
        employees,
        departments,
      ] = await Promise.all([
        listStakeholders(),
        listCompanies(),
        listBranches(),
        listCRMLeads(),
        listCRMOpportunities(),
        listERPQuotationsFromExistingTable(),
        listSalesOrders(),
        listInventoryItems(),
        listInventoryMovements(),
        listPurchaseOrders(),
        listWorkOrders(),
        listInvoices(),
        listPayments(),
        listShopPaymentStatuses(),
        listPaymentReconciliationLogs(),
        listPaymentRefundOperations(),
        listPaymentProviderHealth(),
        listFinancialAccounts(),
        listEmployees(),
        listHRDepartments(),
      ]);

      const firstError = [stakeholders, companies, branches, leads, opportunities, quotations, salesOrders, inventoryItems, inventoryMovements, purchaseOrders, workOrders, invoices, payments, shopPayments, reconciliationLogs, refundOperations, providerHealth, financialAccounts, employees, departments].find((result) => result.error)?.error;
      if (firstError) toast({ title: "Rapor", description: firstError, variant: "destructive" });
      setData({
        stakeholders: stakeholders.data,
        companies: companies.data,
        branches: branches.data,
        leads: leads.data,
        opportunities: opportunities.data,
        quotations: quotations.data,
        salesOrders: salesOrders.data,
        inventoryItems: inventoryItems.data,
        inventoryMovements: inventoryMovements.data,
        purchaseOrders: purchaseOrders.data,
        workOrders: workOrders.data,
        invoices: invoices.data,
        payments: payments.data,
        shopPayments: shopPayments.data,
        reconciliationLogs: reconciliationLogs.data,
        refundOperations: refundOperations.data,
        providerHealth: providerHealth.data,
        financialAccounts: financialAccounts.data,
        employees: employees.data,
        departments: departments.data,
      });
      setLoading(false);
    };
    load();
  }, [toast]);

  const filtered = useMemo(() => {
    const matchesEnterprise = (row: { company_id?: string | null; branch_id?: string | null }) =>
      (filters.company === "all" || row.company_id === filters.company) && (filters.branch === "all" || row.branch_id === filters.branch);
    const salesOrders = data.salesOrders.filter((row) => matchesEnterprise(row) && isWithinDateRange(row.order_date, filters) && statusMatches(row.status, filters));
    const workOrders = data.workOrders.filter((row) => matchesEnterprise(row) && isWithinDateRange(row.planned_start_date ?? row.created_at, filters) && statusMatches(row.status, filters));
    const purchaseOrders = data.purchaseOrders.filter((row) => matchesEnterprise(row) && isWithinDateRange(row.order_date, filters) && statusMatches(row.status, filters));
    const invoices = data.invoices.filter((row) => matchesEnterprise(row) && isWithinDateRange(row.invoice_date, filters) && statusMatches(row.status, filters));
    const payments = data.payments.filter((row) => matchesEnterprise(row) && isWithinDateRange(row.payment_date, filters));
    const leads = data.leads.filter((row) => matchesEnterprise(row) && isWithinDateRange(row.created_at, filters) && statusMatches(row.status, filters));
    const opportunities = data.opportunities.filter((row) => matchesEnterprise(row) && isWithinDateRange(row.created_at, filters) && statusMatches(row.status, filters));
    const quotations = data.quotations.filter((row) => isWithinDateRange(row.created_at, filters));
    const inventoryMovements = data.inventoryMovements.filter((row) => matchesEnterprise(row) && isWithinDateRange(row.movement_date, filters));
    const employees = data.employees.filter((row) => {
      const matchesDepartment = filters.department === "all" || row.department_id === filters.department || row.department === data.departments.find((department) => department.id === filters.department)?.name;
      return matchesEnterprise(row) && matchesDepartment && statusMatches(row.status ?? (row.is_active ? "active" : "inactive"), filters);
    });
    return {
      salesOrders,
      workOrders,
      purchaseOrders,
      invoices,
      payments,
      shopPayments: data.shopPayments,
      reconciliationLogs: data.reconciliationLogs,
      refundOperations: data.refundOperations,
      providerHealth: data.providerHealth,
      leads,
      opportunities,
      quotations,
      inventoryMovements,
      employees,
      inventoryItems: data.inventoryItems.filter(matchesEnterprise),
      stakeholders: data.stakeholders.filter(matchesEnterprise),
      financialAccounts: data.financialAccounts.filter(matchesEnterprise),
    };
  }, [data, filters]);

  const receivables = sum(filtered.invoices.filter((invoice) => invoice.invoice_type === "sales" && invoice.status !== "paid" && invoice.status !== "cancelled").map((invoice) => invoice.grand_total));
  const payables = sum(filtered.invoices.filter((invoice) => invoice.invoice_type === "purchase" && invoice.status !== "paid" && invoice.status !== "cancelled").map((invoice) => invoice.grand_total));
  const lowStock = filtered.inventoryItems.filter((item) => item.current_stock <= item.min_stock);
  const activeCustomers = filtered.stakeholders.filter((item) => item.is_active && (item.type === "customer" || item.type === "both")).length;
  const openOpportunities = filtered.opportunities.filter((item) => item.status === "open" || item.status === "proposal").length;
  const failedPayments = filtered.shopPayments.filter((row) => row.status === "failed").length;
  const pendingReconciliation = filtered.reconciliationLogs.filter((row) => row.status === "pending" || row.status === "manual_review").length;
  const refundCount = filtered.refundOperations.length;
  const providerIssueCount = filtered.providerHealth.filter((row) => row.status !== "healthy").length;
  const selectedCompanyCount = filters.company === "all" ? data.companies.length : 1;
  const selectedBranchCount = filters.branch === "all" ? data.branches.filter((branch) => filters.company === "all" || branch.company_id === filters.company).length : 1;

  const executiveKpis = [
    { title: "Aktif Müşteriler", value: activeCustomers, description: "müşteri veya karma cari" },
    { title: "Açık Fırsatlar", value: openOpportunities, description: "açık CRM fırsatı" },
    { title: "Teklifler", value: filtered.quotations.length, description: "seçili dönem" },
    { title: "Şirketler", value: selectedCompanyCount, description: "rapor kapsamı" },
    { title: "Şubeler", value: selectedBranchCount, description: "rapor kapsamı" },
    { title: "Satış Siparişleri", value: filtered.salesOrders.length, description: "seçili dönem" },
    { title: "Kritik Stok", value: lowStock.length, description: "minimum seviyede", tone: lowStock.length ? "warning" : "success" },
    { title: "Satın Alma", value: filtered.purchaseOrders.length, description: "satın alma siparişi" },
    { title: "Üretim", value: filtered.workOrders.length, description: "iş emri" },
    { title: "Alacaklar", value: formatCurrency(receivables), description: "ödenmemiş satış faturası", tone: receivables ? "warning" : "success" },
    { title: "Borçlar", value: formatCurrency(payables), description: "ödenmemiş alış faturası", tone: payables ? "warning" : "success" },
    { title: "Ödeme Sorunu", value: failedPayments, description: "başarısız sağlayıcı ödemesi", tone: failedPayments ? "danger" : "success" },
    { title: "Mutabakat", value: pendingReconciliation, description: "bekleyen finans kontrolü", tone: pendingReconciliation ? "warning" : "success" },
    { title: "Çalışanlar", value: filtered.employees.filter((employee) => employee.is_active).length, description: "aktif çalışan" },
  ] as const;

  const exportCurrent = async (type: "csv" | "excel" | "pdf") => {
    const rows = normalizeRows([
      ...filtered.salesOrders.map((row) => ({ Rapor: "Satış Siparişi", No: row.order_no, Başlık: row.title, Durum: SALES_ORDER_STATUS_LABELS[row.status], Tutar: row.grand_total, Tarih: row.order_date })),
      ...filtered.workOrders.map((row) => ({ Rapor: "İş Emri", No: row.work_order_no, Başlık: row.title, Durum: WORK_ORDER_STATUS_LABELS[row.status], Miktar: row.quantity, Tarih: row.planned_start_date ?? row.created_at })),
      ...filtered.purchaseOrders.map((row) => ({ Rapor: "Satın Alma", No: row.purchase_order_no, Başlık: row.title, Durum: PURCHASE_ORDER_STATUS_LABELS[row.status], Tutar: row.grand_total, Tarih: row.order_date })),
      ...filtered.invoices.map((row) => ({ Rapor: "Fatura", No: row.invoice_no, Başlık: row.invoice_type === "sales" ? "Satış" : "Alış", Durum: INVOICE_STATUS_LABELS[row.status], Tutar: row.grand_total, Tarih: row.invoice_date })),
      ...filtered.employees.map((row) => ({ Rapor: "Çalışan", No: row.employee_no, Başlık: row.full_name, Durum: row.status ?? (row.is_active ? "Aktif" : "Pasif"), Tutar: "", Tarih: row.hire_date ?? row.created_at })),
    ]);

    if (rows.length === 0) {
      toast({ title: "Dışa Aktarım", description: "Dışa aktarılacak kayıt bulunamadı." });
      return;
    }
    if (type === "csv") exportRowsToCsv("erp-rapor-ozeti.csv", rows);
    if (type === "excel") exportRowsToExcel("erp-rapor-ozeti.xls", rows);
    if (type === "pdf") await exportRowsToPdf("ERP Rapor Özeti", "erp-rapor-ozeti.pdf", rows);
  };

  const show = (module: string) => filters.module === "all" || filters.module === module;

  return (
    <ERPLayout title="Raporlar">
      <PageHeader
        title="Raporlar ve Yönetim Paneli"
        description="ERP modüllerinden gelen gerçek operasyon verileriyle yönetim görünürlüğü, KPI ve dışa aktarım temeli."
      />

      <Card className="erp-surface rounded-lg">
        <CardHeader>
          <CardTitle className="text-base">Rapor Filtreleri</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-3 md:grid-cols-2 xl:grid-cols-7">
          <InputLabel label="Başlangıç"><input className="h-10 rounded-md border border-input bg-background px-3 text-sm" type="date" value={filters.startDate} onChange={(event) => setFilters((current) => ({ ...current, startDate: event.target.value }))} /></InputLabel>
          <InputLabel label="Bitiş"><input className="h-10 rounded-md border border-input bg-background px-3 text-sm" type="date" value={filters.endDate} onChange={(event) => setFilters((current) => ({ ...current, endDate: event.target.value }))} /></InputLabel>
          <InputLabel label="Şirket">
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.company} onChange={(event) => setFilters((current) => ({ ...current, company: event.target.value, branch: "all" }))}>
              <option value="all">Tüm Şirketler</option>
              {data.companies.map((company) => <option key={company.id} value={company.id}>{company.trade_name || company.legal_name}</option>)}
            </select>
          </InputLabel>
          <InputLabel label="Şube">
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.branch} onChange={(event) => setFilters((current) => ({ ...current, branch: event.target.value }))}>
              <option value="all">Tüm Şubeler</option>
              {data.branches.filter((branch) => filters.company === "all" || branch.company_id === filters.company).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
            </select>
          </InputLabel>
          <InputLabel label="Departman">
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.department} onChange={(event) => setFilters((current) => ({ ...current, department: event.target.value }))}>
              <option value="all">Tüm Departmanlar</option>
              {data.departments.map((department) => <option key={department.id} value={department.id}>{department.name}</option>)}
            </select>
          </InputLabel>
          <InputLabel label="Modül">
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.module} onChange={(event) => setFilters((current) => ({ ...current, module: event.target.value }))}>
              {moduleOptions.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
            </select>
          </InputLabel>
          <InputLabel label="Durum">
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={filters.status} onChange={(event) => setFilters((current) => ({ ...current, status: event.target.value }))}>
              <option value="all">Tüm Durumlar</option>
              {["open", "proposal", "new", "confirmed", "planned", "released", "in_progress", "draft", "sent", "paid", "active", "inactive"].map((status) => <option key={status} value={status}>{statusLabel(status)}</option>)}
            </select>
          </InputLabel>
        </CardContent>
      </Card>

      <section className="space-y-4">
        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
          <div>
            <h2 className="text-lg font-semibold">Yönetici Paneli</h2>
            <p className="text-sm text-muted-foreground">Tüm ERP kapsamı için seçili filtrelere göre güncel özet.</p>
          </div>
          <div className="flex flex-wrap gap-2">
            <Button variant="outline" onClick={() => exportCurrent("csv")}><Download className="mr-2 h-4 w-4" />CSV</Button>
            <Button variant="outline" onClick={() => exportCurrent("excel")}><FileSpreadsheet className="mr-2 h-4 w-4" />Excel</Button>
            <Button variant="outline" onClick={() => exportCurrent("pdf")}><FileText className="mr-2 h-4 w-4" />PDF</Button>
          </div>
        </div>

        <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-5">
          {executiveKpis.map((item) => <ReportKpiCard key={item.title} {...item} />)}
        </div>
      </section>

      <Tabs defaultValue="overview" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="overview">Genel Bakış</TabsTrigger>
          <TabsTrigger value="sales">Satış Raporları</TabsTrigger>
          <TabsTrigger value="crm">CRM Raporları</TabsTrigger>
          <TabsTrigger value="inventory">Stok Raporları</TabsTrigger>
          <TabsTrigger value="purchasing">Satın Alma Raporları</TabsTrigger>
          <TabsTrigger value="production">Üretim Raporları</TabsTrigger>
          <TabsTrigger value="finance">Finans Raporları</TabsTrigger>
          <TabsTrigger value="hr">İnsan Kaynakları Raporları</TabsTrigger>
        </TabsList>

        <TabsContent value="overview">
          <div className="grid gap-4 xl:grid-cols-2">
            <ReportChart title="Satış Eğilimi" type="area" data={groupSumByMonth(filtered.salesOrders, (row) => row.order_date, (row) => row.grand_total)} />
            <ReportChart title="Finans Eğilimi" type="area" data={groupSumByMonth(filtered.invoices, (row) => row.invoice_date, (row) => row.grand_total)} />
            <ReportChart title="Üretim Eğilimi" data={groupCountByMonth(filtered.workOrders, (row) => row.created_at)} />
            <ReportChart title="İnsan Kaynakları Eğilimi" data={groupCountByMonth(filtered.employees, (row) => row.hire_date ?? row.created_at)} />
          </div>
        </TabsContent>

        <TabsContent value="sales">
          {show("sales") ? <ReportSection title="Satış Raporları" items={[
            { title: "Teklifler", value: filtered.quotations.length },
            { title: "Sipariş Sayısı", value: filtered.salesOrders.length },
            { title: "Sipariş Tutarı", value: formatCurrency(sum(filtered.salesOrders.map((row) => row.grand_total))) },
            { title: "Açık Sipariş", value: filtered.salesOrders.filter((row) => !["closed", "cancelled"].includes(row.status)).length },
          ]} charts={[
            <ReportChart key="sales-trend" title="Satış Sipariş Eğilimi" type="area" data={groupSumByMonth(filtered.salesOrders, (row) => row.order_date, (row) => row.grand_total)} />,
            <ReportChart key="sales-status" title="Satış Durum Dağılımı" data={statusChart(countByStatus(filtered.salesOrders, (row) => row.status), SALES_ORDER_STATUS_LABELS)} />,
          ]} /> : <HiddenModule />}
        </TabsContent>

        <TabsContent value="crm">
          {show("crm") ? <ReportSection title="CRM Raporları" items={[
            { title: "Aktif Müşteri", value: activeCustomers },
            { title: "Potansiyel Müşteri", value: filtered.leads.length },
            { title: "Açık Fırsat", value: openOpportunities },
            { title: "Fırsat Tutarı", value: formatCurrency(sum(filtered.opportunities.map((row) => row.expected_value))) },
          ]} charts={[
            <ReportChart key="lead-status" title="Potansiyel Müşteri Durumu" data={statusChart(countByStatus(filtered.leads, (row) => row.status), CRM_LEAD_STATUS_LABELS)} />,
            <ReportChart key="opportunity-status" title="Fırsat Durumu" data={statusChart(countByStatus(filtered.opportunities, (row) => row.status), CRM_OPPORTUNITY_STATUS_LABELS)} />,
          ]} /> : <HiddenModule />}
        </TabsContent>

        <TabsContent value="inventory">
          {show("inventory") ? <ReportSection title="Stok Raporları" items={[
            { title: "Stok Kartı", value: filtered.inventoryItems.length },
            { title: "Kritik Stok", value: lowStock.length, tone: lowStock.length ? "warning" : "success" },
            { title: "Stok Hareketi", value: filtered.inventoryMovements.length },
            { title: "Toplam Stok", value: formatNumber(sum(filtered.inventoryItems.map((row) => row.current_stock)), 2) },
          ]} charts={[
            <ReportChart key="inventory-trend" title="Stok Hareket Eğilimi" data={groupCountByMonth(filtered.inventoryMovements, (row) => row.movement_date)} />,
            <ReportChart key="stock-status" title="Stok Durumu" data={[{ label: "Kritik", value: lowStock.length }, { label: "Yeterli", value: Math.max(filtered.inventoryItems.length - lowStock.length, 0) }]} />,
          ]} /> : <HiddenModule />}
        </TabsContent>

        <TabsContent value="purchasing">
          {show("purchasing") ? <ReportSection title="Satın Alma Raporları" items={[
            { title: "Sipariş", value: filtered.purchaseOrders.length },
            { title: "Açık Sipariş", value: filtered.purchaseOrders.filter((row) => !["received", "cancelled"].includes(row.status)).length },
            { title: "Teslim Alınan", value: filtered.purchaseOrders.filter((row) => row.status === "received").length },
            { title: "Toplam Tutar", value: formatCurrency(sum(filtered.purchaseOrders.map((row) => row.grand_total))) },
          ]} charts={[
            <ReportChart key="purchasing-trend" title="Satın Alma Eğilimi" type="area" data={groupSumByMonth(filtered.purchaseOrders, (row) => row.order_date, (row) => row.grand_total)} />,
            <ReportChart key="purchasing-status" title="Satın Alma Durumu" data={statusChart(countByStatus(filtered.purchaseOrders, (row) => row.status), PURCHASE_ORDER_STATUS_LABELS)} />,
          ]} /> : <HiddenModule />}
        </TabsContent>

        <TabsContent value="production">
          {show("production") ? <ReportSection title="Üretim Raporları" items={[
            { title: "İş Emri", value: filtered.workOrders.length },
            { title: "Açık İş Emri", value: filtered.workOrders.filter((row) => !["completed", "cancelled"].includes(row.status)).length },
            { title: "Tamamlanan", value: filtered.workOrders.filter((row) => row.status === "completed").length },
            { title: "Planlanan Miktar", value: formatNumber(sum(filtered.workOrders.map((row) => row.quantity)), 2) },
          ]} charts={[
            <ReportChart key="production-trend" title="Üretim Eğilimi" data={groupCountByMonth(filtered.workOrders, (row) => row.created_at)} />,
            <ReportChart key="production-status" title="Üretim Durumu" data={statusChart(countByStatus(filtered.workOrders, (row) => row.status), WORK_ORDER_STATUS_LABELS)} />,
          ]} /> : <HiddenModule />}
        </TabsContent>

        <TabsContent value="finance">
          {show("finance") ? <ReportSection title="Finans Raporları" items={[
            { title: "Fatura", value: filtered.invoices.length },
            { title: "Alacaklar", value: formatCurrency(receivables), tone: receivables ? "warning" : "success" },
            { title: "Borçlar", value: formatCurrency(payables), tone: payables ? "warning" : "success" },
            { title: "Kasa/Banka", value: formatCurrency(sum(filtered.financialAccounts.map((row) => row.current_balance))) },
            { title: "Başarısız Ödeme", value: failedPayments, tone: failedPayments ? "danger" : "success" },
            { title: "Bekleyen Mutabakat", value: pendingReconciliation, tone: pendingReconciliation ? "warning" : "success" },
            { title: "İade Operasyonu", value: refundCount },
            { title: "Sağlayıcı Uyarısı", value: providerIssueCount, tone: providerIssueCount ? "warning" : "success" },
          ]} charts={[
            <ReportChart key="finance-trend" title="Finansal Eğilim" type="area" data={groupSumByMonth(filtered.invoices, (row) => row.invoice_date, (row) => row.grand_total)} />,
            <ReportChart key="invoice-status" title="Fatura Durumu" data={statusChart(countByStatus(filtered.invoices, (row) => row.status), INVOICE_STATUS_LABELS)} />,
            <ReportChart key="payment-status" title="Ödeme Durumu" data={countMap(filtered.shopPayments, (row) => paymentStatusLabel(row.status))} />,
            <ReportChart key="reconciliation-status" title="Mutabakat Durumu" data={countMap(filtered.reconciliationLogs, (row) => reconciliationStatusLabel(row.status))} />,
          ]} /> : <HiddenModule />}
        </TabsContent>

        <TabsContent value="hr">
          {show("hr") ? <ReportSection title="İnsan Kaynakları Raporları" items={[
            { title: "Çalışan", value: filtered.employees.length },
            { title: "Aktif Çalışan", value: filtered.employees.filter((row) => row.is_active).length },
            { title: "Departman", value: data.departments.length },
            { title: "Pasif Çalışan", value: filtered.employees.filter((row) => !row.is_active).length },
          ]} charts={[
            <ReportChart key="hr-trend" title="İşe Giriş Eğilimi" data={groupCountByMonth(filtered.employees, (row) => row.hire_date ?? row.created_at)} />,
            <ReportChart key="hr-dept" title="Departman Dağılımı" data={data.departments.map((department) => ({ label: department.name, value: filtered.employees.filter((employee) => employee.department_id === department.id || employee.department === department.name).length }))} />,
          ]} /> : <HiddenModule />}
        </TabsContent>
      </Tabs>

      {loading ? <p className="text-sm text-muted-foreground">Rapor verileri güncelleniyor...</p> : null}
    </ERPLayout>
  );
}

function InputLabel({ label, children }: { label: string; children: React.ReactNode }) {
  return (
    <label className="grid gap-1 text-xs font-medium text-muted-foreground">
      {label}
      {children}
    </label>
  );
}

function ReportSection({ title, items, charts }: { title: string; items: Parameters<typeof ReportKpiCard>[0][]; charts: React.ReactNode[] }) {
  return (
    <section className="space-y-4">
      <h2 className="text-lg font-semibold">{title}</h2>
      <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-4">
        {items.map((item) => <ReportKpiCard key={item.title} {...item} />)}
      </div>
      <div className="grid gap-4 xl:grid-cols-2">{charts}</div>
    </section>
  );
}

function HiddenModule() {
  return (
    <Card className="erp-surface rounded-lg">
      <CardContent className="p-6">
        <StatusBadge label="Filtre Dışı" tone="muted" />
        <p className="mt-3 text-sm text-muted-foreground">Seçili modül filtresi bu rapor grubunu gizliyor.</p>
      </CardContent>
    </Card>
  );
}

function statusLabel(status: string) {
  const labels: Record<string, string> = {
    open: "Açık",
    proposal: "Teklif",
    new: "Yeni",
    confirmed: "Onaylandı",
    planned: "Planlandı",
    released: "Yayında",
    in_progress: "Devam Ediyor",
    draft: "Taslak",
    sent: "Gönderildi",
    paid: "Ödendi",
    active: "Aktif",
    inactive: "Pasif",
  };
  return labels[status] ?? status;
}
