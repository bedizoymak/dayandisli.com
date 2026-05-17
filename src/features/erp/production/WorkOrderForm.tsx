import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSection } from "@/components/erp/FormSection";
import { Stakeholder } from "../shared/types";

type WorkOrderFormValues = {
  stakeholder_id: string;
  title: string;
  part_name: string;
  quantity: string;
  planned_end_date: string;
};

type WorkOrderFormProps = {
  stakeholders: Stakeholder[];
  loading?: boolean;
  onSubmit: (values: WorkOrderFormValues) => Promise<void>;
};

export function WorkOrderForm({ stakeholders, loading = false, onSubmit }: WorkOrderFormProps) {
  const [form, setForm] = useState<WorkOrderFormValues>({
    stakeholder_id: "",
    title: "",
    part_name: "",
    quantity: "1",
    planned_end_date: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await onSubmit(form);
    setForm((prev) => ({ ...prev, title: "", part_name: "", quantity: "1", planned_end_date: "" }));
  };

  return (
    <FormSection title="Yeni Is Emri" description="Siparis veya müsteri bazli is emri olusturun.">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <label className="text-sm">
          Müsteri / Paydas
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3"
            value={form.stakeholder_id}
            onChange={(e) => setForm((prev) => ({ ...prev, stakeholder_id: e.target.value }))}
          >
            <option value="">Seçiniz</option>
            {stakeholders.map((item) => (
              <option key={item.id} value={item.id}>
                {item.company_name}
              </option>
            ))}
          </select>
        </label>

        <label className="text-sm">
          Baslik *
          <Input
            className="mt-1"
            value={form.title}
            onChange={(e) => setForm((prev) => ({ ...prev, title: e.target.value }))}
            placeholder="Örn: Modül 2 helis taslama"
            required
          />
        </label>

        <label className="text-sm">
          Parça
          <Input
            className="mt-1"
            value={form.part_name}
            onChange={(e) => setForm((prev) => ({ ...prev, part_name: e.target.value }))}
            placeholder="Parça adi"
          />
        </label>

        <label className="text-sm">
          Miktar
          <Input
            className="mt-1"
            type="number"
            step="0.001"
            value={form.quantity}
            onChange={(e) => setForm((prev) => ({ ...prev, quantity: e.target.value }))}
          />
        </label>

        <label className="text-sm md:col-span-2">
          Termin
          <Input
            className="mt-1"
            type="date"
            value={form.planned_end_date}
            onChange={(e) => setForm((prev) => ({ ...prev, planned_end_date: e.target.value }))}
          />
        </label>

        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Kaydediliyor..." : "Is Emri Ekle"}
          </Button>
        </div>
      </form>
    </FormSection>
  );
}
