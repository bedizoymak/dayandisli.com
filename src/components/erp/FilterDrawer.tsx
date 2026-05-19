import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import {
  Sheet,
  SheetContent,
  SheetDescription,
  SheetFooter,
  SheetHeader,
  SheetTitle,
  SheetTrigger,
} from "@/components/ui/sheet";
import { SlidersHorizontal } from "lucide-react";

type FilterDrawerProps = {
  triggerLabel?: string;
};

export function FilterDrawer({ triggerLabel = "Filtreler" }: FilterDrawerProps) {
  return (
    <Sheet>
      <SheetTrigger asChild>
        <Button variant="outline" size="sm" className="gap-2">
          <SlidersHorizontal className="h-4 w-4" />
          {triggerLabel}
        </Button>
      </SheetTrigger>
      <SheetContent className="w-full overflow-y-auto sm:max-w-md">
        <SheetHeader>
          <SheetTitle>Filtreler</SheetTitle>
          <SheetDescription>Bu panel ileride Supabase sorgularına bağlanacak şekilde hazırlandı.</SheetDescription>
        </SheetHeader>
        <div className="mt-6 space-y-5">
          <div className="space-y-2">
            <Label htmlFor="filter-status">Durum</Label>
            <select id="filter-status" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Tüm durumlar</option>
              <option value="active">Aktif</option>
              <option value="waiting">Bekliyor</option>
              <option value="done">Tamamlandı</option>
              <option value="cancelled">İptal</option>
            </select>
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-date">Tarih</Label>
            <Input id="filter-date" type="date" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-customer">Müşteri</Label>
            <Input id="filter-customer" placeholder="Firma veya ilgili kişi" />
          </div>
          <div className="space-y-2">
            <Label htmlFor="filter-priority">Öncelik</Label>
            <select id="filter-priority" className="h-10 w-full rounded-md border border-input bg-background px-3 text-sm">
              <option value="">Tüm öncelikler</option>
              <option value="low">Düşük</option>
              <option value="normal">Normal</option>
              <option value="high">Yüksek</option>
              <option value="urgent">Acil</option>
            </select>
          </div>
        </div>
        <SheetFooter className="mt-8">
          <Button variant="outline" type="button">
            Temizle
          </Button>
          <Button type="button" disabled>
            Uygula - Yakında
          </Button>
        </SheetFooter>
      </SheetContent>
    </Sheet>
  );
}
