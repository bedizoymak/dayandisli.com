import { FormEvent, useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { FinanceBackLink, FinanceBreadcrumb } from "../FinanceNavigationTools";
import { CheckPartyPicker } from "./CheckPartyPicker";
import { createCheck, getCheckDetail, updateCheck } from "./checksApi";
import type {
  CheckCurrency,
  CheckDirection,
  CheckPartyOption,
  CheckWriteInput,
} from "./types";
import "./checks.css";

const checksBase = "/apps/finance/cash/checks";

type FormState = {
  direction: CheckDirection;
  partyId: string;
  partyName: string;
  bankName: string;
  checkNumber: string;
  issueDate: string;
  dueDate: string;
  currency: CheckCurrency;
  originalAmount: string;
  notes: string;
  settlementStatus: "open" | "paid";
};

const EMPTY_FORM: FormState = {
  direction: "received",
  partyId: "",
  partyName: "",
  bankName: "",
  checkNumber: "",
  issueDate: "",
  dueDate: "",
  currency: "TRY",
  originalAmount: "",
  notes: "",
  settlementStatus: "open",
};

export function CheckFormPage({ checkId }: { checkId?: string }) {
  const editing = Boolean(checkId);
  const navigate = useNavigate();
  const [form, setForm] = useState<FormState>(EMPTY_FORM);
  const [loading, setLoading] = useState(editing);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [formAvailable, setFormAvailable] = useState(!editing);

  useEffect(() => {
    if (!checkId) return;
    let cancelled = false;
    setLoading(true);
    getCheckDetail(checkId).then((result) => {
      if (cancelled) return;
      if (result.ok === false) {
        setError(result.message);
      } else if (result.data.record.source !== "erp") {
        setError("Paraşüt çeklerinin finansal alanları düzenlenemez.");
      } else if (!result.data.record.editable) {
        setError("Bu çekin finansal alanları düzenlenemez.");
      } else if (
        !result.data.record.direction
        || !result.data.record.currency
        || result.data.record.originalAmount === null
      ) {
        setError("Çek kaydındaki zorunlu alanlar eksik olduğu için düzenleme açılamadı.");
      } else {
        const row = result.data.record;
        setForm({
          direction: row.direction,
          partyId: row.party.parasutId ?? "",
          partyName: row.party.assigned ? row.party.name ?? "" : "",
          bankName: row.bankName ?? "",
          checkNumber: row.checkNumber ?? "",
          issueDate: row.issueDate ?? "",
          dueDate: row.dueDate ?? "",
          currency: row.currency,
          originalAmount: String(row.originalAmount),
          notes: row.notes ?? "",
          settlementStatus: row.effectiveStatus === "paid" ? "paid" : "open",
        });
        setFormAvailable(true);
      }
      setLoading(false);
    });
    return () => {
      cancelled = true;
    };
  }, [checkId]);

  const selectParty = (party: CheckPartyOption) => {
    setForm((current) => ({ ...current, partyId: party.parasutId, partyName: party.name }));
  };

  const clearParty = () => setForm((current) => ({ ...current, partyId: "", partyName: "" }));

  const submit = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const amount = Number(form.originalAmount);
    if (!form.dueDate) return setError("Vade tarihi zorunludur.");
    if (!Number.isFinite(amount) || amount <= 0) return setError("Tutar sıfırdan büyük olmalıdır.");

    const input: CheckWriteInput = {
      direction: form.direction,
      ...(editing
        ? { contactParasutId: form.partyId || null, contactSnapshotName: form.partyName || null }
        : form.partyId
          ? { contactParasutId: form.partyId, contactSnapshotName: form.partyName }
          : {}),
      bankName: form.bankName.trim() || undefined,
      checkNumber: form.checkNumber.trim() || undefined,
      issueDate: form.issueDate || undefined,
      dueDate: form.dueDate,
      currency: form.currency,
      originalAmount: amount,
      notes: form.notes.trim() || undefined,
      ...(!editing ? { settlementStatus: form.settlementStatus } : {}),
    };

    setSaving(true);
    setError(null);
    const result = editing && checkId ? await updateCheck(checkId, input) : await createCheck(input);
    if (result.ok === false) {
      setError(result.message);
      setSaving(false);
      return;
    }
    navigate(`${checksBase}/${encodeURIComponent(result.data.id)}`);
  };

  if (loading) return <div className="checks-page"><div className="checks-state" role="status">Çek kaydı yükleniyor…</div></div>;

  if (editing && !formAvailable) {
    return (
      <div className="checks-page">
        <FinanceBreadcrumb value="Muhasebe ve Finans / Kasa / Çekler / Çeki Düzenle" />
        <h1>Çek Düzenlenemiyor</h1>
        <FinanceBackLink to={checkId ? `${checksBase}/${encodeURIComponent(checkId)}` : checksBase}>Detaya Dön</FinanceBackLink>
        <div className="checks-error" role="alert">{error ?? "Bu çek düzenlenemez."}</div>
      </div>
    );
  }

  return (
    <div className="checks-page checks-form-page">
      <header className="checks-page-head">
        <div>
          <FinanceBreadcrumb value={`Muhasebe ve Finans / Kasa / Çekler / ${editing ? "Çeki Düzenle" : "Yeni ERP Çeki"}`} />
          <h1>{editing ? "Çeki Düzenle" : "Yeni ERP Çeki"}</h1>
          <p>Bu form yalnız ERP yerel kaydını yönetir; Paraşüt'e yazmaz.</p>
        </div>
      </header>
      <FinanceBackLink to={editing && checkId ? `${checksBase}/${encodeURIComponent(checkId)}` : checksBase}>
        {editing ? "Çek Detayına Dön" : "Çeklere Dön"}
      </FinanceBackLink>

      {error && <div className="checks-error" role="alert">{error}</div>}

      <form className="erp-card checks-form" onSubmit={submit}>
        <section>
          <h2>Çek Bilgileri</h2>
          <div className="checks-form-grid">
            <label>
              Yön *
              <select
                value={form.direction}
                onChange={(event) => setForm((current) => ({
                  ...current,
                  direction: event.target.value as CheckDirection,
                  partyId: "",
                  partyName: "",
                }))}
              >
                <option value="received">Alınan Çek</option>
                <option value="issued">Verilen Çek</option>
              </select>
            </label>
            <label>
              Banka
              <input value={form.bankName} onChange={(event) => setForm((current) => ({ ...current, bankName: event.target.value }))} />
            </label>
            <label>
              Çek No
              <input value={form.checkNumber} onChange={(event) => setForm((current) => ({ ...current, checkNumber: event.target.value }))} />
            </label>
            <label>
              Düzenleme Tarihi
              <input type="date" value={form.issueDate} onChange={(event) => setForm((current) => ({ ...current, issueDate: event.target.value }))} />
            </label>
            <label>
              Vade Tarihi *
              <input type="date" value={form.dueDate} onChange={(event) => setForm((current) => ({ ...current, dueDate: event.target.value }))} />
            </label>
            <label>
              Para Birimi *
              <select value={form.currency} onChange={(event) => setForm((current) => ({ ...current, currency: event.target.value as CheckCurrency }))}>
                <option value="TRY">TRY</option>
                <option value="USD">USD</option>
                <option value="EUR">EUR</option>
              </select>
            </label>
            <label>
              Tutar *
              <input min="0.01" step="0.01" type="number" value={form.originalAmount} onChange={(event) => setForm((current) => ({ ...current, originalAmount: event.target.value }))} />
            </label>
            {!editing && (
              <label>
                Başlangıç Durumu *
                <select value={form.settlementStatus} onChange={(event) => setForm((current) => ({ ...current, settlementStatus: event.target.value as FormState["settlementStatus"] }))}>
                  <option value="open">Açık</option>
                  <option value="paid">Ödendi</option>
                </select>
              </label>
            )}
          </div>
        </section>

        <section>
          <h2>Gerçek Taraf</h2>
          <CheckPartyPicker
            direction={form.direction}
            selectedId={form.partyId}
            selectedName={form.partyName}
            onSelect={selectParty}
            onClear={clearParty}
          />
        </section>

        <section>
          <h2>Notlar</h2>
          <label>
            Açıklama
            <textarea value={form.notes} onChange={(event) => setForm((current) => ({ ...current, notes: event.target.value }))} />
          </label>
        </section>

        <footer>
          <button type="button" onClick={() => navigate(editing && checkId ? `${checksBase}/${encodeURIComponent(checkId)}` : checksBase)}>Vazgeç</button>
          <button type="submit" className="primary" disabled={saving}>{saving ? "Kaydediliyor…" : "Kaydet"}</button>
        </footer>
      </form>
    </div>
  );
}
