import { FormEvent, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import type { Party, PartyEntityType, PartyType } from "@/lib/finance/financeTypes";
import type { PartyPayload } from "@/services/partiesService";

type PartyFormProps = {
  mode: "customer" | "supplier";
  initialParty?: Party | null;
  loading?: boolean;
  onSubmit: (payload: PartyPayload) => Promise<void> | void;
};

type PartyFormState = {
  title: string;
  entity_type: PartyEntityType;
  tax_or_identity_no: string;
  contact_name: string;
  phone: string;
  email: string;
  address: string;
  city: string;
  district: string;
  tax_office: string;
  website: string;
  category: string;
  notes: string;
  is_active: string;
  default_account_type: "official" | "operational";
  risk_limit: string;
  payment_term_days: string;
  currency: string;
  tags: string;
};

function toState(party?: Party | null, mode?: "customer" | "supplier"): PartyFormState {
  return {
    title: party?.title || "",
    entity_type: party?.entity_type || "company",
    tax_or_identity_no: party?.tax_or_identity_no || "",
    contact_name: party?.contact_name || "",
    phone: party?.phone || "",
    email: party?.email || "",
    address: party?.address || "",
    city: party?.city || "",
    district: party?.district || "",
    tax_office: party?.tax_office || "",
    website: party?.website || "",
    category: party?.category || "",
    notes: party?.notes || "",
    is_active: party?.is_active === false ? "false" : "true",
    default_account_type: party?.default_account_type || "official",
    risk_limit: String(party?.risk_limit ?? 0),
    payment_term_days: String(party?.payment_term_days ?? 0),
    currency: party?.currency || "TRY",
    tags: party?.tags?.join(", ") || (mode === "supplier" ? "tedarik" : "müşteri"),
  };
}

function validate(state: PartyFormState, mode: "customer" | "supplier") {
  const errors: string[] = [];
  if (!state.title.trim()) errors.push(mode === "customer" ? "Firma ünvanı zorunludur." : "Tedarikçi ünvanı zorunludur.");
  if (!state.tax_or_identity_no.trim()) errors.push("TC/VKN zorunludur.");
  if (state.tax_or_identity_no && (state.tax_or_identity_no.length < 10 || state.tax_or_identity_no.length > 11)) {
    errors.push("TC/VKN 10 veya 11 haneli olmalıdır.");
  }
  if (state.email && !/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(state.email)) errors.push("Email formatı geçerli değil.");
  if (Number(state.risk_limit) < 0) errors.push("Risk limiti negatif olamaz.");
  if (Number(state.payment_term_days) < 0) errors.push("Ödeme vadesi negatif olamaz.");
  return errors;
}

export function PartyForm({ mode, initialParty, loading = false, onSubmit }: PartyFormProps) {
  const [state, setState] = useState<PartyFormState>(() => toState(initialParty, mode));
  const [errors, setErrors] = useState<string[]>([]);

  const titleLabel = mode === "customer" ? "Firma Ünvanı" : "Tedarikçi Ünvanı";
  const createdInfo = useMemo(() => {
    if (!initialParty?.created_at) return null;
    return new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(initialParty.created_at));
  }, [initialParty?.created_at]);

  const update = (key: keyof PartyFormState, value: string) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate(state, mode);
    setErrors(nextErrors);
    if (nextErrors.length) return;

    const payload: PartyPayload = {
      party_type: mode as PartyType,
      entity_type: state.entity_type,
      title: state.title,
      tax_or_identity_no: state.tax_or_identity_no || null,
      contact_name: state.contact_name || null,
      phone: state.phone || null,
      email: state.email || null,
      address: state.address || null,
      city: state.city || null,
      district: state.district || null,
      tax_office: state.tax_office || null,
      website: state.website || null,
      category: state.category || null,
      notes: state.notes || null,
      is_active: state.is_active === "true",
      default_account_type: state.default_account_type,
      risk_limit: Number(state.risk_limit || 0),
      payment_term_days: Number(state.payment_term_days || 0),
      currency: state.currency || "TRY",
      tags: state.tags
        .split(",")
        .map((tag) => tag.trim())
        .filter(Boolean),
    };

    await onSubmit(payload);
  };

  return (
    <form onSubmit={handleSubmit} className="space-y-6">
      {errors.length ? (
        <Card className="border-red-200 bg-red-50 text-red-800">
          <CardContent className="pt-6">
            <ul className="list-disc space-y-1 pl-5 text-sm">
              {errors.map((error) => (
                <li key={error}>{error}</li>
              ))}
            </ul>
          </CardContent>
        </Card>
      ) : null}

      <Card>
        <CardHeader>
          <CardTitle>Temel Bilgiler</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="title">{titleLabel} *</Label>
            <Input id="title" value={state.title} onChange={(event) => update("title", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="entity_type">Kişi Tipi *</Label>
            <select
              id="entity_type"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={state.entity_type}
              onChange={(event) => update("entity_type", event.target.value)}
            >
              <option value="company">Firma</option>
              <option value="individual">Şahıs</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax_or_identity_no">TC/VKN *</Label>
            <Input id="tax_or_identity_no" value={state.tax_or_identity_no} onChange={(event) => update("tax_or_identity_no", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="contact_name">İlgili Kişi Adı Soyadı</Label>
            <Input id="contact_name" value={state.contact_name} onChange={(event) => update("contact_name", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tax_office">Vergi Dairesi</Label>
            <Input id="tax_office" value={state.tax_office} onChange={(event) => update("tax_office", event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>İletişim ve Adres</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="phone">Telefon</Label>
            <Input id="phone" value={state.phone} onChange={(event) => update("phone", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="email">Email</Label>
            <Input id="email" type="email" value={state.email} onChange={(event) => update("email", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="city">İl</Label>
            <Input id="city" value={state.city} onChange={(event) => update("city", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="district">İlçe</Label>
            <Input id="district" value={state.district} onChange={(event) => update("district", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="website">Web Sitesi</Label>
            <Input id="website" value={state.website} onChange={(event) => update("website", event.target.value)} />
          </div>
          {mode === "supplier" ? (
            <div className="space-y-2">
              <Label htmlFor="category">Ürün/Hizmet Kategorisi</Label>
              <Input id="category" value={state.category} onChange={(event) => update("category", event.target.value)} />
            </div>
          ) : null}
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="address">Adres</Label>
            <Textarea id="address" value={state.address} onChange={(event) => update("address", event.target.value)} />
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>Cari ve Finans Ayarları</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2">
            <Label htmlFor="is_active">Cari Durum</Label>
            <select
              id="is_active"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={state.is_active}
              onChange={(event) => update("is_active", event.target.value)}
            >
              <option value="true">Aktif</option>
              <option value="false">Pasif</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="default_account_type">Varsayılan Hesap Tipi</Label>
            <select
              id="default_account_type"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={state.default_account_type}
              onChange={(event) => update("default_account_type", event.target.value)}
            >
              <option value="official">Resmi Hesap</option>
              <option value="operational">Operasyonel Takip</option>
            </select>
          </div>
          {mode === "customer" ? (
            <div className="space-y-2">
              <Label htmlFor="risk_limit">Risk Limiti</Label>
              <Input id="risk_limit" type="number" min="0" value={state.risk_limit} onChange={(event) => update("risk_limit", event.target.value)} />
            </div>
          ) : null}
          <div className="space-y-2">
            <Label htmlFor="payment_term_days">Ödeme Vadesi Günü</Label>
            <Input
              id="payment_term_days"
              type="number"
              min="0"
              value={state.payment_term_days}
              onChange={(event) => update("payment_term_days", event.target.value)}
            />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Para Birimi</Label>
            <Input id="currency" value={state.currency} onChange={(event) => update("currency", event.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="tags">Etiketler</Label>
            <Input id="tags" value={state.tags} onChange={(event) => update("tags", event.target.value)} placeholder="virgül ile ayırın" />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="notes">Notlar</Label>
            <Textarea id="notes" value={state.notes} onChange={(event) => update("notes", event.target.value)} />
          </div>
          {createdInfo ? (
            <div className="text-sm text-muted-foreground md:col-span-2">
              Oluşturulma tarihi: {createdInfo}
              {initialParty?.updated_at ? ` · Güncelleme tarihi: ${new Intl.DateTimeFormat("tr-TR", { dateStyle: "medium", timeStyle: "short" }).format(new Date(initialParty.updated_at))}` : ""}
            </div>
          ) : null}
        </CardContent>
      </Card>

      <div className="flex flex-col-reverse gap-3 sm:flex-row sm:justify-end">
        <Button type="submit" disabled={loading} className="gap-2">
          <Save className="h-4 w-4" />
          {loading ? "Kaydediliyor..." : "Kaydet"}
        </Button>
      </div>
    </form>
  );
}
