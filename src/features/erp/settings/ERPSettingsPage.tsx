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
import { createERPUser, getCurrentERPUser, listERPUsers, updateERPUser } from "../shared/erpApi";
import {
  canManageERP,
  canManageUsers,
  FOUNDATION_ROLE_OPTIONS,
  FOUNDATION_ROLE_PERMISSION_MAP,
  PERMISSION_ACTION_LABELS,
  PERMISSION_CATALOG,
  ROLE_LABELS,
} from "../shared/permissions";
import { ERPRole, ERPUser } from "../shared/types";
import { ERPDatabaseStatusWidget } from "../dashboard/ERPDatabaseStatusWidget";

const MODULE_LABELS: Record<string, string> = {
  accounting: "Muhasebe",
  calculator: "Hesaplama",
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
  entries: "Fişler",
  journals: "Yevmiye",
  transactions: "Hareketler",
  periods: "Dönemler",
  categories: "Kategoriler",
  cash_bank: "Kasa ve Banka",
  export: "Dışa Aktarma",
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

export default function ERPSettingsPage() {
  const { toast } = useToast();
  const [user, setUser] = useState<ERPUser | null>(null);
  const [users, setUsers] = useState<ERPUser[]>([]);
  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState("all");
  const [form, setForm] = useState(defaultForm);

  const canEdit = canManageERP(user) || canManageUsers(user);

  const load = async () => {
    const [currentResult, usersResult] = await Promise.all([getCurrentERPUser(), listERPUsers()]);
    setUser(currentResult.data);
    setUsers(usersResult.data);
    if (usersResult.error) {
      toast({ title: "Hata", description: `Kullanıcılar yüklenemedi: ${usersResult.error}`, variant: "destructive" });
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
                    <Button disabled={!canEdit} variant="outline" size="sm" onClick={() => updateUser(row, { is_active: !row.is_active }, row.is_active ? "Kullanıcı pasifleştirildi." : "Kullanıcı aktifleştirildi.")}>
                      {row.is_active ? "Pasifleştir" : "Aktifleştir"}
                    </Button>
                  </div>
                ),
              },
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
