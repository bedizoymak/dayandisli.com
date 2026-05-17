import { useState, useEffect } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { createQuotationPDF } from "@/features/quotation/pdf/createQuotationPDF";
import { QuotationFormData, ProductRow } from "../types";
import { formatName } from "./useQuotationForm";


export function useQuotationPDF() {
  const { toast } = useToast();
  
  // PDF generation state
  const [isGenerating, setIsGenerating] = useState(false);
  const [isSendingEmail, setIsSendingEmail] = useState(false);
  const [isSendingWhatsApp, setIsSendingWhatsApp] = useState(false);
  const [pdfPreviewUrl, setPdfPreviewUrl] = useState<string>("");
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);

  // Cleanup preview URL on unmount
  useEffect(() => {
    return () => {
      if (pdfPreviewUrl) {
        URL.revokeObjectURL(pdfPreviewUrl);
      }
    };
  }, [pdfPreviewUrl]);


  // PDF Download Handler
  const generatePDF = async (
    teklifNo: string,
    formData: QuotationFormData,
    calculateRowTotal: (row: ProductRow) => number,
    calculateSubtotal: () => number,
    calculateKDV: () => number,
    calculateTotal: () => number,
    formatCurrencyFn: (amount: number, currency?: string) => string,
    issueDate?: Date | string
  ) => {
    if (!formData.firma || !formData.ilgiliKisi) {
      toast({
        title: "Eksik Bilgi",
        description: "Lütfen firma ve ilgili kişi bilgilerini doldurun.",
        variant: "destructive"
      });
      return;
    }

    setIsGenerating(true);

    try {
      const doc = await createQuotationPDF(teklifNo, formData, calculateRowTotal, calculateSubtotal, calculateKDV, calculateTotal, formatCurrencyFn, issueDate);
      doc.save(teklifNo + ".pdf");

      toast({
        title: "PDF Oluşturuldu",
        description: `${teklifNo} başarıyla indirildi.`,
      });

    } catch (e) {
      console.error("PDF generation error:", e);
      toast({
        title: "Hata",
        description: "PDF oluşturulurken bir hata oluştu.",
        variant: "destructive"
      });
    } finally {
      setIsGenerating(false);
    }
  };

  // Create PDF Preview
  const createPDFPreview = async (
    teklifNo: string,
    formData: QuotationFormData,
    calculateRowTotal: (row: ProductRow) => number,
    calculateSubtotal: () => number,
    calculateKDV: () => number,
    calculateTotal: () => number,
    formatCurrencyFn: (amount: number, currency?: string) => string,
    issueDate?: Date | string
  ): Promise<Blob> => {
    setIsGenerating(true);

    try {
      const doc = await createQuotationPDF(teklifNo, formData, calculateRowTotal, calculateSubtotal, calculateKDV, calculateTotal, formatCurrencyFn, issueDate);
      const pdfOutput = doc.output("blob");
      
      // jsPDF's output("blob") returns a Blob, but ensure it has the correct MIME type
      const pdfBlob = pdfOutput instanceof Blob && pdfOutput.type === "application/pdf"
        ? pdfOutput 
        : new Blob([pdfOutput], { type: "application/pdf" });
      
      setPdfBlob(pdfBlob);

      const previewUrl = URL.createObjectURL(pdfBlob);
      if (pdfPreviewUrl) URL.revokeObjectURL(pdfPreviewUrl);
      setPdfPreviewUrl(previewUrl);

      return pdfBlob;
    } catch (error) {
      console.error(error);
      toast({
        title: "Hata",
        description: "Önizleme oluşturulamadı!",
        variant: "destructive",
      });
      throw error;
    } finally {
      setIsGenerating(false);
    }
  };

  // Send Email Handler
  const sendEmail = async (
    teklifNo: string,
    formData: QuotationFormData,
    pdfBlob: Blob,
    calculateRowTotal: (row: ProductRow) => number,
    calculateSubtotal: () => number,
    calculateKDV: () => number,
    calculateTotal: () => number,
    formatCurrencyFn: (amount: number, currency?: string) => string
  ) => {
    if (!pdfBlob || !teklifNo) {
      toast({
        title: "Hata",
        description: "PDF hazır değil!",
        variant: "destructive"
      });
      return;
    }

    setIsSendingEmail(true);

    try {
      // Convert blob to base64
      const reader = new FileReader();
      const base64Promise = new Promise<string>((resolve, reject) => {
        reader.onloadend = () => {
          const result = reader.result as string;
          const base64 = result.split(',')[1];
          resolve(base64);
        };
        reader.onerror = reject;
        reader.readAsDataURL(pdfBlob);
      });

      const pdfBase64 = await base64Promise;
      const emailHtml = `
<div style="font-family: Arial, sans-serif; font-size: 14px; color: #1e293b; line-height: 1.6;">
 
  <p><strong>Sayın ${formatName(formData.ilgiliKisi)},</strong></p><br/>

  <p>Tarafınıza hazırlanan fiyat teklifimiz ekte bilginize sunulmuştur.</p>

  <p><strong>Teklif No:</strong> <strong>${teklifNo}</strong></p><br/>

  <p>Her türlü sorunuz için memnuniyetle yardımcı olmaktan mutluluk duyarız.</p><br/>



  <p>
  <!-- LOGO -->
  <div style="text-align: left; margin-bottom: 20px;">
    <img src="https://dayandisli.com/logo-header.png"
         alt="DAYAN Dişli Logo"
         style="max-width: 240px; height: auto;" />
  </div>
    <strong>DAYAN DİŞLİ & PROFİL TAŞLAMA</strong><br/>
    <strong>📞 +90 536 583 74 20</strong><br/>
    <strong>📧 info@dayandisli.com</strong><br/>
    <strong>🌐 www.dayandisli.com</strong>
  </p>
</div>
`;

      const { error } = await supabase.functions.invoke('send-quotation-email', {
        body: {
          to: formData.email,
          subject: `${teklifNo} No'lu Fiyat Teklifi`,
          html: emailHtml,
          firma: formData.firma,
          ilgiliKisi: formatName(formData.ilgiliKisi),
          tel: formData.tel,
          konu: formData.konu,

          products: formData.products.map(p => ({
            kod: p.kod,
            cins: p.cins,
            malzeme: p.malzeme,
            miktar: p.miktar,
            birim: p.birim,
            birimFiyat: formatCurrencyFn(p.birimFiyat, formData.activeCurrency),
            toplam: formatCurrencyFn(calculateRowTotal(p), formData.activeCurrency)
          })),

          araToplam: formatCurrencyFn(calculateSubtotal(), formData.activeCurrency),
          kdv: formatCurrencyFn(calculateKDV(), formData.activeCurrency),
          genelToplam: formatCurrencyFn(calculateTotal(), formData.activeCurrency),
          notlar: formData.notlar,
          opsiyon: formData.opsiyon,
          teslimSuresi: formData.teslimSuresi,
          odemeSekli: formData.odemeSekli,
          teslimYeri: formData.teslimYeri,
          teklifNo: teklifNo,
          pdfBase64,
          pdfFileName: `${teklifNo}.pdf`
        }
      });

      if (error) throw error;

      toast({
        title: "E-posta Gönderildi",
        description: `Teklif ${formData.email} adresine başarıyla gönderildi.`,
      });

    } catch (error) {
      console.error("Email send error:", error);
      toast({
        title: "Hata",
        description: "E-posta gönderilemedi.",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsSendingEmail(false);
    }
  };

  // WhatsApp Share Handler
  const shareWhatsApp = async (
    teklifNo: string,
    formData: QuotationFormData,
    pdfBlob: Blob,
    calculateTotal: () => number,
    formatCurrencyFn: (amount: number, currency?: string) => string
  ) => {
    if (!pdfBlob || !teklifNo) {
      toast({
        title: "Hata",
        description: "PDF hazır değil!",
        variant: "destructive"
      });
      return;
    }

    setIsSendingWhatsApp(true);

    try {
      const pdfFile = new File([pdfBlob], `${teklifNo}.pdf`, { type: "application/pdf" });

      const messageText = `Merhaba, fiyat teklifleri ekte yer almaktadır:

📋 *Teklif No:* ${teklifNo}
🏢 *Firma:* ${formData.firma}
👤 *İlgili:* ${formatName(formData.ilgiliKisi)}
💰 *Toplam:* ${formatCurrencyFn(calculateTotal(), formData.activeCurrency)}

DAYAN DİŞLİ SANAYİ
📞 +90 536 583 74 20
📧 info@dayandisli.com
🌐 dayandisli.com`;

      // Check if Web Share API with files is supported
      if (navigator.share && navigator.canShare && navigator.canShare({ files: [pdfFile] })) {
        try {
          await navigator.share({
            files: [pdfFile],
            title: `${teklifNo} - Fiyat Teklifi`,
            text: messageText
          });
          
          toast({
            title: "Paylaşıldı",
            description: "PDF başarıyla paylaşıldı.",
          });
        } catch (shareError) {
          if ((shareError as Error).name !== 'AbortError') {
            throw shareError;
          }
        }
      } else {
        // Fallback: Open WhatsApp Web with message only
        const fallbackMessage = encodeURIComponent(
          `Merhaba, fiyat teklifleri ekte yer almaktadır:\n\n` +
          `📋 Teklif No: ${teklifNo}\n` +
          `🏢 Firma: ${formData.firma}\n` +
          `👤 İlgili: ${formatName(formData.ilgiliKisi)}\n` +
          `💰 Toplam: ${formatCurrencyFn(calculateTotal(), formData.activeCurrency)}\n\n` +
          `PDF dosyasını e-posta ile gönderebiliriz.\n\n` +
          `DAYAN DİŞLİ SANAYİ\n` +
          `📞 +90 536 583 74 20\n` +
          `📧 info@dayandisli.com`
        );

        const whatsappUrl = formData.tel 
          ? `https://api.whatsapp.com/send?phone=${formData.tel.replace(/\D/g, '')}&text=${fallbackMessage}`
          : `https://api.whatsapp.com/send?text=${fallbackMessage}`;

        window.open(whatsappUrl, '_blank');

        // Download PDF for manual attachment
        const downloadLink = document.createElement('a');
        downloadLink.href = URL.createObjectURL(pdfBlob);
        downloadLink.download = `${teklifNo}.pdf`;
        downloadLink.click();
        URL.revokeObjectURL(downloadLink.href);

        toast({
          title: "WhatsApp Açıldı",
          description: "PDF indirildi. WhatsApp'a manuel olarak ekleyebilirsiniz.",
        });
      }

    } catch (error) {
      console.error("WhatsApp share error:", error);
      toast({
        title: "Hata",
        description: "WhatsApp paylaşımı başarısız oldu.",
        variant: "destructive"
      });
      throw error;
    } finally {
      setIsSendingWhatsApp(false);
    }
  };

  return {
    // PDF state
    pdfBlob,
    pdfPreviewUrl,
    isGenerating,
    isSendingEmail,
    isSendingWhatsApp,
    
    // Actions
    generatePDF,
    createPDFPreview,
    sendEmail,
    shareWhatsApp,
  };
}

