import { FormEvent, useEffect, useMemo, useState } from "react";
import { Plus, RefreshCw, Save, Search, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Checkbox } from "@/components/ui/checkbox";
import { Input } from "@/components/ui/input";
import { Textarea } from "@/components/ui/textarea";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from "@/components/ui/select";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { useToast } from "@/hooks/use-toast";
import AdminLayout from "./AdminLayout";
import { AdminEmptyState, AdminSection } from "./AdminPage";
import { AdminTableConfig, AdminTableRow, deleteAdminRow, formatAdminValue, listAdminRows, upsertAdminRow } from "./adminData";

function emptyForm(config: AdminTableConfig) {
  return Object.fromEntries((config.editableFields ?? []).map((field) => [field.key, field.type === "boolean" ? false : ""]));
}

export default function AdminTablePage({ config }: { config: AdminTableConfig }) {
  const { toast } = useToast();
  const [rows, setRows] = useState<AdminTableRow[]>([]);
  const [search, setSearch] = useState("");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);
  const [editing, setEditing] = useState<AdminTableRow | null>(null);

  const canEdit = Boolean(config.editableFields?.length);
  const form = useMemo(() => editing ?? emptyForm(config), [config, editing]);

  const loadRows = async () => {
    setLoading(true);
    const result = await listAdminRows(config, search);
    setRows(result.data);
    setError(result.error);
    setLoading(false);
  };

  useEffect(() => {
    loadRows();
  }, [config.key]);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    const result = await upsertAdminRow(config, form);
    if (result.error) {
      toast({ title: "Kayıt yapılamadı", description: result.error, variant: "destructive" });
      return;
    }
    toast({ title: "Kaydedildi", description: `${config.title} kaydı güncellendi.` });
    setEditing(null);
    await loadRows();
  };

  return (
    <AdminLayout title={config.title} description={config.description}>
      <AdminSection
        title="Liste"
        action={
          <div className="flex gap-2">
            {canEdit ? (
              <Button size="sm" onClick={() => setEditing(emptyForm(config))}>
                <Plus className="mr-2 h-4 w-4" />
                Yeni
              </Button>
            ) : null}
            <Button size="sm" variant="outline" onClick={loadRows}>
              <RefreshCw className="mr-2 h-4 w-4" />
              Yenile
            </Button>
          </div>
        }
      >
        <form
          className="mb-4 flex gap-2"
          onSubmit={(event) => {
            event.preventDefault();
            loadRows();
          }}
        >
          <div className="relative flex-1">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-slate-400" />
            <Input className="pl-9" placeholder={config.searchPlaceholder} value={search} onChange={(event) => setSearch(event.target.value)} />
          </div>
          <Button type="submit" variant="outline">Ara</Button>
        </form>

        {loading ? (
          <AdminEmptyState message="Veriler yükleniyor..." />
        ) : error ? (
          <AdminEmptyState message={error} />
        ) : rows.length ? (
          <Table>
            <TableHeader>
              <TableRow>
                {config.columns.map((column) => (
                  <TableHead key={column.key}>{column.label}</TableHead>
                ))}
                {canEdit ? <TableHead className="w-32 text-right">İşlem</TableHead> : null}
              </TableRow>
            </TableHeader>
            <TableBody>
              {rows.map((row, index) => (
                <TableRow key={String(row.id ?? index)}>
                  {config.columns.map((column) => (
                    <TableCell key={column.key} className={column.key === config.columns[0].key ? "font-medium" : undefined}>
                      {formatAdminValue(row[column.key], column.format, config.valueLabels?.[column.key])}
                    </TableCell>
                  ))}
                  {canEdit ? (
                    <TableCell className="text-right">
                      <div className="flex justify-end gap-2">
                        <Button size="sm" variant="outline" onClick={() => setEditing(row)}>Düzenle</Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          onClick={async () => {
                            if (!row.id || !window.confirm("Bu kaydı silmek istediğinize emin misiniz?")) return;
                            const result = await deleteAdminRow(config, row.id);
                            if (result.error) toast({ title: "Silinemedi", description: result.error, variant: "destructive" });
                            await loadRows();
                          }}
                        >
                          <Trash2 className="h-4 w-4" />
                        </Button>
                      </div>
                    </TableCell>
                  ) : null}
                </TableRow>
              ))}
            </TableBody>
          </Table>
        ) : (
          <AdminEmptyState message="Kayıt bulunamadı." />
        )}
      </AdminSection>

      {canEdit && editing ? (
        <AdminSection title={editing.id ? "Kaydı Düzenle" : "Yeni Kayıt"}>
          <form onSubmit={submit} className="grid gap-4 md:grid-cols-2">
            {config.editableFields?.map((field) => (
              <label key={field.key} className={field.type === "textarea" ? "space-y-1 md:col-span-2" : "space-y-1"}>
                <span className="text-sm font-medium text-slate-700">{field.label}</span>
                {field.type === "textarea" ? (
                  <Textarea value={String(form[field.key] ?? "")} onChange={(event) => setEditing({ ...form, [field.key]: event.target.value })} />
                ) : field.type === "select" ? (
                  <Select value={String(form[field.key] ?? "")} onValueChange={(value) => setEditing({ ...form, [field.key]: value })}>
                    <SelectTrigger><SelectValue placeholder="Seçin" /></SelectTrigger>
                    <SelectContent>{field.options?.map((option) => <SelectItem key={option} value={option}>{field.optionLabels?.[option] ?? option}</SelectItem>)}</SelectContent>
                  </Select>
                ) : field.type === "boolean" ? (
                  <div className="flex h-10 items-center gap-2 rounded-md border px-3">
                    <Checkbox checked={Boolean(form[field.key])} onCheckedChange={(value) => setEditing({ ...form, [field.key]: Boolean(value) })} />
                    <span className="text-sm text-slate-600">Aktif</span>
                  </div>
                ) : (
                  <Input
                    type={field.type === "number" ? "number" : "text"}
                    required={field.required}
                    value={String(form[field.key] ?? "")}
                    onChange={(event) => setEditing({ ...form, [field.key]: field.type === "number" ? Number(event.target.value) : event.target.value })}
                  />
                )}
              </label>
            ))}
            <div className="flex gap-2 md:col-span-2">
              <Button type="submit">
                <Save className="mr-2 h-4 w-4" />
                Kaydet
              </Button>
              <Button type="button" variant="outline" onClick={() => setEditing(null)}>Vazgeç</Button>
            </div>
          </form>
        </AdminSection>
      ) : null}
    </AdminLayout>
  );
}
