import { FormEvent, useEffect, useMemo, useState } from "react";
import { Save } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Textarea } from "@/components/ui/textarea";
import { AccountTypeSelector } from "./AccountTypeSelector";
import type {
  AccountType,
  FinancialDirection,
  FinancialTransactionType,
  Party,
  PaymentDocumentType,
  PaymentMethod,
  TransactionStatus,
} from "@/lib/finance/financeTypes";
import type { FinancialTransactionPayload } from "@/services/financeService";

type FinanceTransactionFormProps = {
  parties: Party[];
  initialPartyId?: string | null;
  loading?: boolean;
  onSubmit: (
    payload: FinancialTransactionPayload,
    paymentDocument?: {
      document_type: PaymentDocumentType;
      document_no: string | null;
      bank_name: string | null;
      branch_name: string | null;
      due_date: string | null;
    },
  ) => Promise<void> | void;
};

type FormState = {
  party_id: string;
  account_type: AccountType;
  transaction_type: FinancialTransactionType;
  amount: string;
  currency: string;
  transaction_date: string;
  due_date: string;
  payment_method: PaymentMethod | "";
  reference_no: string;
  description: string;
  status: TransactionStatus;
  document_no: string;
  bank_name: string;
  branch_name: string;
};

function defaultState(initialPartyId?: string | null): FormState {
  return {
    party_id: initialPartyId || "",
    account_type: "official",
    transaction_type: "debit",
    amount: "",
    currency: "TRY",
    transaction_date: new Date().toISOString().slice(0, 10),
    due_date: "",
    payment_method: "",
    reference_no: "",
    description: "",
    status: "completed",
    document_no: "",
    bank_name: "",
    branch_name: "",
  };
}

function directionFor(type: FinancialTransactionType): FinancialDirection {
  if (type === "payment_out" || type === "refund") return "out";
  return "in";
}

export function FinanceTransactionForm({ parties, initialPartyId, loading = false, onSubmit }: FinanceTransactionFormProps) {
  const [state, setState] = useState<FormState>(() => defaultState(initialPartyId));
  const [errors, setErrors] = useState<string[]>([]);

  useEffect(() => {
    if (initialPartyId) setState((prev) => ({ ...prev, party_id: initialPartyId }));
  }, [initialPartyId]);

  const selectedParty = useMemo(() => parties.find((party) => party.id === state.party_id), [parties, state.party_id]);
  const needsPaymentMethod = state.transaction_type === "payment_in" || state.transaction_type === "payment_out";
  const needsDocument = state.payment_method === "cheque" || state.payment_method === "promissory_note";

  const update = (key: keyof FormState, value: string) => {
    setState((prev) => ({ ...prev, [key]: value }));
  };

  const validate = () => {
    const nextErrors: string[] = [];
    if (!state.party_id) nextErrors.push("Kişi/Firma seçimi zorunludur.");
    if (!state.account_type) nextErrors.push("Hesap tipi zorunludur.");
    if (!state.transaction_type) nextErrors.push("İşlem tipi zorunludur.");
    if (!state.amount || Number(state.amount) <= 0) nextErrors.push("Tutar 0'dan büyük olmalıdır.");
    if (!state.transaction_date) nextErrors.push("İşlem tarihi zorunludur.");
    if (needsPaymentMethod && !state.payment_method) nextErrors.push("Tahsilat ve ödeme işlemlerinde ödeme yöntemi zorunludur.");
    if (needsDocument && !state.document_no.trim()) nextErrors.push("Çek/Senet için belge numarası zorunludur.");
    if (needsDocument && !state.due_date) nextErrors.push("Çek/Senet için vade tarihi zorunludur.");
    return nextErrors;
  };

  const handleSubmit = async (event: FormEvent) => {
    event.preventDefault();
    const nextErrors = validate();
    setErrors(nextErrors);
    if (nextErrors.length || !selectedParty) return;

    const partyType = selectedParty.party_type === "supplier" ? "supplier" : "customer";
    const payload: FinancialTransactionPayload = {
      party_id: state.party_id,
      party_type: partyType,
      account_type: state.account_type,
      transaction_type: state.transaction_type,
      direction: directionFor(state.transaction_type),
      amount: Number(state.amount),
      currency: state.currency || selectedParty.currency || "TRY",
      transaction_date: state.transaction_date,
      due_date: state.due_date || null,
      payment_method: state.payment_method || null,
      reference_no: state.reference_no || null,
      description: state.description || null,
      status: state.status,
    };

    await onSubmit(
      payload,
      needsDocument
        ? {
            document_type: state.payment_method === "promissory_note" ? "promissory_note" : "cheque",
            document_no: state.document_no || null,
            bank_name: state.bank_name || null,
            branch_name: state.branch_name || null,
            due_date: state.due_date || null,
          }
        : undefined,
    );
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
          <CardTitle>Finans Hareketi</CardTitle>
        </CardHeader>
        <CardContent className="grid gap-4 md:grid-cols-2">
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="party_id">Kişi/Firma Seçimi *</Label>
            <select
              id="party_id"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={state.party_id}
              onChange={(event) => {
                const party = parties.find((item) => item.id === event.target.value);
                setState((prev) => ({
                  ...prev,
                  party_id: event.target.value,
                  account_type: party?.default_account_type || prev.account_type,
                  currency: party?.currency || prev.currency,
                }));
              }}
            >
              <option value="">Müşteri veya tedarikçi seçin</option>
              {parties.map((party) => (
                <option key={party.id} value={party.id}>
                  {party.title} · {party.party_type === "supplier" ? "Tedarikçi" : party.party_type === "both" ? "Müşteri/Tedarikçi" : "Müşteri"}
                </option>
              ))}
            </select>
          </div>

          <div className="space-y-2">
            <Label>Müşteri/Tedarikçi Tipi</Label>
            <Input value={selectedParty?.party_type === "supplier" ? "Tedarikçi" : selectedParty?.party_type === "both" ? "Müşteri/Tedarikçi" : "Müşteri"} readOnly />
          </div>
          <div className="space-y-2">
            <Label>Hesap Tipi *</Label>
            <AccountTypeSelector value={state.account_type} onChange={(value) => update("account_type", value)} />
          </div>

          <div className="space-y-2">
            <Label htmlFor="transaction_type">İşlem Tipi *</Label>
            <select
              id="transaction_type"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={state.transaction_type}
              onChange={(event) => update("transaction_type", event.target.value)}
            >
              <option value="debit">Borçlandır</option>
              <option value="credit">Alacaklandır</option>
              <option value="payment_in">Tahsilat</option>
              <option value="payment_out">Ödeme</option>
              <option value="refund">İade</option>
              <option value="adjustment">Düzeltme</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="amount">Tutar *</Label>
            <Input id="amount" type="number" min="0.01" step="0.01" value={state.amount} onChange={(event) => update("amount", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="currency">Para Birimi</Label>
            <Input id="currency" value={state.currency} onChange={(event) => update("currency", event.target.value.toUpperCase())} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="transaction_date">İşlem Tarihi *</Label>
            <Input id="transaction_date" type="date" value={state.transaction_date} onChange={(event) => update("transaction_date", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="due_date">Vade Tarihi</Label>
            <Input id="due_date" type="date" value={state.due_date} onChange={(event) => update("due_date", event.target.value)} />
          </div>
          <div className="space-y-2">
            <Label htmlFor="payment_method">Ödeme Yöntemi</Label>
            <select
              id="payment_method"
              className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm"
              value={state.payment_method}
              onChange={(event) => update("payment_method", event.target.value)}
            >
              <option value="">Seçiniz</option>
              <option value="cash">Nakit</option>
              <option value="bank_transfer">Banka Havalesi/EFT</option>
              <option value="credit_card">Kredi Kartı</option>
              <option value="cheque">Çek</option>
              <option value="promissory_note">Senet</option>
              <option value="other">Diğer</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="status">Durum</Label>
            <select id="status" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm" value={state.status} onChange={(event) => update("status", event.target.value)}>
              <option value="planned">Planlandı</option>
              <option value="pending">Bekliyor</option>
              <option value="completed">Tamamlandı</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label>İlgili Sipariş</Label>
            <Input value="Sipariş bağlantısı yakında aktif olacak" readOnly />
          </div>
          <div className="space-y-2">
            <Label>İlgili Teklif</Label>
            <Input value="Teklif bağlantısı yakında aktif olacak" readOnly />
          </div>
          <div className="space-y-2">
            <Label htmlFor="reference_no">Referans No</Label>
            <Input id="reference_no" value={state.reference_no} onChange={(event) => update("reference_no", event.target.value)} />
          </div>
          <div className="space-y-2 md:col-span-2">
            <Label htmlFor="description">Açıklama</Label>
            <Textarea id="description" value={state.description} onChange={(event) => update("description", event.target.value)} />
          </div>
        </CardContent>
      </Card>

      {needsDocument ? (
        <Card>
          <CardHeader>
            <CardTitle>{state.payment_method === "promissory_note" ? "Senet Bilgileri" : "Çek Bilgileri"}</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 md:grid-cols-3">
            <div className="space-y-2">
              <Label htmlFor="document_no">Belge No *</Label>
              <Input id="document_no" value={state.document_no} onChange={(event) => update("document_no", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="bank_name">Banka</Label>
              <Input id="bank_name" value={state.bank_name} onChange={(event) => update("bank_name", event.target.value)} />
            </div>
            <div className="space-y-2">
              <Label htmlFor="branch_name">Şube</Label>
              <Input id="branch_name" value={state.branch_name} onChange={(event) => update("branch_name", event.target.value)} />
            </div>
          </CardContent>
        </Card>
      ) : null}

      <div className="flex justify-end">
        <Button type="submit" disabled={loading} className="gap-2">
          <Save className="h-4 w-4" />
          {loading ? "Kaydediliyor..." : "Hareketi Kaydet"}
        </Button>
      </div>
    </form>
  );
}
