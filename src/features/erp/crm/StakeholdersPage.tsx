import { useEffect, useMemo, useState } from "react";
import { Input } from "@/components/ui/input";
import { useToast } from "@/hooks/use-toast";
import { ERPLayout } from "../layout/ERPLayout";
import { PageHeader } from "@/components/erp/PageHeader";
import { EmptyState } from "@/components/erp/EmptyState";
import { ConfirmDialog } from "@/components/erp/ConfirmDialog";
import { createStakeholder, listStakeholders, updateStakeholder } from "../shared/erpApi";
import { Stakeholder } from "../shared/types";
import { StakeholderForm } from "./StakeholderForm";
import { StakeholderTable } from "./StakeholderTable";

export default function StakeholdersPage() {
  const { toast } = useToast();
  const [rows, setRows] = useState<Stakeholder[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<Stakeholder | null>(null);

  const load = async (query = "") => {
    setLoading(true);
    const result = await listStakeholders(query);
    if (result.error) {
      toast({ title: "Hata", description: `Paydaslar yüklenemedi: ${result.error}`, variant: "destructive" });
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
    <ERPLayout title="CRM ve Paydas Yönetimi">
      <PageHeader
        title="CRM ve Paydas Yönetimi"
        description="Müsteri, tedarikçi ve fason firmalari tek listeden yönetin."
      />

      <StakeholderForm
        loading={saving}
        onSubmit={async (values) => {
          setSaving(true);
          const result = await createStakeholder(values);
          setSaving(false);

          if (result.error) {
            toast({ title: "Kayit Hatasi", description: result.error, variant: "destructive" });
            return;
          }

          toast({ title: "Basarili", description: "Paydas kaydi eklendi." });
          await load(search);
        }}
      />

      <div className="space-y-3">
        <Input
          placeholder="Firma adina göre ara..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
        />

        {loading ? (
          <p className="text-sm text-muted-foreground">Yükleniyor...</p>
        ) : filtered.length === 0 ? (
          <EmptyState
            title="Paydas bulunamadi"
            description="Arama filtresini temizleyin veya yeni paydas ekleyin."
          />
        ) : (
          <StakeholderTable data={filtered} onDeactivate={(stakeholder) => setSelected(stakeholder)} />
        )}
      </div>

      <ConfirmDialog
        open={Boolean(selected)}
        onOpenChange={(open) => {
          if (!open) setSelected(null);
        }}
        title="Paydas pasiflestirilsin mi?"
        description="Silme yapilmaz, yalnizca kayit pasif duruma alinir."
        confirmText="Pasiflestir"
        onConfirm={async () => {
          if (!selected) return;
          const result = await updateStakeholder(selected.id, { is_active: false });
          if (result.error) {
            toast({ title: "Hata", description: result.error, variant: "destructive" });
            return;
          }
          toast({ title: "Güncellendi", description: "Paydas pasif duruma alindi." });
          setSelected(null);
          await load(search);
        }}
      />
    </ERPLayout>
  );
}
