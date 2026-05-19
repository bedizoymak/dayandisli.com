import { ACCOUNT_TYPE_LABELS } from "@/lib/finance/financeLabels";
import type { AccountType } from "@/lib/finance/financeTypes";
import { cn } from "@/lib/utils";

type AccountTypeSelectorProps = {
  value: AccountType;
  onChange: (value: AccountType) => void;
};

export function AccountTypeSelector({ value, onChange }: AccountTypeSelectorProps) {
  return (
    <div className="grid grid-cols-2 gap-2 rounded-lg border bg-muted/30 p-1">
      {(["official", "operational"] as AccountType[]).map((accountType) => (
        <button
          key={accountType}
          type="button"
          className={cn(
            "rounded-md px-3 py-2 text-sm font-medium transition",
            value === accountType ? "bg-background text-foreground shadow-sm" : "text-muted-foreground hover:text-foreground",
          )}
          onClick={() => onChange(accountType)}
        >
          {ACCOUNT_TYPE_LABELS[accountType]}
        </button>
      ))}
    </div>
  );
}
