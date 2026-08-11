import { useId, useState, type ReactNode } from "react";
import {
  Dialog,
  DialogContent,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { cashAccounts } from "./cashReportData";
import "./party-ledger-entry-dialog.css";

export type LedgerEntryKind = "collection" | "payment";

const kindCopy: Record<
  LedgerEntryKind,
  { title: string; amountLabel: string }
> = {
  collection: {
    title: "Tahsilat Ekle",
    amountLabel: "Tahsilat Tutarı",
  },
  payment: {
    title: "Ödeme Ekle",
    amountLabel: "Ödeme Tutarı",
  },
};

export function PartyLedgerEntryDialog({
  kind,
  partyLabel,
  partyName,
  trigger,
}: {
  kind: LedgerEntryKind;
  partyLabel: string;
  partyName: string;
  trigger?: ReactNode;
}) {
  const copy = kindCopy[kind];
  const [open, setOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const formId = useId();

  const reset = () => {
    setError(null);
  };

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) reset();
      }}
    >
      <DialogTrigger asChild>
        {trigger ?? (
          <button type="button" className="ledger-trigger">
            {copy.title}
          </button>
        )}
      </DialogTrigger>
      <DialogContent className="ledger-dialog">
        <DialogHeader>
          <DialogTitle>{copy.title}</DialogTitle>
        </DialogHeader>
        <form
            id={formId}
            className="ledger-form"
            onSubmit={(event) => {
              event.preventDefault();
              const data = new FormData(event.currentTarget);
              const amount = String(data.get("amount") ?? "").trim();
              const date = String(data.get("date") ?? "").trim();
              const account = String(data.get("account") ?? "").trim();
              if (!amount || Number(amount) <= 0) {
                setError("Lütfen geçerli bir tutar girin.");
                return;
              }
              if (!date) {
                setError("Lütfen bir tarih seçin.");
                return;
              }
              if (!account) {
                setError("Lütfen bir hesap seçin.");
                return;
              }
              setError(null);
            }}
          >
            <label className="ledger-static">
              {partyLabel}
              <input readOnly value={partyName} />
            </label>
            <label>
              Tarih
              <input type="date" name="date" required />
            </label>
            <label>
              Hesap
              <select name="account" required defaultValue="">
                <option value="" disabled>
                  —
                </option>
                {cashAccounts.map((account) => (
                  <option key={account.name} value={account.name}>
                    {account.name}
                  </option>
                ))}
              </select>
            </label>
            <div className="ledger-fields two">
              <label>
                {copy.amountLabel}
                <input type="number" name="amount" min="0" step="0.01" required />
              </label>
              <label>
                Para Birimi
                <select name="currency" defaultValue="">
                  <option value="">—</option>
                  <option>TRY</option>
                  <option>USD</option>
                  <option>EUR</option>
                </select>
              </label>
            </div>
            <label>
              Ödeme Yöntemi
              <select name="method" defaultValue="">
                <option value="">—</option>
                <option>Havale/EFT</option>
                <option>Nakit</option>
                <option>Çek</option>
                <option>Kredi Kartı</option>
              </select>
            </label>
            <label>
              Açıklama / Referans
              <textarea name="description" rows={2} />
            </label>
            {error && <p className="ledger-error">{error}</p>}
            <DialogFooter className="ledger-actions">
              <button
                type="button"
                className="ledger-secondary"
                onClick={() => setOpen(false)}
              >
                Vazgeç
              </button>
              <button type="submit" className="ledger-primary">
                Kaydet
              </button>
            </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
