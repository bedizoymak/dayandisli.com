import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/erp/DataTable";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { ERPLayout } from "../layout/ERPLayout";
import {
  createBranch,
  createCompany,
  createERPUser,
  createWarehouse,
  getCurrentERPUser,
  listBranches,
  listCompanies,
  listERPUsers,
  listWarehouses,
  updateBranch,
  updateCompany,
  updateERPUser,
  updateWarehouse,
  upsertCompanyMembership,
} from "../shared/erpApi";
import {
  canManageERP,
  canManageUsers,
  FOUNDATION_ROLE_OPTIONS,
  FOUNDATION_ROLE_PERMISSION_MAP,
  PERMISSION_ACTION_LABELS,
  PERMISSION_CATALOG,
  ROLE_LABELS,
} from "../shared/permissions";
import { Company, CompanyBranch, ERPRole, ERPUser, Warehouse } from "../shared/types";
import { ERPDatabaseStatusWidget } from "../dashboard/ERPDatabaseStatusWidget";

const MODULE_LABELS: Record<string, string> = {
  accounting: "Muhasebe",
  calculator: "Hesaplama",
  commerce: "E-Ticaret",
  crm: "CRM",
  dashboard: "Kontrol Paneli",
  documents: "Dokümanlar",
  expenses: "Giderler",
  finance: "Finans",
  hr: "İnsan Kaynakları",
  inventory: "Stok",
  invoicing: "Fatura",
  maintenance: "Bakım",
  permissions: "Yetkiler",
  production: "Üretim",
  purchasing: "Satın Alma",
  quality: "Kalite",
  reports: "Raporlar",
  roles: "Roller",
  sales: "Satış",
  settings: "Ayarlar",
  system: "Sistem",
  users: "Kullanıcılar",
  website: "Web Sitesi",
};

const EXTRA_ACTION_LABELS: Record<string, string> = {
  customers: "Müşteriler",
  suppliers: "Tedarikçiler",
  quotations: "Teklifler",
  orders: "Siparişler",
  activities: "Faaliyetler",
  items: "Ürünler",
  movements: "Hareketler",
  stocktakes: "Sayım",
  minimums: "Minimum Stok",
  requests: "Talepler",
  quotes: "Teklif Toplama",
  orders_manage: "Sipariş Yönetimi",
  performance: "Performans",
  planning: "Planlama",
  work_centers: "İş Merkezleri",
  operations: "Operasyonlar",
  history: "Geçmiş",
  accounts: "Hesaplar",
  banners: "Bannerlar",
  campaigns: "Kampanyalar",
  carts: "Sepetler",
  entries: "Fişler",
  journals: "Yevmiye",
  transactions: "Hareketler",
  periods: "Dönemler",
  categories: "Kategoriler",
  cash_bank: "Kasa ve Banka",
  export: "Dışa Aktarma",
  forms: "Formlar",
  media: "Medya",
  menus: "Menüler",
  pages: "Sayfalar",
  payments: "Ödemeler",
  products: "Ürünler",
  publishing: "Yayın Durumu",
  seo: "SEO",
};

function describePermission(permission: string) {
  const [moduleKey, actionKey = "view"] = permission.split(".");
  const moduleLabel = MODULE_LABELS[moduleKey] ?? "ERP";
  const actionLabel = PERMISSION_ACTION_LABELS[actionKey as keyof typeof PERMISSION_ACTION_LABELS] ?? EXTRA_ACTION_LABELS[actionKey] ?? "Erişim";
  return { moduleLabel, actionLabel };
}

function roleLabel(role: string | null | undefined) {
  return ROLE_LABELS[role as ERPRole] ?? FOUNDATION_ROLE_OPTIONS.find((item) => item.id === role)?.label ?? "Misafir";
}

const defaultForm = {
  email: "",
  full_name: "",
  role: "viewer" as ERPRole,
  department: "",
};

const defaultCompanyForm = {
  code: "",
  legal_name: "",
  trade_name: "",
  primary_admin_email: "",
};

const defaultBranchForm = {
  company_id: "",
  code: "",
  name: "",
  city: "",
  manager_email: "",
};

const defaultWarehouseForm = {
  company_id: "",
  branch_id: "",
  code: "",
  name: "",
  city: "",
  manager_email: "",
};

export default function ERPSettingsPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<ERPUser | null>(null);
  const [users, setUsers] = useState<ERPUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [form, setForm] = useState(defaultForm);
  const [companies, setCompanies] = useState<Company[]>([]);
  const [branches, setBranches] = useState<CompanyBranch[]>([]);
  const [warehouses, setWarehouses] = useState<Warehouse[]>([]);
  const [companyForm, setCompanyForm] = useState(defaultCompanyForm);
  const [branchForm, setBranchForm] = useState(defaultBranchForm);
  const [warehouseForm, setWarehouseForm] = useState(defaultWarehouseForm);

  const canEdit = canManageERP(user) || canManageUsers(user);

  const load = async () => {
    const [currentResult, usersResult, companiesResult, branchesResult, warehousesResult] = await Promise.all([
      getCurrentERPUser(),
      listERPUsers(),
      listCompanies(),
      listBranches(),
      listWarehouses(),
    ]);
    setUser(currentResult.data);
    setUsers(usersResult.data);
    setCompanies(companiesResult.data);
    setBranches(branchesResult.data);
    setWarehouses(warehousesResult.data);
    if (usersResult.error) {
      toast({ title: "Hata", description: `Kullanıcılar yüklenemedi: ${usersResult.error}`, variant: "destructive" });
    }
    const enterpriseError = companiesResult.error || branchesResult.error || warehousesResult.error;
    if (enterpriseError) {
      toast({ title: "Hata", description: `Kurumsal yapı yüklenemedi: ${enterpriseError}`, variant: "destructive" });
    }
  };

  useEffect(() => {
    load();
  }, []);

  const filteredUsers = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr-TR");
    return users.filter((item) => {
      const matchesSearch =
        !needle ||
        item.email.toLocaleLowerCase("tr-TR").includes(needle) ||
        (item.full_name ?? "").toLocaleLowerCase("tr-TR").includes(needle) ||
        (item.department ?? "").toLocaleLowerCase("tr-TR").includes(needle);
      const matchesRole = roleFilter === "all" || item.role === roleFilter || (item.roles ?? []).includes(roleFilter as ERPRole);
      return matchesSearch && matchesRole;
    });
  }, [roleFilter, search, users]);

  const handleCreate = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;
    const result = await createERPUser({
      email: form.email.trim(),
      full_name: form.full_name.trim() || null,
      role: form.role,
      roles: [form.role],
      permissions: [],
      department: form.department.trim() || null,
      is_active: true,
    });
    if (result.error) {
      toast({ title: "Hata", description: `Kullanıcı oluşturulamadı: ${result.error}`, variant: "destructive" });
      return;
    }
    toast({ title: "Kaydedildi", description: "Kullanıcı kaydı oluşturuldu." });
    setForm(defaultForm);
    load();
  };

  const updateUser = async (target: ERPUser, payload: Partial<ERPUser>, message: string) => {
    if (!canEdit) return;
    const result = await updateERPUser(target.id, payload);
    if (result.error) {
      toast({ title: "Hata", description: `Kayıt güncellenemedi: ${result.error}`, variant: "destructive" });
      return;
    }
    toast({ title: "Kaydedildi", description: message });
    load();
  };

  const assignUserCompany = async (target: ERPUser, companyId: string | null) => {
    await updateUser(target, { default_company_id: companyId, default_branch_id: null, accessible_company_ids: companyId ? [companyId] : [], accessible_branch_ids: [] }, "Varsayılan şirket güncellendi.");
    if (companyId) {
      await upsertCompanyMembership({
        company_id: companyId,
        branch_id: null,
        erp_user_id: target.id,
        auth_user_id: target.auth_user_id,
        email: target.email,
        role: target.role,
        is_company_admin: target.role === "admin",
        is_active: target.is_active,
      });
    }
    load();
  };

  const assignUserBranch = async (target: ERPUser, branchId: string | null) => {
    const branch = branches.find((item) => item.id === branchId);
    await updateUser(target, { default_branch_id: branchId, accessible_branch_ids: branchId ? [branchId] : [] }, "Varsayılan şube güncellendi.");
    if (branch) {
      await upsertCompanyMembership({
        company_id: branch.company_id,
        branch_id: branch.id,
        erp_user_id: target.id,
        auth_user_id: target.auth_user_id,
        email: target.email,
        role: target.role,
        is_branch_manager: target.role === "admin" || target.role === "warehouse",
        is_active: target.is_active,
      });
    }
    load();
  };

  const companyName = (id: string | null | undefined) => companies.find((company) => company.id === id)?.trade_name || companies.find((company) => company.id === id)?.legal_name || "-";
  const branchName = (id: string | null | undefined) => branches.find((branch) => branch.id === id)?.name || "-";

  const handleCreateCompany = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit) return;
    const result = await createCompany({
      code: companyForm.code.trim().toUpperCase(),
      legal_name: companyForm.legal_name.trim(),
      trade_name: companyForm.trade_name.trim() || null,
      primary_admin_email: companyForm.primary_admin_email.trim() || null,
      status: "active",
    });
    if (result.error) {
      toast({ title: "Hata", description: `Şirket oluşturulamadı: ${result.error}`, variant: "destructive" });
      return;
    }
    toast({ title: "Kaydedildi", description: "Şirket kaydı oluşturuldu." });
    setCompanyForm(defaultCompanyForm);
    load();
  };

  const handleCreateBranch = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || !branchForm.company_id) return;
    const result = await createBranch({
      company_id: branchForm.company_id,
      code: branchForm.code.trim().toUpperCase(),
      name: branchForm.name.trim(),
      city: branchForm.city.trim() || null,
      manager_email: branchForm.manager_email.trim() || null,
      status: "active",
    });
    if (result.error) {
      toast({ title: "Hata", description: `Şube oluşturulamadı: ${result.error}`, variant: "destructive" });
      return;
    }
    toast({ title: "Kaydedildi", description: "Şube kaydı oluşturuldu." });
    setBranchForm(defaultBranchForm);
    load();
  };

  const handleCreateWarehouse = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!canEdit || !warehouseForm.company_id) return;
    const result = await createWarehouse({
      company_id: warehouseForm.company_id,
      branch_id: warehouseForm.branch_id || null,
      code: warehouseForm.code.trim().toUpperCase(),
      name: warehouseForm.name.trim(),
      city: warehouseForm.city.trim() || null,
      manager_email: warehouseForm.manager_email.trim() || null,
      visibility_scope: warehouseForm.branch_id ? "branch" : "company",
      status: "active",
    });
    if (result.error) {
      toast({ title: "Hata", description: `Depo oluşturulamadı: ${result.error}`, variant: "destructive" });
      return;
    }
    toast({ title: "Kaydedildi", description: "Depo kaydı oluşturuldu." });
    setWarehouseForm(defaultWarehouseForm);
    load();
  };

  return (
    <ERPLayout title="Sistem Ayarları">
      <PageHeader
        title="Sistem Ayarları"
        description="ERP kullanıcı, rol, yetki ve sistem yapılandırması bu alandan yönetilir."
      />

      <div className="rounded-md border bg-card p-4 text-sm">
        <p className="font-medium">
          Aktif ERP Rolü: <StatusBadge label={roleLabel(user?.role)} tone={canEdit ? "success" : "muted"} />
        </p>
        {!canEdit ? <p className="mt-2 text-muted-foreground">Bu kullanıcı ayarları görüntüleyebilir; yönetim işlemleri yetki gerektirir.</p> : null}
      </div>

      <ERPDatabaseStatusWidget />

      <Tabs defaultValue="users" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="users">Kullanıcılar</TabsTrigger>
          <TabsTrigger value="companies">Şirketler</TabsTrigger>
          <TabsTrigger value="branches">Şubeler</TabsTrigger>
          <TabsTrigger value="warehouses">Depolar</TabsTrigger>
          <TabsTrigger value="roles">Roller</TabsTrigger>
          <TabsTrigger value="permissions">Yetkiler</TabsTrigger>
        </TabsList>

        <TabsContent value="users" className="space-y-4">
          <Card>
            <CardHeader>
              <CardTitle className="text-lg">Kullanıcı Oluştur</CardTitle>
            </CardHeader>
            <CardContent>
              <form onSubmit={handleCreate} className="grid gap-3 md:grid-cols-5">
                <Input required disabled={!canEdit} type="email" placeholder="E-posta" value={form.email} onChange={(event) => setForm((current) => ({ ...current, email: event.target.value }))} />
                <Input disabled={!canEdit} placeholder="Ad Soyad" value={form.full_name} onChange={(event) => setForm((current) => ({ ...current, full_name: event.target.value }))} />
                <select
                  disabled={!canEdit}
                  className="h-10 rounded-md border border-input bg-background px-3 text-sm"
                  value={form.role}
                  onChange={(event) => setForm((current) => ({ ...current, role: event.target.value as ERPRole }))}
                >
                  {FOUNDATION_ROLE_OPTIONS.map((role) => (
                    <option key={role.id} value={role.id}>{role.label}</option>
                  ))}
                </select>
                <Input disabled={!canEdit} placeholder="Departman" value={form.department} onChange={(event) => setForm((current) => ({ ...current, department: event.target.value }))} />
                <Button disabled={!canEdit} type="submit">Oluştur</Button>
              </form>
            </CardContent>
          </Card>

          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input placeholder="Kullanıcı ara" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={roleFilter} onChange={(event) => setRoleFilter(event.target.value)}>
              <option value="all">Tüm Roller</option>
              {FOUNDATION_ROLE_OPTIONS.map((role) => (
                <option key={role.id} value={role.id}>{role.label}</option>
              ))}
            </select>
          </div>

          <DataTable
            data={filteredUsers}
            rowKey={(row) => row.id}
            columns={[
              { key: "user", header: "Kullanıcı", render: (row) => <div><p className="font-medium">{row.full_name || row.email}</p><p className="text-xs text-muted-foreground">{row.email}</p></div> },
              { key: "role", header: "Rol", render: (row) => <StatusBadge label={roleLabel(row.role)} tone="default" /> },
              { key: "department", header: "Departman", render: (row) => row.department || "-" },
              { key: "company", header: "Varsayılan Şirket", render: (row) => companyName(row.default_company_id) },
              { key: "branch", header: "Varsayılan Şube", render: (row) => branchName(row.default_branch_id) },
              { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.is_active ? "Aktif" : "Pasif"} tone={row.is_active ? "success" : "muted"} /> },
              { key: "permission_count", header: "Özel Yetki", render: (row) => `${row.permissions?.length ?? 0}` },
              {
                key: "actions",
                header: "İşlemler",
                render: (row) => (
                  <div className="flex min-w-64 flex-wrap gap-2">
                    <select
                      disabled={!canEdit}
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                      value={row.role}
                      onChange={(event) => updateUser(row, { role: event.target.value as ERPRole, roles: [event.target.value as ERPRole] }, "Rol güncellendi.")}
                    >
                      {FOUNDATION_ROLE_OPTIONS.map((role) => (
                        <option key={role.id} value={role.id}>{role.label}</option>
                      ))}
                    </select>
                    <select
                      disabled={!canEdit}
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                      defaultValue=""
                      onChange={(event) => {
                        const permission = event.target.value;
                        if (permission) updateUser(row, { permissions: Array.from(new Set([...(row.permissions ?? []), permission])) }, "Yetki eklendi.");
                      }}
                    >
                      <option value="">Yetki Ekle</option>
                      {PERMISSION_CATALOG.map((permission) => {
                        const description = describePermission(permission);
                        return <option key={permission} value={permission}>{description.moduleLabel} - {description.actionLabel}</option>;
                      })}
                    </select>
                    <Button disabled={!canEdit} variant="outline" size="sm" onClick={() => updateUser(row, { permissions: [] }, "Özel yetkiler temizlendi.")}>Temizle</Button>
                    <select
                      disabled={!canEdit}
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                      value={row.default_company_id ?? ""}
                      onChange={(event) => assignUserCompany(row, event.target.value || null)}
                    >
                      <option value="">Şirket Seç</option>
                      {companies.map((company) => <option key={company.id} value={company.id}>{company.trade_name || company.legal_name}</option>)}
                    </select>
                    <select
                      disabled={!canEdit}
                      className="h-9 rounded-md border border-input bg-background px-2 text-xs"
                      value={row.default_branch_id ?? ""}
                      onChange={(event) => assignUserBranch(row, event.target.value || null)}
                    >
                      <option value="">Şube Seç</option>
                      {branches.filter((branch) => !row.default_company_id || branch.company_id === row.default_company_id).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                    </select>
                    <Button disabled={!canEdit} variant="outline" size="sm" onClick={() => updateUser(row, { is_active: !row.is_active }, row.is_active ? "Kullanıcı pasifleştirildi." : "Kullanıcı aktifleştirildi.")}>
                      {row.is_active ? "Pasifleştir" : "Aktifleştir"}
                    </Button>
                  </div>
                ),
              },
            ]}
          />
        </TabsContent>

        <TabsContent value="companies" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Şirket Oluştur</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateCompany} className="grid gap-3 md:grid-cols-5">
                <Input required disabled={!canEdit} placeholder="Kod" value={companyForm.code} onChange={(event) => setCompanyForm((current) => ({ ...current, code: event.target.value }))} />
                <Input required disabled={!canEdit} placeholder="Yasal Unvan" value={companyForm.legal_name} onChange={(event) => setCompanyForm((current) => ({ ...current, legal_name: event.target.value }))} />
                <Input disabled={!canEdit} placeholder="Ticari Unvan" value={companyForm.trade_name} onChange={(event) => setCompanyForm((current) => ({ ...current, trade_name: event.target.value }))} />
                <Input disabled={!canEdit} type="email" placeholder="Yönetici E-posta" value={companyForm.primary_admin_email} onChange={(event) => setCompanyForm((current) => ({ ...current, primary_admin_email: event.target.value }))} />
                <Button disabled={!canEdit} type="submit">Oluştur</Button>
              </form>
            </CardContent>
          </Card>
          <DataTable
            data={companies}
            rowKey={(row) => row.id}
            columns={[
              { key: "code", header: "Kod", render: (row) => row.code },
              { key: "name", header: "Şirket", render: (row) => <div><p className="font-medium">{row.trade_name || row.legal_name}</p><p className="text-xs text-muted-foreground">{row.legal_name}</p></div> },
              { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.status === "active" ? "Aktif" : row.status === "passive" ? "Pasif" : "Askıda"} tone={row.status === "active" ? "success" : "muted"} /> },
              { key: "currency", header: "Para Birimi", render: (row) => row.base_currency },
              { key: "admin", header: "Yönetici", render: (row) => row.primary_admin_email || "-" },
              { key: "actions", header: "İşlemler", render: (row) => <Button disabled={!canEdit} variant="outline" size="sm" onClick={() => updateCompany(row.id, { status: row.status === "active" ? "passive" : "active" }).then(load)}>{row.status === "active" ? "Pasifleştir" : "Aktifleştir"}</Button> },
            ]}
          />
        </TabsContent>

        <TabsContent value="branches" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Şube Oluştur</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateBranch} className="grid gap-3 md:grid-cols-6">
                <select required disabled={!canEdit} className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={branchForm.company_id} onChange={(event) => setBranchForm((current) => ({ ...current, company_id: event.target.value }))}>
                  <option value="">Şirket Seç</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.trade_name || company.legal_name}</option>)}
                </select>
                <Input required disabled={!canEdit} placeholder="Kod" value={branchForm.code} onChange={(event) => setBranchForm((current) => ({ ...current, code: event.target.value }))} />
                <Input required disabled={!canEdit} placeholder="Şube Adı" value={branchForm.name} onChange={(event) => setBranchForm((current) => ({ ...current, name: event.target.value }))} />
                <Input disabled={!canEdit} placeholder="Şehir" value={branchForm.city} onChange={(event) => setBranchForm((current) => ({ ...current, city: event.target.value }))} />
                <Input disabled={!canEdit} type="email" placeholder="Yönetici E-posta" value={branchForm.manager_email} onChange={(event) => setBranchForm((current) => ({ ...current, manager_email: event.target.value }))} />
                <Button disabled={!canEdit} type="submit">Oluştur</Button>
              </form>
            </CardContent>
          </Card>
          <DataTable
            data={branches}
            rowKey={(row) => row.id}
            columns={[
              { key: "company", header: "Şirket", render: (row) => companyName(row.company_id) },
              { key: "code", header: "Kod", render: (row) => row.code },
              { key: "name", header: "Şube", render: (row) => row.name },
              { key: "city", header: "Şehir", render: (row) => row.city || "-" },
              { key: "manager", header: "Yönetici", render: (row) => row.manager_email || "-" },
              { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.status === "active" ? "Aktif" : row.status === "passive" ? "Pasif" : "Kapalı"} tone={row.status === "active" ? "success" : "muted"} /> },
              { key: "actions", header: "İşlemler", render: (row) => <Button disabled={!canEdit} variant="outline" size="sm" onClick={() => updateBranch(row.id, { status: row.status === "active" ? "passive" : "active" }).then(load)}>{row.status === "active" ? "Pasifleştir" : "Aktifleştir"}</Button> },
            ]}
          />
        </TabsContent>

        <TabsContent value="warehouses" className="space-y-4">
          <Card>
            <CardHeader><CardTitle className="text-lg">Depo Oluştur</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={handleCreateWarehouse} className="grid gap-3 md:grid-cols-7">
                <select required disabled={!canEdit} className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={warehouseForm.company_id} onChange={(event) => setWarehouseForm((current) => ({ ...current, company_id: event.target.value, branch_id: "" }))}>
                  <option value="">Şirket Seç</option>
                  {companies.map((company) => <option key={company.id} value={company.id}>{company.trade_name || company.legal_name}</option>)}
                </select>
                <select disabled={!canEdit} className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={warehouseForm.branch_id} onChange={(event) => setWarehouseForm((current) => ({ ...current, branch_id: event.target.value }))}>
                  <option value="">Şirket Geneli</option>
                  {branches.filter((branch) => !warehouseForm.company_id || branch.company_id === warehouseForm.company_id).map((branch) => <option key={branch.id} value={branch.id}>{branch.name}</option>)}
                </select>
                <Input required disabled={!canEdit} placeholder="Kod" value={warehouseForm.code} onChange={(event) => setWarehouseForm((current) => ({ ...current, code: event.target.value }))} />
                <Input required disabled={!canEdit} placeholder="Depo Adı" value={warehouseForm.name} onChange={(event) => setWarehouseForm((current) => ({ ...current, name: event.target.value }))} />
                <Input disabled={!canEdit} placeholder="Şehir" value={warehouseForm.city} onChange={(event) => setWarehouseForm((current) => ({ ...current, city: event.target.value }))} />
                <Input disabled={!canEdit} type="email" placeholder="Yönetici E-posta" value={warehouseForm.manager_email} onChange={(event) => setWarehouseForm((current) => ({ ...current, manager_email: event.target.value }))} />
                <Button disabled={!canEdit} type="submit">Oluştur</Button>
              </form>
            </CardContent>
          </Card>
          <DataTable
            data={warehouses}
            rowKey={(row) => row.id}
            columns={[
              { key: "company", header: "Şirket", render: (row) => companyName(row.company_id) },
              { key: "branch", header: "Şube", render: (row) => branchName(row.branch_id) },
              { key: "code", header: "Kod", render: (row) => row.code },
              { key: "name", header: "Depo", render: (row) => row.name },
              { key: "scope", header: "Görünürlük", render: (row) => row.visibility_scope === "branch" ? "Şube" : row.visibility_scope === "company" ? "Şirket" : "Özel" },
              { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.status === "active" ? "Aktif" : row.status === "passive" ? "Pasif" : "Kapalı"} tone={row.status === "active" ? "success" : "muted"} /> },
              { key: "actions", header: "İşlemler", render: (row) => <Button disabled={!canEdit} variant="outline" size="sm" onClick={() => updateWarehouse(row.id, { status: row.status === "active" ? "passive" : "active" }).then(load)}>{row.status === "active" ? "Pasifleştir" : "Aktifleştir"}</Button> },
            ]}
          />
        </TabsContent>

        <TabsContent value="roles">
          <DataTable
            data={FOUNDATION_ROLE_OPTIONS.map((role) => ({ ...role, count: FOUNDATION_ROLE_PERMISSION_MAP[role.id]?.length ?? 0 }))}
            rowKey={(row) => row.id}
            columns={[
              { key: "role", header: "Rol", render: (row) => <StatusBadge label={row.label} tone={row.id === "admin" ? "success" : "default"} /> },
              { key: "description", header: "Açıklama", render: (row) => row.description },
              { key: "count", header: "Yetki Sayısı", render: (row) => row.count },
              { key: "status", header: "Durum", render: () => <StatusBadge label="Hazır" tone="success" /> },
            ]}
          />
        </TabsContent>

        <TabsContent value="permissions">
          <DataTable
            data={PERMISSION_CATALOG.map((permission) => ({ permission, ...describePermission(permission) }))}
            rowKey={(row) => row.permission}
            columns={[
              { key: "module", header: "Alan", render: (row) => row.moduleLabel },
              { key: "action", header: "İşlem", render: (row) => row.actionLabel },
              { key: "status", header: "Durum", render: () => <StatusBadge label="Tanımlı" tone="success" /> },
            ]}
          />
        </TabsContent>
      </Tabs>

      <div className="grid gap-4 md:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Güvenlik İlkeleri</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Kimlik doğrulama Supabase Auth ile çalışır.</p>
            <p>Yetkilendirme için mevcut yönetici ve ERP kullanıcı kayıtları kullanılır.</p>
            <p>Kesin veri güvenliği için RLS politikaları sonraki aşamada sıkılaştırılmalıdır.</p>
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle className="text-lg">Gelecek Hazırlığı</CardTitle>
          </CardHeader>
          <CardContent className="space-y-2 text-sm text-muted-foreground">
            <p>Çoklu rol, departman yetkileri ve kayıt bazlı erişim için kullanıcı kaydında alanlar ayrıldı.</p>
            <p>Onay akışları ve denetim kayıtları bu yetki temeli üzerine eklenebilir.</p>
          </CardContent>
        </Card>
      </div>
    </ERPLayout>
  );
}
