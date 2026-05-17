import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSection } from "@/components/erp/FormSection";
import { Stakeholder } from "../shared/types";

type SalesOrderFormValues = {
  stakeholder_id: string;
  title: string;
  due_date: string;
  priority: "low" | "normal" | "high" | "urgent";
};

type SalesOrderFormProps = {
  stakeholders: Stakeholder[];
  loading?: boolean;
  onSubmit: (values: SalesOrderFormValues) => Promise<void>;
};

export function SalesOrderForm({ stakeholders, loading = false, onSubmit }: SalesOrderFormProps) {
  const [form, setForm] = useState<SalesOrderFormValues>({
    stakeholder_id: "",
    title: "",
    due_date: "",
    priority: "normal",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.title.trim()) return;
    await onSubmit(form);
    setForm((prev) => ({ ...prev, title: "", due_date: "", stakeholder_id: "" }));
  };

  return (
    <FormSection title="Yeni Sipariş" description="ERP satış siparişi kaydı oluşturun.">
      <form className="grid gap-3 md:grid-cols-2" onSubmit={submit}>
        <label className="text-sm">
          Müşteri / Paydaş
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
            placeholder="Örn: Helis disli imalati"
            required
          />
        </label>

        <label className="text-sm">
          Termin Tarihi
          <Input
            className="mt-1"
            type="date"
            value={form.due_date}
            onChange={(e) => setForm((prev) => ({ ...prev, due_date: e.target.value }))}
          />
        </label>

        <label className="text-sm">
          Öncelik
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3"
            value={form.priority}
            onChange={(e) =>
              setForm((prev) => ({ ...prev, priority: e.target.value as SalesOrderFormValues["priority"] }))
            }
          >
            <option value="low">Düsük</option>
            <option value="normal">Normal</option>
            <option value="high">Yüksek</option>
            <option value="urgent">Acil</option>
          </select>
        </label>

        <div className="md:col-span-2 flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Kaydediliyor..." : "Sipariş Ekle"}
          </Button>
        </div>
      </form>
    </FormSection>
  );
}
