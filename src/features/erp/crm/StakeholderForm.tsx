import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSection } from "@/components/erp/FormSection";
import { StakeholderType } from "../shared/types";

type StakeholderFormValues = {
  type: StakeholderType;
  company_name: string;
  contact_name: string;
  phone: string;
  email: string;
};

type StakeholderFormProps = {
  loading?: boolean;
  onSubmit: (values: StakeholderFormValues) => Promise<void>;
};

export function StakeholderForm({ loading = false, onSubmit }: StakeholderFormProps) {
  const [form, setForm] = useState<StakeholderFormValues>({
    type: "customer",
    company_name: "",
    contact_name: "",
    phone: "",
    email: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.company_name.trim()) return;
    await onSubmit(form);
    setForm((prev) => ({ ...prev, company_name: "", contact_name: "", phone: "", email: "" }));
  };

  return (
    <FormSection title="Yeni Paydas" description="Müsteri, tedarikçi veya fason firma ekleyin.">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <label className="text-sm">
          Tip
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3"
            value={form.type}
            onChange={(e) => setForm((prev) => ({ ...prev, type: e.target.value as StakeholderType }))}
          >
            <option value="customer">Müsteri</option>
            <option value="supplier">Tedarikçi</option>
            <option value="subcontractor">Fason</option>
            <option value="both">Karma</option>
          </select>
        </label>

        <label className="text-sm">
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

        <label className="text-sm md:col-span-2">
          E-posta
          <Input
            className="mt-1"
            value={form.email}
            onChange={(e) => setForm((prev) => ({ ...prev, email: e.target.value }))}
            placeholder="ornek@firma.com"
          />
        </label>

        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Kaydediliyor..." : "Paydas Ekle"}
          </Button>
        </div>
      </form>
    </FormSection>
  );
}
