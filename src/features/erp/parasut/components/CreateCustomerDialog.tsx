import { useEffect, useState } from "react";
import { Loader2, Plus } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogFooter, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import { useERPAuth } from "@/contexts/ERPAuthContext";
import { callParasutWriteApi } from "../api/write-client";

const ACCOUNTING_CONTACTS_CREATE_PERMISSION = "accounting.contacts.create";

interface CreateCustomerFormState {
  name: string;
  shortName: string;
  email: string;
  phone: string;
  taxNumber: string;
  taxOffice: string;
  address: string;
  district: string;
  city: string;
  country: string;
  currency: string;
  paymentTermDays: string;
}

const EMPTY_FORM: CreateCustomerFormState = {
  name: "",
  shortName: "",
  email: "",
  phone: "",
  taxNumber: "",
  taxOffice: "",
  address: "",
  district: "",
  city: "",
  country: "",
  currency: "",
  paymentTermDays: "",
};

interface CreateCustomerResponse {
  commandId: string;
  status: string;
  provider: string;
  providerResourceId?: string;
  mirroredParasutId?: string;
  message: string;
}

type SubmitOutcome = { kind: "success"; response: CreateCustomerResponse } | { kind: "partial"; response: CreateCustomerResponse } | { kind: "unknown"; response: CreateCustomerResponse } | { kind: "error"; message: string };

function toOutcome(response: CreateCustomerResponse): SubmitOutcome {
  if (response.status === "mirrored_back") return { kind: "success", response };
  if (response.status === "unknown_result") return { kind: "unknown", response };
  if (response.status === "failed") return { kind: "error", message: response.message };
  return { kind: "partial", response };
}

/**
 * Hidden entirely unless BOTH the client-known permission AND the server's
 * live availability check agree the action is usable — the permission alone
 * only reflects what's in the user's cached permission list, not the current
 * ACCOUNTING_WRITE_ENABLED flag or provider capability, both of which can
 * change without the user's session changing. See
 * supabase/functions/parasut-write-api/handlers.ts's
 * computeCustomerCreateAvailability — the server remains the single source
 * of truth; this component never reads a Vite/frontend env var for this.
 */
export function CreateCustomerDialog({ onCreated }: { onCreated?: () => void }) {
  const { hasPermission } = useERPAuth();
  const [open, setOpen] = useState(false);
  const [confirmed, setConfirmed] = useState(false);
  const [form, setForm] = useState<CreateCustomerFormState>(EMPTY_FORM);
  const [idempotencyKey, setIdempotencyKey] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [outcome, setOutcome] = useState<SubmitOutcome | null>(null);
  const [available, setAvailable] = useState(false);

  const hasClientPermission = hasPermission(ACCOUNTING_CONTACTS_CREATE_PERMISSION);

  useEffect(() => {
    if (!hasClientPermission) return;
    let cancelled = false;
    callParasutWriteApi<{ available: boolean }>("customer-create-availability").then((result) => {
      if (!cancelled && !result.error) setAvailable(result.data.available);
    });
    return () => {
      cancelled = true;
    };
  }, [hasClientPermission]);

  if (!hasClientPermission || !available) return null;

  function resetAndClose() {
    setOpen(false);
    setConfirmed(false);
    setForm(EMPTY_FORM);
    setIdempotencyKey(null);
    setOutcome(null);
    setSubmitting(false);
  }

  function field(key: keyof CreateCustomerFormState) {
    return {
      value: form[key],
      onChange: (event: React.ChangeEvent<HTMLInputElement>) => setForm((current) => ({ ...current, [key]: event.target.value })),
    };
  }

  async function handleSubmit() {
    if (!confirmed || submitting) return;
    if (!form.name.trim()) {
      setOutcome({ kind: "error", message: "Müşteri adı zorunludur." });
      return;
    }

    // Generated once per dialog session and reused on any retry within the
    // same attempt — never regenerated after a submit starts, so a duplicate
    // click can never create a second command. See §8.13.
    const key = idempotencyKey ?? crypto.randomUUID();
    setIdempotencyKey(key);
    setSubmitting(true);
    setOutcome(null);

    const paymentTermDays = form.paymentTermDays.trim() ? Number(form.paymentTermDays) : null;
    const result = await callParasutWriteApi<CreateCustomerResponse>("create-customer", {
      confirmation: true,
      idempotencyKey: key,
      input: {
        name: form.name.trim(),
        shortName: form.shortName.trim() || null,
        email: form.email.trim() || null,
        phone: form.phone.trim() || null,
        taxNumber: form.taxNumber.trim() || null,
        taxOffice: form.taxOffice.trim() || null,
        address: form.address.trim() || null,
        district: form.district.trim() || null,
        city: form.city.trim() || null,
        country: form.country.trim() || null,
        currency: form.currency.trim() || null,
        paymentTermDays: paymentTermDays !== null && Number.isFinite(paymentTermDays) ? paymentTermDays : null,
      },
    });

    setSubmitting(false);
    if (result.error) {
      setOutcome({ kind: "error", message: result.error });
      return;
    }
    const nextOutcome = toOutcome(result.data);
    setOutcome(nextOutcome);
    if (nextOutcome.kind === "success") onCreated?.();
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        if (!next) resetAndClose();
        else setOpen(true);
      }}
    >
      <DialogTrigger asChild>
        <Button size="sm">
          <Plus className="mr-2 h-4 w-4" /> Yeni Müşteri
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[85vh] max-w-2xl overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Yeni Müşteri Oluştur</DialogTitle>
          <DialogDescription>Bu müşteri Paraşüt hesabında gerçek bir cari kaydı olarak oluşturulacaktır.</DialogDescription>
        </DialogHeader>

        {outcome?.kind === "success" ? (
          <Alert>
            <AlertTitle>Başarılı</AlertTitle>
            <AlertDescription>{outcome.response.message}</AlertDescription>
          </Alert>
        ) : outcome?.kind === "unknown" ? (
          <Alert variant="destructive">
            <AlertTitle>Sonuç Doğrulanamadı</AlertTitle>
            <AlertDescription>{outcome.response.message}</AlertDescription>
          </Alert>
        ) : outcome?.kind === "partial" ? (
          <Alert>
            <AlertTitle>İşlem Devam Ediyor</AlertTitle>
            <AlertDescription>{outcome.response.message}</AlertDescription>
          </Alert>
        ) : outcome?.kind === "error" ? (
          <Alert variant="destructive">
            <AlertTitle>Hata</AlertTitle>
            <AlertDescription>{outcome.message}</AlertDescription>
          </Alert>
        ) : null}

        {!outcome || outcome.kind === "error" ? (
          <div className="grid gap-3 sm:grid-cols-2">
            <div className="sm:col-span-2">
              <Label htmlFor="cc-name">Ad / Ünvan *</Label>
              <Input id="cc-name" {...field("name")} disabled={submitting} />
            </div>
            <div>
              <Label htmlFor="cc-shortName">Kısa Ad</Label>
              <Input id="cc-shortName" {...field("shortName")} disabled={submitting} />
            </div>
            <div>
              <Label htmlFor="cc-email">E-posta</Label>
              <Input id="cc-email" type="email" {...field("email")} disabled={submitting} />
            </div>
            <div>
              <Label htmlFor="cc-phone">Telefon</Label>
              <Input id="cc-phone" {...field("phone")} disabled={submitting} />
            </div>
            <div>
              <Label htmlFor="cc-taxNumber">Vergi Numarası</Label>
              <Input id="cc-taxNumber" {...field("taxNumber")} disabled={submitting} />
            </div>
            <div>
              <Label htmlFor="cc-taxOffice">Vergi Dairesi</Label>
              <Input id="cc-taxOffice" {...field("taxOffice")} disabled={submitting} />
            </div>
            <div className="sm:col-span-2">
              <Label htmlFor="cc-address">Adres</Label>
              <Input id="cc-address" {...field("address")} disabled={submitting} />
            </div>
            <div>
              <Label htmlFor="cc-district">İlçe</Label>
              <Input id="cc-district" {...field("district")} disabled={submitting} />
            </div>
            <div>
              <Label htmlFor="cc-city">İl</Label>
              <Input id="cc-city" {...field("city")} disabled={submitting} />
            </div>
            <div>
              <Label htmlFor="cc-country">Ülke</Label>
              <Input id="cc-country" {...field("country")} disabled={submitting} />
            </div>
            <div>
              <Label htmlFor="cc-currency">Para Birimi</Label>
              <Input id="cc-currency" {...field("currency")} disabled={submitting} />
            </div>
            <div>
              <Label htmlFor="cc-paymentTermDays">Vade (Gün)</Label>
              <Input id="cc-paymentTermDays" type="number" min={0} {...field("paymentTermDays")} disabled={submitting} />
            </div>

            <label className="mt-2 flex items-start gap-2 text-sm sm:col-span-2">
              <input type="checkbox" className="mt-1" checked={confirmed} onChange={(event) => setConfirmed(event.target.checked)} disabled={submitting} />
              <span>Bu müşterinin Paraşüt hesabında gerçek bir cari kaydı olarak oluşturulacağını onaylıyorum.</span>
            </label>
          </div>
        ) : null}

        <DialogFooter>
          {outcome?.kind === "success" || outcome?.kind === "unknown" ? (
            <Button onClick={resetAndClose}>Kapat</Button>
          ) : (
            <>
              <Button variant="outline" onClick={resetAndClose} disabled={submitting}>
                Vazgeç
              </Button>
              <Button onClick={handleSubmit} disabled={!confirmed || submitting || !form.name.trim()}>
                {submitting ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" /> Gönderiliyor...
                  </>
                ) : (
                  "Oluştur"
                )}
              </Button>
            </>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
