import { Link } from "react-router-dom";
import { Calculator, FilePlus2, Package, Plus, ReceiptText, ShoppingCart, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";

const actions = [
  { label: "Yeni Teklif", path: "/erp/teklifler/yeni", icon: FilePlus2 },
  { label: "Yeni Müşteri", path: "/erp/musteriler/yeni", icon: Users },
  { label: "Finans Hareketi", path: "/erp/finans/hareketler/yeni", icon: ReceiptText },
  { label: "Calculator", path: "/erp/calculator", icon: Calculator },
  { label: "Siparişler", path: "/erp/siparisler", icon: ShoppingCart },
  { label: "Kargo", path: "/erp/kargo", icon: Package },
];

export function QuickActionMenu() {
  return (
    <DropdownMenu>
      <DropdownMenuTrigger asChild>
        <Button size="sm" className="gap-2">
          <Plus className="h-4 w-4" />
          <span className="hidden sm:inline">Yeni</span>
        </Button>
      </DropdownMenuTrigger>
      <DropdownMenuContent align="end" className="w-56">
        <DropdownMenuLabel>Hızlı İşlem</DropdownMenuLabel>
        <DropdownMenuSeparator />
        {actions.map((action) => (
          <DropdownMenuItem key={action.path} asChild>
            <Link to={action.path} className="flex items-center gap-2">
              <action.icon className="h-4 w-4" />
              {action.label}
            </Link>
          </DropdownMenuItem>
        ))}
      </DropdownMenuContent>
    </DropdownMenu>
  );
}
