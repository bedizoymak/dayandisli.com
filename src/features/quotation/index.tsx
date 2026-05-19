import { useState } from "react";
import { Link } from "react-router-dom";
import { Button } from "@/components/ui/button";
import { FileText, ArrowLeft } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { useQuotationForm } from "./hooks/useQuotationForm";
import { useQuotationPDF } from "./hooks/useQuotationPDF";
import { CustomerInfoSection } from "./components/CustomerInfoSection";
import { ProductTableSection } from "./components/ProductTableSection";
import { FooterFieldsSection } from "./components/FooterFieldsSection";
import { ActionButtons } from "./components/ActionButtons";
import { EmailPreviewModal } from "./components/EmailPreviewModal";
import { WhatsAppPreviewModal } from "./components/WhatsAppPreviewModal";
import { CustomerSelectionModal } from "./components/CustomerSelectionModal";
import { CustomerProfile, ProductRow } from "./types";
import { RecentQuotationsPanel, QuotationRecord } from "./components/RecentQuotationsPanel";



type TeklifPageProps = {
  embedded?: boolean;
};

const TeklifPage = ({ embedded = false }: TeklifPageProps) => {
  const { toast } = useToast();
  
  // Form state management
  const form = useQuotationForm();
  const pdf = useQuotationPDF();
  
  // Modal state
  const [showEmailModal, setShowEmailModal] = useState(false);
  const [showWhatsAppModal, setShowWhatsAppModal] = useState(false);
  const [showCustomerModal, setShowCustomerModal] = useState(false);
  
  // Customer autofill state
  const [customers, setCustomers] = useState<CustomerProfile[]>([]);
  const [loadingCustomers, setLoadingCustomers] = useState(false);
  const [searchTerm, setSearchTerm] = useState("");

  // Load customers from Supabase
  const loadCustomers = async () => {
    setLoadingCustomers(true);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from('customer_profile')
        .select('*')
        .order('firma', { ascending: true });
      
      if (error) throw error;
      if (import.meta.env.DEV) {
        console.info("[Supabase] table loaded:", {
          table: "customer_profile",
          rowCount: data?.length || 0,
          hasAuthSession: Boolean(authData.session),
          firstRowKeys: data?.[0] ? Object.keys(data[0]) : [],
        });
      }
      setCustomers(data || []);
    } catch (error) {
      console.error('[Supabase] customer_profile select failed:', error);
      toast({
        title: "Hata",
        description: "Müşteri listesi yüklenemedi.",
        variant: "destructive"
      });
    } finally {
      setLoadingCustomers(false);
    }
  };

  // Select customer and autofill
  const selectCustomer = (customer: CustomerProfile) => {
    form.setFirma(customer.firma || "");
    form.setIlgiliKisi(customer.ilgili_kisi || "");
    form.setTel(customer.telefon || "");
    form.setEmail(customer.email || "");
    form.setKonu(customer.konu || "");
    setShowCustomerModal(false);
    
    toast({
      title: "Müşteri Seçildi",
      description: `${customer.firma} bilgileri dolduruldu.`,
    });
  };

  // Get form data for PDF generation
  const getFormData = () => ({
    firma: form.firma,
    ilgiliKisi: form.ilgiliKisi,
    tel: form.tel,
    email: form.email,
    konu: form.konu,
    products: form.products,
    activeCurrency: form.activeCurrency,
    notlar: form.notlar,
    opsiyon: form.opsiyon,
    teslimSuresi: form.teslimSuresi,
    odemeSekli: form.odemeSekli,
    teslimYeri: form.teslimYeri,
  });

  // Shared helper to ensure quotation is saved to database exactly once
  const ensureQuotationSaved = async (): Promise<string | null> => {
    // Get or generate teklif number
    const teklifNo = await form.getOrGenerateTeklifNo();
    if (!teklifNo) {
      toast({
        title: "Sayaç Hatası",
        description: "Teklif numarası alınamadı!",
        variant: "destructive",
      });
      return null;
    }

    // Update form state
    form.setCurrentTeklifNo(teklifNo);

    // Check if this quotation already exists in database
    const { data: existing, error: checkError } = await supabase
      .from("quotations")
      .select("teklif_no")
      .eq("teklif_no", teklifNo)
      .maybeSingle();

    if (checkError) {
      console.error("Error checking existing quotation:", checkError);
      toast({
        title: "Veritabanı Hatası",
        description: "Teklif kontrolü yapılamadı!",
        variant: "destructive",
      });
      return null;
    }

    // If quotation already exists, skip insert
    if (existing) {
      if (import.meta.env.DEV) console.info(`Quotation ${teklifNo} already exists, skipping insert`);
      return teklifNo;
    }

    // Insert new quotation to database
    const { error: insertError } = await supabase.from("quotations").insert({
      teklif_no: teklifNo,
      firma: form.firma,
      ilgili_kisi: form.ilgiliKisi,
      tel: form.tel,
      email: form.email,
      konu: form.konu,
      products: JSON.stringify(form.products),
      active_currency: form.activeCurrency,
      notlar: form.notlar,
      opsiyon: form.opsiyon,
      teslim_suresi: form.teslimSuresi,
      odeme_sekli: form.odemeSekli,
      teslim_yeri: form.teslimYeri,
      subtotal: form.calculateSubtotal(),
      kdv: form.calculateKDV(),
      total: form.calculateTotal()
    });

    if (insertError) {
      console.error("Error inserting quotation:", insertError);
      toast({
        title: "Kaydetme Hatası",
        description: "Supabase'e kayıt yapılamadı!",
        variant: "destructive",
      });
      return null;
    }

    if (import.meta.env.DEV) console.info(`Quotation ${teklifNo} saved successfully`);
    return teklifNo;
  };

  // PDF Download Handler
  const handleGeneratePDF = async () => {
    if (!form.firma || !form.ilgiliKisi) {
      toast({
        title: "Eksik Bilgi",
        description: "Lütfen firma ve ilgili kişi bilgilerini doldurun.",
        variant: "destructive"
      });
      return;
    }

    // Ensure quotation is saved to database
    const teklifNo = await ensureQuotationSaved();
    if (!teklifNo) {
      return;
    }

    form.setLastFinalizedTeklifNo(teklifNo);
    form.markFormFinalized();

    await pdf.generatePDF(
      teklifNo,
      getFormData(),
      form.calculateRowTotal,
      form.calculateSubtotal,
      form.calculateKDV,
      form.calculateTotal,
      form.formatCurrency
    );
  };

  // Email Preview Handler
  const handleEmailPreview = async () => {
    if (!form.firma || !form.ilgiliKisi || !form.email) {
      toast({
        title: "Eksik Bilgi",
        description: "Firma, ilgili kişi ve e-posta zorunludur.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Ensure quotation is saved to database
      const teklifNo = await ensureQuotationSaved();
      if (!teklifNo) {
        return;
      }

      await pdf.createPDFPreview(
        teklifNo,
        getFormData(),
        form.calculateRowTotal,
        form.calculateSubtotal,
        form.calculateKDV,
        form.calculateTotal,
        form.formatCurrency
      );

      setShowEmailModal(true);
    } catch (error) {
      console.error(error);
      toast({
        title: "Hata",
        description: "Önizleme oluşturulamadı!",
        variant: "destructive",
      });
    }
  };

  // Send Email Handler
  const handleSendEmail = async () => {
    if (!pdf.pdfBlob || !form.currentTeklifNo) {
      toast({
        title: "Hata",
        description: "PDF hazır değil!",
        variant: "destructive"
      });
      return;
    }

    try {
      await pdf.sendEmail(
        form.currentTeklifNo,
        getFormData(),
        pdf.pdfBlob,
        form.calculateRowTotal,
        form.calculateSubtotal,
        form.calculateKDV,
        form.calculateTotal,
        form.formatCurrency
      );

      // Mark as finalized after successful send
      form.setLastFinalizedTeklifNo(form.currentTeklifNo);
      form.markFormFinalized();

      setShowEmailModal(false);
    } catch (error) {
      // Error already handled in hook
    }
  };

  // WhatsApp Preview Handler
  const handleWhatsAppPreview = async () => {
    if (!form.firma || !form.ilgiliKisi) {
      toast({
        title: "Eksik Bilgi",
        description: "Firma ve ilgili kişi zorunludur.",
        variant: "destructive",
      });
      return;
    }

    try {
      // Ensure quotation is saved to database
      const teklifNo = await ensureQuotationSaved();
      if (!teklifNo) {
        return;
      }

      await pdf.createPDFPreview(
        teklifNo,
        getFormData(),
        form.calculateRowTotal,
        form.calculateSubtotal,
        form.calculateKDV,
        form.calculateTotal,
        form.formatCurrency
      );

      setShowWhatsAppModal(true);
    } catch (error) {
      console.error(error);
      toast({
        title: "Hata",
        description: "WhatsApp önizlemesi oluşturulamadı!",
        variant: "destructive",
      });
    }
  };

  // WhatsApp Share Handler
  const handleWhatsAppShare = async () => {
    if (!pdf.pdfBlob || !form.currentTeklifNo) {
      toast({
        title: "Hata",
        description: "PDF hazır değil!",
        variant: "destructive"
      });
      return;
    }

    try {
      await pdf.shareWhatsApp(
        form.currentTeklifNo,
        getFormData(),
        pdf.pdfBlob,
        form.calculateTotal,
        form.formatCurrency
      );

      // Mark as finalized after successful share
      form.setLastFinalizedTeklifNo(form.currentTeklifNo);
      form.markFormFinalized();

      setShowWhatsAppModal(false);
    } catch (error) {
      // Error already handled in hook
    }
  };

  // Recent Quotation Preview Handler
  const handleRecentQuotationPreview = async (quotation: QuotationRecord): Promise<Blob> => {
    // Parse products if it's a string
    const products = typeof quotation.products === 'string' 
      ? JSON.parse(quotation.products) 
      : quotation.products;

    // Determine issue date: created_at → updated_at → new Date()
    const issueDate = quotation.created_at 
      ? new Date(quotation.created_at)
      : (quotation as any).updated_at 
      ? new Date((quotation as any).updated_at)
      : new Date();

    // Convert quotation to QuotationFormData format
    const quotationFormData = {
      firma: quotation.firma,
      ilgiliKisi: quotation.ilgili_kisi,
      tel: quotation.tel,
      email: quotation.email,
      konu: quotation.konu,
      products: products,
      activeCurrency: quotation.active_currency,
      notlar: quotation.notlar,
      opsiyon: quotation.opsiyon,
      teslimSuresi: quotation.teslim_suresi,
      odemeSekli: quotation.odeme_sekli,
      teslimYeri: quotation.teslim_yeri,
    };

    // Create calculation functions based on quotation's products
    const calculateRowTotal = (row: ProductRow) => row.miktar * row.birimFiyat;
    const calculateSubtotal = () => products.reduce((sum: number, p: ProductRow) => sum + calculateRowTotal(p), 0);
    const calculateKDV = () => calculateSubtotal() * 0.20;
    const calculateTotal = () => calculateSubtotal() + calculateKDV();
    const formatCurrency = (amount: number, currency = quotation.active_currency) => {
      const symbols: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€" };
      return `${symbols[currency] || "₺"}${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
    };

    // Use useQuotationPDF's preview function and return the Blob
    const pdfBlob = await pdf.createPDFPreview(
      quotation.teklif_no,
      quotationFormData,
      calculateRowTotal,
      calculateSubtotal,
      calculateKDV,
      calculateTotal,
      formatCurrency,
      issueDate
    );
    
    return pdfBlob;
  };

  // Recent Quotation Download Handler
  const handleRecentQuotationDownload = async (quotation: QuotationRecord) => {
    try {
      // Parse products if it's a string
      const products = typeof quotation.products === 'string' 
        ? JSON.parse(quotation.products) 
        : quotation.products;

      // Extract issue date: use created_at, fallback to updated_at, else current date
      const issueDate = quotation.created_at 
        ? new Date(quotation.created_at)
        : (quotation as any).updated_at 
        ? new Date((quotation as any).updated_at)
        : new Date();

      // Convert quotation to QuotationFormData format
      const quotationFormData = {
        firma: quotation.firma,
        ilgiliKisi: quotation.ilgili_kisi,
        tel: quotation.tel,
        email: quotation.email,
        konu: quotation.konu,
        products: products,
        activeCurrency: quotation.active_currency,
        notlar: quotation.notlar,
        opsiyon: quotation.opsiyon,
        teslimSuresi: quotation.teslim_suresi,
        odemeSekli: quotation.odeme_sekli,
        teslimYeri: quotation.teslim_yeri,
      };

      // Create calculation functions based on quotation's products
      const calculateRowTotal = (row: ProductRow) => row.miktar * row.birimFiyat;
      const calculateSubtotal = () => products.reduce((sum: number, p: ProductRow) => sum + calculateRowTotal(p), 0);
      const calculateKDV = () => calculateSubtotal() * 0.20;
      const calculateTotal = () => calculateSubtotal() + calculateKDV();
      const formatCurrency = (amount: number, currency = quotation.active_currency) => {
        const symbols: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€" };
        return `${symbols[currency] || "₺"}${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
      };

      await pdf.generatePDF(
        quotation.teklif_no,
        quotationFormData,
        calculateRowTotal,
        calculateSubtotal,
        calculateKDV,
        calculateTotal,
        formatCurrency,
        issueDate
      );

      toast({
        title: "PDF Downloaded",
        description: `${quotation.teklif_no} generated successfully.`,
      });
    } catch (error) {
      console.error(error);
      toast({
        title: "Error",
        description: "Failed to download the quotation!",
        variant: "destructive",
      });
    }
  };

  return (
    <div className={embedded ? "rounded-xl bg-slate-950 text-white" : "min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"}>
      {/* Header */}
      {!embedded && <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <Link 
              to="/dashboard" 
              className="flex items-center gap-3 hover:opacity-80 transition-opacity"
            >
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                <FileText className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  TEKLİF OLUŞTURUCU
                </h1>
                <p className="text-xs text-slate-400">Dayan Dişli Sanayi</p>
              </div>
            </Link>

            <div className="flex items-center gap-2">
              <Link to="/dashboard">
                <Button variant="ghost" size="sm" className="text-slate-300 hover:text-white hover:bg-slate-700/50">
                  <ArrowLeft className="w-4 h-4 mr-2" />
                  Geri
                </Button>
              </Link>
            </div>
          </div>
        </div>
      </header>}

      <main className={embedded ? "px-4 py-6 md:px-6" : "container mx-auto px-4 py-8 max-w-6xl"}>
        {/* Teklif No Display */}
        {form.currentTeklifNo && (
          <div className="mb-6 flex items-center gap-3 bg-blue-600/20 border border-blue-500/30 rounded-lg px-4 py-3">
            <FileText className="w-5 h-5 text-blue-400" />
            <span className="text-lg font-semibold text-white">Teklif No: {form.currentTeklifNo}</span>
            {!form.formChanged && (
              <span className="text-xs text-green-400 ml-2">(Kaydedildi)</span>
            )}
          </div>
        )}

        {/* Recent Quotations Panel */}
        <RecentQuotationsPanel 
          onDownload={handleRecentQuotationDownload}
          onPreview={handleRecentQuotationPreview}
        />

        {/* Customer Information */}
        <CustomerInfoSection
          firma={form.firma}
          ilgiliKisi={form.ilgiliKisi}
          tel={form.tel}
          email={form.email}
          konu={form.konu}
          onFirmaChange={form.setFirma}
          onIlgiliKisiChange={form.setIlgiliKisi}
          onTelChange={form.setTel}
          onEmailChange={form.setEmail}
          onKonuChange={form.setKonu}
          onCustomerSelectClick={() => {
            loadCustomers();
            setShowCustomerModal(true);
          }}
        />

        {/* Product Table */}
        <ProductTableSection
          products={form.products}
          activeCurrency={form.activeCurrency}
          onAddRow={form.addRow}
          onRemoveRow={form.removeRow}
          onUpdateProduct={form.updateProduct}
          onCurrencyChange={form.handleCurrencyChange}
          calculateRowTotal={form.calculateRowTotal}
          calculateSubtotal={form.calculateSubtotal}
          calculateKDV={form.calculateKDV}
          calculateTotal={form.calculateTotal}
          formatCurrency={form.formatCurrency}
        />

        {/* Footer Fields */}
        <FooterFieldsSection
          notlar={form.notlar}
          opsiyon={form.opsiyon}
          teslimSuresi={form.teslimSuresi}
          odemeSekli={form.odemeSekli}
          teslimYeri={form.teslimYeri}
          onNotlarChange={form.setNotlar}
          onOpsiyonChange={form.setOpsiyon}
          onTeslimSuresiChange={form.setTeslimSuresi}
          onOdemeSekliChange={form.setOdemeSekli}
          onTeslimYeriChange={form.setTeslimYeri}
        />

        {/* Action Buttons */}
        <ActionButtons
          isGenerating={pdf.isGenerating}
          isSendingEmail={pdf.isSendingEmail}
          isSendingWhatsApp={pdf.isSendingWhatsApp}
          onGeneratePDF={handleGeneratePDF}
          onEmailPreview={handleEmailPreview}
          onWhatsAppPreview={handleWhatsAppPreview}
          hasRequiredFields={form.hasRequiredFields()}
        />
      </main>

      {/* Footer */}
      {!embedded && <footer className="border-t border-slate-700/50 bg-slate-900/50 mt-12">
        <div className="container mx-auto px-4 py-6 text-center">
          <p className="text-sm text-slate-500">
            © {new Date().getFullYear()} DAYAN DİŞLİ SANAYİ | İkitelli O.S.B. Çevre Sanayi Sitesi, 8. Blok No: 45/47 Başakşehir / İstanbul
          </p>
          <p className="text-sm text-slate-500 mt-1">
            Tel: +90 536 583 74 20 | E-mail: info@dayandisli.com | Web: dayandisli.com
          </p>
        </div>
      </footer>}

      {/* Email Preview Modal */}
      <EmailPreviewModal
        open={showEmailModal}
        onOpenChange={setShowEmailModal}
        currentTeklifNo={form.currentTeklifNo}
        email={form.email}
        firma={form.firma}
        ilgiliKisi={form.ilgiliKisi}
        pdfPreviewUrl={pdf.pdfPreviewUrl}
        total={form.calculateTotal()}
        activeCurrency={form.activeCurrency}
        isSending={pdf.isSendingEmail}
        onSend={handleSendEmail}
        formatCurrency={form.formatCurrency}
        formatName={form.formatName}
      />

      {/* WhatsApp Preview Modal */}
      <WhatsAppPreviewModal
        open={showWhatsAppModal}
        onOpenChange={setShowWhatsAppModal}
        currentTeklifNo={form.currentTeklifNo}
        firma={form.firma}
        ilgiliKisi={form.ilgiliKisi}
        total={form.calculateTotal()}
        activeCurrency={form.activeCurrency}
        isSending={pdf.isSendingWhatsApp}
        onShare={handleWhatsAppShare}
        formatCurrency={form.formatCurrency}
        formatName={form.formatName}
      />

      {/* Customer Selection Modal */}
      <CustomerSelectionModal
        open={showCustomerModal}
        onOpenChange={setShowCustomerModal}
        customers={customers}
        loading={loadingCustomers}
        searchTerm={searchTerm}
        onSearchChange={setSearchTerm}
        onSelectCustomer={selectCustomer}
        onLoadCustomers={loadCustomers}
      />
    </div>
  );
};

export default TeklifPage;

