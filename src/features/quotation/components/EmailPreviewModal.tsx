import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";
import { Mail, Loader2, Send, X, Download } from "lucide-react";

interface EmailPreviewModalProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  currentTeklifNo: string;
  email: string;
  firma: string;
  ilgiliKisi: string;
  pdfPreviewUrl: string;
  total: number;
  activeCurrency: string;
  isSending: boolean;
  onSend: () => void;
  formatCurrency: (amount: number, currency?: string) => string;
  formatName: (name: string) => string;
}

export function EmailPreviewModal({
  open,
  onOpenChange,
  currentTeklifNo,
  email,
  firma,
  ilgiliKisi,
  pdfPreviewUrl,
  total,
  activeCurrency,
  isSending,
  onSend,
  formatCurrency,
  formatName,
}: EmailPreviewModalProps) {
  const handleDownload = () => {
    if (!pdfPreviewUrl) return;
    const link = document.createElement("a");
    link.href = pdfPreviewUrl;
    link.download = `${currentTeklifNo}.pdf`;
    link.click();
  };

  return (
    <>
      <style>{`
        iframe[title*=".pdf"] ~ * .toolbarButton#download,
        iframe[title*=".pdf"] ~ * #download,
        .toolbarButton#download {
          display: none !important;
        }
      `}</style>
      <Dialog open={open} onOpenChange={onOpenChange}>
        <DialogContent className="max-w-2xl max-h-[90vh] overflow-hidden flex flex-col bg-slate-800 border-slate-700">
          <DialogHeader>
            <div className="flex items-center justify-between">
              <DialogTitle className="flex items-center gap-2 text-white">
                <Mail className="w-5 h-5 text-blue-400" />
                E-posta Önizleme - {currentTeklifNo}
              </DialogTitle>
              <Button
                variant="outline"
                onClick={handleDownload}
                disabled={!pdfPreviewUrl}
                className="border-slate-600 text-slate-300 hover:bg-slate-700 h-8 px-3"
              >
                <Download className="w-4 h-4 mr-2" />
                İndir
              </Button>
            </div>
          </DialogHeader>

          {pdfPreviewUrl && (
            <div className="border border-slate-600 rounded-lg overflow-hidden relative">
              <style>{`
                iframe[title="${currentTeklifNo}.pdf"] + * .toolbarButton#download,
                iframe[title="${currentTeklifNo}.pdf"] ~ * .toolbarButton#download,
                iframe[title="${currentTeklifNo}.pdf"] ~ * #download {
                  display: none !important;
                }
              `}</style>
              <iframe
  src={`${pdfPreviewUrl}#zoom=page-width&view=FitH&filename=${encodeURIComponent(currentTeklifNo)}.pdf`}
  className="w-full h-[800px] bg-white"
  title={`${currentTeklifNo}.pdf`}
/>

            </div>
          )}
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
            onClick={onSend}
            disabled={isSending}
            className="bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            {isSending ? (
              <>
                <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                Gönderiliyor...
              </>
            ) : (
              <>
                <Send className="w-4 h-4 mr-2" />
                Gönder
              </>
            )}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
    </>
  );
}
//test

