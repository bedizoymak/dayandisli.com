import { useEffect, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { FormSection } from "@/components/erp/FormSection";
import { Stakeholder, StakeholderType } from "../shared/types";

type StakeholderFormValues = {
  type: StakeholderType;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
  tax_office: string;
  tax_number: string;
  address: string;
  city: string;
  country: string;
  risk_limit: string;
  notes: string;
  is_active: boolean;
};

type StakeholderFormProps = {
  editing?: Stakeholder | null;
  loading?: boolean;
  onSubmit: (values: StakeholderFormValues) => Promise<void>;
  onCancelEdit?: () => void;
};

const emptyForm: StakeholderFormValues = {
  type: "customer",
  company_name: "",
  contact_name: "",
  phone: "",
  email: "",
  tax_office: "",
  tax_number: "",
  address: "",
  city: "",
  country: "Türkiye",
  risk_limit: "0",
  notes: "",
  is_active: true,
};

export function StakeholderForm({ editing, loading = false, onSubmit, onCancelEdit }: StakeholderFormProps) {
  const [form, setForm] = useState<StakeholderFormValues>({
    ...emptyForm,
  });

  useEffect(() => {
    if (!editing) {
      setForm({ ...emptyForm });
      return;
    }

    setForm({
      type: editing.type,
      company_name: editing.company_name,
      contact_name: editing.contact_name ?? "",
      phone: editing.phone ?? "",
      email: editing.email ?? "",
      tax_office: editing.tax_office ?? "",
      tax_number: editing.tax_number ?? "",
      address: editing.address ?? "",
      city: editing.city ?? "",
      country: editing.country ?? "Türkiye",
      risk_limit: String(editing.risk_limit ?? 0),
      notes: editing.notes ?? "",
      is_active: editing.is_active,
    });
  }, [editing]);

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    await onSubmit(form);
    if (!editing) setForm({ ...emptyForm });
  };

  return (
    <FormSection
      title={editing ? "Paydaş Düzenle" : "Yeni Paydaş"}
      description="Müşteri, tedarikçi veya fason firma kartını yönetin."
    >
      <form className="grid gap-3 md:grid-cols-4" onSubmit={submit}>
        <label className="text-sm">
          Tip
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3"
            value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as StakeholderType }))}
          >
            <option value="customer">Müşteri</option>
            <option value="supplier">Tedarikçi</option>
            <option value="subcontractor">Fason</option>
            <option value="both">Karma</option>
          </select>
        </label>

        <label className="text-sm md:col-span-2">
          Firma *
          <Input
            className="mt-1"
            value={form.company_name}
            onChange={(e) => setForm((prev) => ({ ...prev, company_name: e.target.value }))}
            placeholder="Örn: ABC Makina"
            required
          />
        </label>

        <label className="text-sm">
          Yetkili
          <Input
            className="mt-1"
            value={form.contact_name}
            onChange={(e) => setForm((prev) => ({ ...prev, contact_name: e.target.value }))}
            placeholder="Ad Soyad"
          />
        </label>

        <label className="text-sm">
          Telefon
          <Input
            className="mt-1"
            value={form.phone}
            onChange={(e) => setForm((prev) => ({ ...prev, phone: e.target.value }))}
            placeholder="05xx xxx xx xx"
          />
        </label>

        <label className="text-sm">
          E-posta
          <Input
            className="mt-1"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="ornek@firma.com"
          />
        </label>

        <label className="text-sm">
          Vergi Dairesi
          <Input
            className="mt-1"
            value={form.tax_office}
            onChange={(e) => setForm((prev) => ({ ...prev, tax_office: e.target.value }))}
          />
        </label>

        <label className="text-sm">
          Vergi No
          <Input
            className="mt-1"
            value={form.tax_number}
            onChange={(e) => setForm((prev) => ({ ...prev, tax_number: e.target.value }))}
          />
        </label>

        <label className="text-sm">
          Şehir
          <Input
            className="mt-1"
            value={form.city}
            onChange={(e) => setForm((prev) => ({ ...prev, city: e.target.value }))}
          />
        </label>

        <label className="text-sm">
          Ülke
          <Input
            className="mt-1"
            value={form.country}
            onChange={(e) => setForm((prev) => ({ ...prev, country: e.target.value }))}
          />
        </label>

        <label className="text-sm">
          Risk Limiti
          <Input
            className="mt-1"
            type="number"
            step="0.01"
            value={form.risk_limit}
            onChange={(e) => setForm((prev) => ({ ...prev, risk_limit: e.target.value }))}
          />
        </label>

        <label className="text-sm">
          Durum
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3"
            value={form.is_active ? "active" : "passive"}
            onChange={(e) => setForm((prev) => ({ ...prev, is_active: e.target.value === "active" }))}
          >
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </select>
        </label>

        <label className="text-sm md:col-span-2">
          Adres
          <Textarea
            className="mt-1"
            value={form.address}
            onChange={(e) => setForm((prev) => ({ ...prev, address: e.target.value }))}
          />
        </label>

        <label className="text-sm md:col-span-2">
          Not
          <Textarea
            className="mt-1"
            value={form.notes}
            onChange={(e) => setForm((prev) => ({ ...prev, notes: e.target.value }))}
          />
        </label>

        <div className="md:col-span-4 flex justify-end gap-2">
          {editing ? (
            <Button type="button" variant="outline" onClick={onCancelEdit}>
              Vazgeç
            </Button>
          ) : null}
          <Button type="submit" disabled={loading}>
            {loading ? "Kaydediliyor..." : editing ? "Güncelle" : "Paydaş Ekle"}
          </Button>
        </div>
      </form>
    </FormSection>
  );
}
