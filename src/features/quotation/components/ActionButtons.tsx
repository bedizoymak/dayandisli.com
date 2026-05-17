import { Button } from "@/components/ui/button";
import { FileDown, Loader2, Mail, MessageCircle } from "lucide-react";

interface ActionButtonsProps {
  isGenerating: boolean;
  isSendingEmail: boolean;
  isSendingWhatsApp: boolean;
  onGeneratePDF: () => void;
  onEmailPreview: () => void;
  onWhatsAppPreview: () => void;
  hasRequiredFields: boolean;
}

export function ActionButtons({
  isGenerating,
  isSendingEmail,
  isSendingWhatsApp,
  onGeneratePDF,
  onEmailPreview,
  onWhatsAppPreview,
  hasRequiredFields,
}: ActionButtonsProps) {
  return (
    <div className="flex flex-col sm:flex-row justify-center gap-4">
      <Button 
        size="lg" 
        onClick={onGeneratePDF}
        disabled={isGenerating}
        className="bg-blue-600 hover:bg-blue-700 text-white px-8 h-14 text-base shadow-lg shadow-blue-600/25"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Oluşturuluyor...
          </>
        ) : (
          <>
            <FileDown className="w-5 h-5 mr-2" />
            PDF İndir
          </>
        )}
      </Button>
      
      <Button 
        size="lg" 
        onClick={onEmailPreview}
        disabled={isGenerating}
        className="bg-emerald-600 hover:bg-emerald-700 text-white px-8 h-14 text-base shadow-lg shadow-emerald-600/25"
      >
        {isGenerating ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Hazırlanıyor...
          </>
        ) : (
          <>
            <Mail className="w-5 h-5 mr-2" />
            Mail Gönder
          </>
        )}
      </Button>

      <Button 
        size="lg" 
        onClick={onWhatsAppPreview}
        disabled={isGenerating || isSendingWhatsApp || !hasRequiredFields}
        className="bg-green-500 hover:bg-green-600 text-white px-8 h-14 text-base shadow-lg shadow-green-500/25"
      >
        {isSendingWhatsApp ? (
          <>
            <Loader2 className="w-5 h-5 mr-2 animate-spin" />
            Açılıyor...
          </>
        ) : (
          <>
            <MessageCircle className="w-5 h-5 mr-2" />
            WhatsApp ile Gönder
          </>
        )}
      </Button>
    </div>
  );
}

