import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { EmptyState } from "@/components/erp/EmptyState";
import { ConfirmDialog } from "@/components/erp/ConfirmDialog";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { createStakeholder, listStakeholders, updateStakeholder } from "../shared/erpApi";
import { Stakeholder, StakeholderType } from "../shared/types";
import { LegacyCustomerImportPanel } from "./LegacyCustomerImportPanel";
import { StakeholderForm } from "./StakeholderForm";
import { StakeholderTable } from "./StakeholderTable";

export default function StakeholdersPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [typeFilter, setTypeFilter] = useState<StakeholderType | "all">("all");
  const [selected, setSelected] = useState<Stakeholder | null>(null);
  const [editing, setEditing] = useState<Stakeholder | null>(null);
  const [error, setError] = useState<string | null>(null);

  const load = async (query = search, type = typeFilter) => {
    setLoading(true);
    const result = await listStakeholders(query, type);
    if (result.error) {
      setError(result.error);
      toast({ title: "Hata", description: `Paydaşlar yüklenemedi: ${result.error}`, variant: "destructive" });
    } else {
      setError(null);
    }
    setRows(result.data);
    setLoading(false);
  };

  useEffect(() => {
    load();
  }, []);

  const filtered = useMemo(() => {
    if (!search.trim()) return rows;
    const q = search.toLowerCase();
    return rows.filter((item) => item.company_name.toLowerCase().includes(q));
  }, [rows, search]);

  return (
    <ERPLayout title="CRM ve Paydaş Yönetimi">
      <PageHeader
        title="CRM ve Paydaş Yönetimi"
        description="Müşteri, tedarikçi ve fason firmaları tek listeden yönetin."
      />

      <StakeholderForm
        editing={editing}
        loading={saving}
        onSubmit={async (values) => {
          setSaving(true);
          const payload = {
            ...values,
            risk_limit: Number(values.risk_limit || 0),
          };
          const result = editing
            ? await updateStakeholder(editing.id, payload)
            : await createStakeholder(payload);
          setSaving(false);

          if (result.error) {
            toast({ title: "Kayıt Hatası", description: result.error, variant: "destructive" });
            return;
          }

          toast({ title: "Başarılı", description: editing ? "Paydaş kaydı güncellendi." : "Paydaş kaydı eklendi." });
          setEditing(null);
          await load(search);
        }}
        onCancelEdit={() => setEditing(null)}
      />

      <div className="space-y-3">
        {error ? <MigrationNotice message={error} /> : null}

        <LegacyCustomerImportPanel onImported={() => load(search, typeFilter)} />

        <div className="grid gap-3 md:grid-cols-[1fr_220px]">
          <Input
            placeholder="Firma, yetkili, telefon veya e-posta ara..."
            value={search}
            onChange={(e) => {
              setSearch(e.target.value);
              load(e.target.value, typeFilter);
            }}
          />
          <select
            className="h-10 rounded-md border bg-background px-3 text-sm"
            value={typeFilter}
            onChange={(e) => {
              const next = e.target.value as StakeholderType | "all";
              setTypeFilter(next);
              load(search, next);
            }}
          >
            <option value="all">Tüm Tipler</option>
            <option value="customer">Müşteri</option>
            <option value="supplier">Tedarikçi</option>
            <option value="subcontractor">Fason</option>
            <option value="both">Karma</option>
          </select>
        </div>

        {loading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Paydaş bulunamadı"
            description="Arama filtresini temizleyin veya yeni paydaş ekleyin."
          />
        ) : (
          <StakeholderTable
            data={filtered}
            onEdit={(stakeholder) => setEditing(stakeholder)}
            onDeactivate={(stakeholder) => setSelected(stakeholder)}
            onActivate={async (stakeholder) => {
              const result = await updateStakeholder(stakeholder.id, { is_active: true });
              if (result.error) {
                toast({ title: "Hata", description: result.error, variant: "destructive" });
                return;
              }
              toast({ title: "Güncellendi", description: "Paydaş aktif duruma alındı." });
              await load(search);
            }}
          />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Paydaş pasifleştirilsin mi?"
        description="Silme yapılmaz, yalnızca kayıt pasif duruma alınır."
        confirmText="Pasifleştir"
        onConfirm={async () => {
          if (!selected) return;
          const result = await updateStakeholder(selected.id, { is_active: false });
          if (result.error) {
            toast({ title: "Hata", description: result.error, variant: "destructive" });
            return;
          }
          toast({ title: "Güncellendi", description: "Paydaş pasif duruma alındı." });
          setSelected(null);
          await load(search);
        }}
      />
    </ERPLayout>
  );
}
