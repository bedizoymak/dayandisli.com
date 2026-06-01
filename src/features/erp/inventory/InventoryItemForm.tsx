import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { FormSection } from "@/components/erp/FormSection";
import { InventoryItemType } from "../shared/types";

type InventoryItemFormValues = {
  item_type: InventoryItemType;
  code: string;
  name: string;
  unit: string;
  current_stock: string;
  min_stock: string;
  location: string;
};

type InventoryItemFormProps = {
  loading?: boolean;
  onSubmit: (values: InventoryItemFormValues) => Promise<void>;
};

export function InventoryItemForm({ loading = false, onSubmit }: InventoryItemFormProps) {
  const [form, setForm] = useState<InventoryItemFormValues>({
    item_type: "raw_material",
    code: "",
    name: "",
    unit: "adet",
    current_stock: "0",
    min_stock: "0",
    location: "",
  });

  const submit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.name.trim()) return;
    await onSubmit(form);
    setForm((prev) => ({ ...prev, code: "", name: "", current_stock: "0", min_stock: "0", location: "" }));
  };

  return (
    <FormSection title="Yeni Stok Kartı" description="Hammadde, sarf ve mamul kartlarını hızlıca ekleyin.">
      <form className="grid gap-3 md:grid-cols-2 lg:grid-cols-3" onSubmit={submit}>
        <label className="text-sm">
          Tip
          <select
            className="mt-1 h-10 w-full rounded-md border bg-background px-3"
            value={form.item_type}
            onChange={(e) => setForm((prev) => ({ ...prev, item_type: e.target.value as InventoryItemType }))}
          >
            <option value="raw_material">Hammadde</option>
            <option value="consumable">Sarf Malzeme</option>
            <option value="tool">Takım</option>
            <option value="measuring_tool">Ölçüm Aleti</option>
            <option value="finished_good">Mamul</option>
            <option value="semi_finished">Yarı Mamul</option>
          </select>
        </label>

        <label className="text-sm">
          Kod
          <Input className="mt-1" value={form.code} onChange={(e) => setForm((prev) => ({ ...prev, code: e.target.value }))} />
        </label>

        <label className="text-sm">
          Ürün / Malzeme *
          <Input className="mt-1" value={form.name} onChange={(e) => setForm((prev) => ({ ...prev, name: e.target.value }))} required />
        </label>

        <label className="text-sm">
          Birim
          <Input className="mt-1" value={form.unit} onChange={(e) => setForm((prev) => ({ ...prev, unit: e.target.value }))} />
        </label>

        <label className="text-sm">
          Stok
          <Input
            className="mt-1"
            type="number"
            step="0.001"
            value={form.current_stock}
            onChange={(e) => setForm((prev) => ({ ...prev, current_stock: e.target.value }))}
          />
        </label>

        <label className="text-sm">
          Min Stok
          <Input
            className="mt-1"
            type="number"
            step="0.001"
            value={form.min_stock}
            onChange={(e) => setForm((prev) => ({ ...prev, min_stock: e.target.value }))}
          />
        </label>

        <label className="text-sm md:col-span-2 lg:col-span-3">
          Lokasyon
          <Input className="mt-1" value={form.location} onChange={(e) => setForm((prev) => ({ ...prev, location: e.target.value }))} />
        </label>

        <div className="md:col-span-2 lg:col-span-3 flex justify-end">
          <Button type="submit" disabled={loading}>
            {loading ? "Kaydediliyor..." : "Stok Kartı Ekle"}
          </Button>
        </div>
      </form>
    </FormSection>
  );
}
