import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { MessageCircle, Loader2, X } from "lucide-react";

interface WhatsAppPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTeklifNo: string;
  firma: string;
  ilgiliKisi: string;
  total: number;
  activeCurrency: string;
  isSending: boolean;
  onShare: () => void;
  formatCurrency: (amount: number, currency?: string) => string;
  formatName: (name: string) => string;
}

export function WhatsAppPreviewModal({
  open,
  onOpenChange,
  currentTeklifNo,
  firma,
  ilgiliKisi,
  total,
  activeCurrency,
  isSending,
  onShare,
  formatCurrency,
  formatName,
}: WhatsAppPreviewModalProps) {
  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-md bg-slate-800 border-slate-700">
        <DialogHeader>
          <DialogTitle className="flex items-center gap-2 text-white">
            <MessageCircle className="w-5 h-5 text-green-400" />
            WhatsApp Paylaşım - {currentTeklifNo}
          </DialogTitle>
        </DialogHeader>
        
        <div className="space-y-4 py-4">
          <div className="bg-slate-900/50 p-4 rounded-lg border border-slate-700">
            <div className="space-y-3 text-sm">
              <div className="flex justify-between">
                <span className="text-slate-400">Teklif No:</span>
                <span className="text-white font-mono">{currentTeklifNo}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Firma:</span>
                <span className="text-white">{firma}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">İlgili:</span>
                <span className="text-white">{formatName(ilgiliKisi)}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-slate-400">Toplam:</span>
                <span className="text-emerald-400 font-bold">{formatCurrency(total, activeCurrency)}</span>
              </div>
            </div>
          </div>

          <div className="bg-green-900/20 border border-green-700/30 rounded-lg p-3">
            <p className="text-xs text-green-300 mb-2">Gönderilecek Mesaj:</p>
            <p className="text-sm text-slate-300 italic">
              "Merhaba, fiyat teklifleri ekte yer almaktadır:"
            </p>
          </div>
        </div>
        
        <DialogFooter className="gap-2">
          <Button 
            variant="outline" 
            onClick={() => onOpenChange(false)}
            disabled={isSending}
            className="border-slate-600 text-slate-300 hover:bg-slate-700"
          >
            <X className="w-4 h-4 mr-2" />
            İptal
          </Button>
          <Button 
            onClick={onShare}
            disabled={isSending}
            className="bg-green-500 hover:bg-green-600 text-white"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Paylaşılıyor...
              </>
            ) : (
              <>
                <MessageCircle className="w-4 h-4 mr-2" />
                WhatsApp ile Gönder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

