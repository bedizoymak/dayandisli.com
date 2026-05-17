import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Users, Loader2 } from "lucide-react";
import { CustomerProfile } from "../types";

interface CustomerSelectionModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  customers: CustomerProfile[];
  loading: boolean;
  searchTerm: string;
  onSearchChange: (term: string) => void;
  onSelectCustomer: (customer: CustomerProfile) => void;
  onLoadCustomers: () => void;
}

export function CustomerSelectionModal({
  open,
  onOpenChange,
  customers,
  loading,
  searchTerm,
  onSearchChange,
  onSelectCustomer,
  onLoadCustomers,
}: CustomerSelectionModalProps) {
  const filteredCustomers = customers.filter(c =>
    (c.firma?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (c.ilgili_kisi?.toLowerCase() || "").includes(searchTerm.toLowerCase()) ||
    (c.email?.toLowerCase() || "").includes(searchTerm.toLowerCase())
  );

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <Users className="w-5 h-5 text-blue-400" />
            Müşteri Seç
          </DialogTitle>
        </DialogHeader>
        
        <div className="py-4">
          {/* Search Box */}
          <div className="mb-3">
            <Input
              placeholder="Ara: firma, kişi veya e-posta..."
              value={searchTerm}
              onChange={(e) => onSearchChange(e.target.value)}
              className="bg-slate-900 border-slate-600 text-white placeholder:text-slate-500 focus:border-blue-500"
            />
          </div>

          {loading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 animate-spin text-blue-400" />
              <span className="ml-2 text-slate-400">Yükleniyor...</span>
            </div>
          ) : filteredCustomers.length === 0 ? (
            <div className="text-center py-8 text-slate-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>Kayıtlı müşteri bulunamadı.</p>
            </div>
          ) : (
            <div className="space-y-2 max-h-[400px] overflow-y-auto">
              {filteredCustomers.map((customer) => (
                <button
                  key={customer.id}
                  onClick={() => onSelectCustomer(customer)}
                  className="w-full p-3 text-left bg-slate-900/50 hover:bg-slate-700/50 border border-slate-700 rounded-lg transition-colors"
                >
                  <p className="text-white font-medium">{customer.firma}</p>
                  <p className="text-sm text-slate-400">{customer.ilgili_kisi} • {customer.email}</p>
                </button>
              ))}
            </div>
          )}
        </div>
        
        <DialogFooter>
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            Kapat
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

