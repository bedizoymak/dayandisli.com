import { LayoutGrid, Table2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/utils";

export type ViewMode = "table" | "card";

type ViewToggleProps = {
  value: ViewMode;
  onChange: (value: ViewMode) => void;
};

export function ViewToggle({ value, onChange }: ViewToggleProps) {
  return (
    <div className="inline-flex rounded-md border bg-background p-1">
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={cn("h-8 gap-2 px-3", value === "table" && "bg-muted text-foreground")}
        onClick={() => onChange("table")}
      >
        <Table2 className="h-4 w-4" />
        Tablo
      </Button>
      <Button
        type="button"
        size="sm"
        variant="ghost"
        className={cn("h-8 gap-2 px-3", value === "card" && "bg-muted text-foreground")}
        onClick={() => onChange("card")}
      >
        <LayoutGrid className="h-4 w-4" />
        Kart
      </Button>
    </div>
  );
}
