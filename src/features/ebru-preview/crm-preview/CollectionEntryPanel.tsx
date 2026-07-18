import { useEffect, useState, type FormEvent, type ReactNode } from "react";
import {
  addCollectionTransaction,
  updateCollectionTransaction,
} from "../shared/collectionTransactions";
import {
  accountLabel,
  collectionDestinations,
  formatTry,
} from "../shared/collectionSelectors";
import type {
  CollectionMethod,
  CollectionTransaction,
  CustomerAccountType,
  NewCollectionTransaction,
} from "../shared/collectionTypes";

type Errors = Partial<
  Record<
    "date" | "amount" | "destination" | "chequeNumber" | "chequeDue",
    string
  >
>;

const today = new Intl.DateTimeFormat("en-CA", {
  timeZone: "Europe/Istanbul",
}).format(new Date());

function parseAmount(value: string) {
  const normalized = value
    .replace(/[^\d,.-]/g, "")
    .replace(/\./g, "")
    .replace(",", ".");
  return Number(normalized);
}

export function CollectionEntryPanel({
  customerId,
  customerName,
  actor,
  activeAccount,
  activeSummary,
  editingTransaction,
  onEditComplete,
  onSaved,
}: {
  customerId: string;
  customerName: string;
  actor: string;
  activeAccount: CustomerAccountType;
  activeSummary: { overdue: string; collected: string };
  editingTransaction?: CollectionTransaction;
  onEditComplete: () => void;
  onSaved: (transaction: CollectionTransaction) => void;
}) {
  const [method, setMethod] = useState<CollectionMethod>("cash");
  const [accountType, setAccountType] =
    useState<CustomerAccountType>(activeAccount);
  const [transactionDate, setTransactionDate] = useState(today);
  const [dueDate, setDueDate] = useState("");
  const [amountText, setAmountText] = useState("");
  const [description, setDescription] = useState("");
  const [destinationId, setDestinationId] = useState("cash-main");
  const [chequeNumber, setChequeNumber] = useState("");
  const [chequeDue, setChequeDue] = useState("");
  const [chequeBank, setChequeBank] = useState("");
  const [chequeBranch, setChequeBranch] = useState("");
  const [drawerName, setDrawerName] = useState(customerName);
  const [errors, setErrors] = useState<Errors>({});

  const destinations = collectionDestinations.filter(
    (destination) => destination.method === method,
  );

  useEffect(() => {
    if (!editingTransaction) return;
    setMethod(editingTransaction.method);
    setAccountType(editingTransaction.accountType);
    setTransactionDate(editingTransaction.transactionDate);
    setDueDate(
      editingTransaction.method === "cash"
        ? editingTransaction.dueDate || ""
        : "",
    );
    setAmountText(formatTry(editingTransaction.amount));
    setDescription(editingTransaction.description || "");
    setDestinationId(editingTransaction.destinationAccountId);
    setChequeNumber(editingTransaction.chequeNumber || "");
    setChequeDue(
      editingTransaction.method === "cheque"
        ? editingTransaction.dueDate || ""
        : "",
    );
    setChequeBank(editingTransaction.chequeBank || "");
    setChequeBranch(editingTransaction.chequeBranch || "");
    setDrawerName(editingTransaction.drawerName || customerName);
    setErrors({});
  }, [customerName, editingTransaction]);

  const selectMethod = (next: CollectionMethod) => {
    setMethod(next);
    setDestinationId(next === "cash" ? "cash-main" : "cheque-portfolio");
    setErrors({});
    if (next === "cash") {
      setChequeNumber("");
      setChequeDue("");
      setChequeBank("");
      setChequeBranch("");
      setDrawerName(customerName);
    }
  };

  const reset = () => {
    setMethod("cash");
    setAccountType(activeAccount);
    setTransactionDate(today);
    setDueDate("");
    setAmountText("");
    setDescription("");
    setDestinationId("cash-main");
    setChequeNumber("");
    setChequeDue("");
    setChequeBank("");
    setChequeBranch("");
    setDrawerName(customerName);
    setErrors({});
    onEditComplete();
  };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    const amount = parseAmount(amountText);
    const nextErrors: Errors = {};
    if (!transactionDate) nextErrors.date = "Tarih zorunludur.";
    if (!Number.isFinite(amount) || amount <= 0)
      nextErrors.amount = "Sıfırdan büyük bir meblağ girin.";
    if (!destinationId) nextErrors.destination = "Hedef hesap zorunludur.";
    if (method === "cheque" && !chequeNumber.trim())
      nextErrors.chequeNumber = "Çek numarası zorunludur.";
    if (method === "cheque" && !chequeDue)
      nextErrors.chequeDue = "Çek vade tarihi zorunludur.";
    setErrors(nextErrors);
    if (Object.keys(nextErrors).length) return;

    const destination = collectionDestinations.find(
      (item) => item.id === destinationId,
    );
    if (!destination) return;
    const input: NewCollectionTransaction = {
      customerId,
      accountType,
      method,
      transactionDate,
      dueDate: method === "cheque" ? chequeDue : dueDate || undefined,
      amount,
      currency: "TRY",
      description: description.trim() || undefined,
      destinationAccountId: destination.id,
      destinationAccountName: destination.name,
      chequeNumber: method === "cheque" ? chequeNumber.trim() : undefined,
      chequeBank:
        method === "cheque" ? chequeBank.trim() || undefined : undefined,
      chequeBranch:
        method === "cheque" ? chequeBranch.trim() || undefined : undefined,
      drawerName:
        method === "cheque" ? drawerName.trim() || customerName : undefined,
      relatedProjectId: undefined,
      relatedInvoiceId: undefined,
      createdBy: actor,
    };
    const transaction = editingTransaction
      ? updateCollectionTransaction(editingTransaction.id, input)
      : addCollectionTransaction(input);
    if (!transaction) return;
    onSaved(transaction);
    reset();
  };

  return (
    <article className="ebru-card collection-panel">
      <h2>{editingTransaction ? "Tahsilatı Düzenle" : "Tahsilat Ekle"}</h2>
      <form onSubmit={submit} noValidate>
        <div
          className="collection-method"
          role="radiogroup"
          aria-label="Tahsilat türü"
        >
          <button
            type="button"
            className={method === "cash" ? "active" : ""}
            onClick={() => selectMethod("cash")}
          >
            Nakit Tahsilat
          </button>
          <button
            type="button"
            className={method === "cheque" ? "active" : ""}
            onClick={() => selectMethod("cheque")}
          >
            Çek Tahsilat
          </button>
        </div>
        <div className="collection-fields two">
          <Field label="Tarih *" error={errors.date}>
            <input
              type="date"
              value={transactionDate}
              onChange={(event) => setTransactionDate(event.target.value)}
            />
          </Field>
          <Field label="Vade Tarihi">
            <input
              type="date"
              value={dueDate}
              onChange={(event) => setDueDate(event.target.value)}
            />
          </Field>
        </div>
        <Field label="Meblağ *" error={errors.amount}>
          <input
            inputMode="decimal"
            placeholder="₺0,00"
            value={amountText}
            onChange={(event) => setAmountText(event.target.value)}
            onBlur={() => {
              const amount = parseAmount(amountText);
              if (amount > 0) setAmountText(formatTry(amount));
            }}
          />
        </Field>
        <Field
          label={
            method === "cash"
              ? "Banka / Kasa Hesabı *"
              : "Banka / Kasa Hesabı veya Çek Portföyü *"
          }
          error={errors.destination}
        >
          <select
            value={destinationId}
            onChange={(event) => setDestinationId(event.target.value)}
          >
            {destinations.map((destination) => (
              <option key={destination.id} value={destination.id}>
                {destination.name}
              </option>
            ))}
          </select>
        </Field>
        <fieldset className="collection-account-selector">
          <legend>Hesap Etiketi *</legend>
          <label>
            <input
              type="radio"
              checked={accountType === "official"}
              onChange={() => setAccountType("official")}
            />{" "}
            Resmi Hesap
          </label>
          <label>
            <input
              type="radio"
              checked={accountType === "unofficial"}
              onChange={() => setAccountType("unofficial")}
            />{" "}
            Gayri Resmi Hesap
          </label>
        </fieldset>
        <p className={`collection-account-note ${accountType}`}>
          {accountType === "official"
            ? "Tahsilat, Resmi Hesap bakiyesine kaydedilecektir."
            : "Tahsilat, Gayri Resmi Hesap bakiyesine kaydedilecektir. Resmi fatura kayıtlarıyla ilişkilendirilmeyecektir."}
        </p>
        {method === "cheque" && (
          <div className="collection-cheque-fields">
            <div className="collection-fields two">
              <Field label="Çek No *" error={errors.chequeNumber}>
                <input
                  value={chequeNumber}
                  onChange={(event) => setChequeNumber(event.target.value)}
                />
              </Field>
              <Field label="Çek Vade Tarihi *" error={errors.chequeDue}>
                <input
                  type="date"
                  value={chequeDue}
                  onChange={(event) => setChequeDue(event.target.value)}
                />
              </Field>
              <Field label="Banka">
                <input
                  value={chequeBank}
                  onChange={(event) => setChequeBank(event.target.value)}
                />
              </Field>
              <Field label="Şube">
                <input
                  value={chequeBranch}
                  onChange={(event) => setChequeBranch(event.target.value)}
                />
              </Field>
            </div>
            <Field label="Keşideci">
              <input
                value={drawerName}
                onChange={(event) => setDrawerName(event.target.value)}
              />
            </Field>
          </div>
        )}
        <Field label="Açıklama">
          <textarea
            value={description}
            onChange={(event) => setDescription(event.target.value)}
            placeholder="Tahsilat açıklaması"
          />
        </Field>
        <div className="collection-actions">
          <button type="button" onClick={reset}>
            Vazgeç
          </button>
          <button type="submit">
            {editingTransaction ? "Değişiklikleri Kaydet" : "Tahsilat Ekle"}
          </button>
        </div>
      </form>
      <div className="collection-panel-summary">
        <span>{accountLabel(activeAccount)} hesap özeti</span>
        <p>
          <span>Gecikmiş Tahsilat</span>
          <strong>{activeSummary.overdue}</strong>
        </p>
        <p>
          <span>Toplam Tahsilat</span>
          <strong>{activeSummary.collected}</strong>
        </p>
        <button type="button">Ekstre Gönder</button>
      </div>
    </article>
  );
}

function Field({
  label,
  error,
  children,
}: {
  label: string;
  error?: string;
  children: ReactNode;
}) {
  return (
    <label className="collection-field">
      <span>{label}</span>
      {children}
      {error && <small>{error}</small>}
    </label>
  );
}
