import { useState, useMemo, useEffect, useRef, useCallback } from "react";
import { ChevronDown, FileText, Loader2, Download, Search, Eye } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { ProductRow } from "../types";
import { QuotationPreviewModal } from "./QuotationPreviewModal";

export interface QuotationRecord {
  id: string;
  teklif_no: string;
  firma: string;
  ilgili_kisi: string;
  tel: string;
  email: string;
  konu: string;
  products: string | ProductRow[];
  active_currency: string;
  notlar: string;
  opsiyon: string;
  teslim_suresi: string;
  odeme_sekli: string;
  teslim_yeri: string;
  subtotal: number;
  kdv: number;
  total: number;
  created_at: string;
}

interface RecentQuotationsPanelProps {
  onPanelOpen?: () => void;
  onDownload?: (quotation: QuotationRecord) => void;
  onPreview?: (quotation: QuotationRecord) => Promise<Blob>;
}

export function RecentQuotationsPanel({ onPanelOpen, onDownload, onPreview }: RecentQuotationsPanelProps) {
  const { toast } = useToast();
  const [panelOpen, setPanelOpen] = useState(false);
  const [recentQuotes, setRecentQuotes] = useState<QuotationRecord[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [recreatingId, setRecreatingId] = useState<string | null>(null);
  const [searchTerm, setSearchTerm] = useState("");
  const [visibleCount, setVisibleCount] = useState(5);
  const panelRef = useRef<HTMLDivElement>(null);
  const [pdfBlob, setPdfBlob] = useState<Blob | null>(null);
  const [previewOpen, setPreviewOpen] = useState(false);
  const [isPreviewLoading, setIsPreviewLoading] = useState(false);
  const [previewQuote, setPreviewQuote] = useState<QuotationRecord | null>(null);
  const [previewQuoteIndex, setPreviewQuoteIndex] = useState<number>(-1);
  const [isNavigating, setIsNavigating] = useState(false);
  const blobUrlRef = useRef<string | null>(null);

  // Fetch recent quotations for the panel count and expanded history.
  const fetchRecentQuotes = useCallback(async () => {
    setIsLoading(true);
    try {
      const { data: authData } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("quotations")
        .select("*")
        .order("created_at", { ascending: false })
        .limit(1000);

      if (error) {
        console.error("[Supabase] quotations select failed:", error);
        throw error;
      }

      const rows = (data as QuotationRecord[]) || [];
      console.info("[Supabase] table loaded:", {
        table: "quotations",
        rowCount: rows.length,
        hasAuthSession: Boolean(authData.session),
        firstRowKeys: rows[0] ? Object.keys(rows[0]) : [],
      });
      setRecentQuotes(rows);
    } catch (error) {
      console.error("Failed to fetch recent quotations:", error);
      toast({
        title: "Hata",
        description: "Son teklifler yüklenemedi.",
        variant: "destructive",
      });
    } finally {
      setIsLoading(false);
    }
  }, [toast]);

  useEffect(() => {
    fetchRecentQuotes();
  }, [fetchRecentQuotes]);

  // Close panel
  const closePanel = () => {
    setPanelOpen(false);
  };

  // Toggle panel
  const handleTogglePanel = () => {
    const newState = !panelOpen;
    setPanelOpen(newState);

    if (newState) {
      if (recentQuotes.length === 0) {
        fetchRecentQuotes();
      }
      setVisibleCount(5);
      onPanelOpen?.();
    }
  };

  // Handle outside click to close panel
  useEffect(() => {
    const handleClickOutside = (event: MouseEvent) => {
      if (!panelOpen) return;

      if (panelRef.current && !panelRef.current.contains(event.target as Node)) {
        closePanel();
      }
    };

    document.addEventListener("mousedown", handleClickOutside);
    return () => {
      document.removeEventListener("mousedown", handleClickOutside);
    };
  }, [panelOpen]);

  // Filtered quotes (needed for helper functions)
  const filteredQuotes = useMemo(() => {
    if (!searchTerm.trim()) return recentQuotes;
    return recentQuotes.filter(q => 
      q.firma?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [recentQuotes, searchTerm]);

  // Ensure products is always an array
  const normalizeProducts = useCallback((products: string | ProductRow[]): ProductRow[] => {
    if (typeof products === "string") {
      try {
        return JSON.parse(products);
      } catch (e) {
        console.error("Failed to parse products:", e);
        return [];
      }
    }
    return products;
  }, []);

  // Cleanup blob URL
  const cleanupBlobUrl = useCallback(() => {
    if (blobUrlRef.current) {
      URL.revokeObjectURL(blobUrlRef.current);
      blobUrlRef.current = null;
    }
  }, []);

  // Get quotation by index (helper function)
  const getQuotationByIndex = useCallback((index: number): QuotationRecord | null => {
    if (index < 0 || index >= filteredQuotes.length) return null;
    return filteredQuotes[index];
  }, [filteredQuotes]);

  // Get next quotation
  const getNextQuotation = useCallback((currentIndex: number): QuotationRecord | null => {
    return getQuotationByIndex(currentIndex + 1);
  }, [getQuotationByIndex]);

  // Get previous quotation
  const getPreviousQuotation = useCallback((currentIndex: number): QuotationRecord | null => {
    return getQuotationByIndex(currentIndex - 1);
  }, [getQuotationByIndex]);

  const handleRecreatePDF = async (quote: QuotationRecord) => {
    try {
      const fileName = `${quote.teklif_no}.pdf`;
  
      const products = normalizeProducts(quote.products);
  
      const pdfBytes = await onDownload?.({
        ...quote,
        products,
      });
  
      if (!pdfBytes) return;
  
      const blob = new Blob([pdfBytes], { type: "application/pdf" });
      const blobUrl = URL.createObjectURL(blob);
  
      const link = document.createElement("a");
      link.href = blobUrl;
      link.download = fileName;
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
  
      URL.revokeObjectURL(blobUrl);
    } catch (err) {
      console.error("PDF download failed:", err);
      toast({
        title: "Hata",
        description: "PDF indirilemedi.",
        variant: "destructive",
      });
    }
  };

  const handlePreviewPDF = async (quote: QuotationRecord) => {
    if (!onPreview) return;

    setIsPreviewLoading(true);
    try {
      // Cleanup previous blob URL
      cleanupBlobUrl();

      const blob = await onPreview(quote);
      const index = filteredQuotes.findIndex((q) => q.id === quote.id);
      setPdfBlob(blob);
      setPreviewQuote(quote);
      setPreviewQuoteIndex(index);
      setPreviewOpen(true);
    } catch (error) {
      console.error("PDF açma hatası:", error);
      toast({
        title: "Hata",
        description: "PDF açılamadı.",
        variant: "destructive",
      });
    } finally {
      setIsPreviewLoading(false);
    }
  };

  const handleNavigateLeft = async () => {
    if (previewQuoteIndex <= 0 || !onPreview || isNavigating) return;

    setIsNavigating(true);
    try {
      const prevQuote = getPreviousQuotation(previewQuoteIndex);
      if (!prevQuote) {
        setIsNavigating(false);
        return;
      }

      // Cleanup previous blob
      cleanupBlobUrl();
      const oldBlob = pdfBlob;
      setPdfBlob(null); // Clear blob to trigger cleanup in PDFViewer

      const blob = await onPreview(prevQuote);
      setPdfBlob(blob);
      setPreviewQuote(prevQuote);
      setPreviewQuoteIndex(previewQuoteIndex - 1);
    } catch (error) {
      console.error("PDF navigasyon hatası:", error);
      toast({
        title: "Hata",
        description: "Önceki teklif yüklenemedi.",
        variant: "destructive",
      });
    } finally {
      setIsNavigating(false);
    }
  };

  const handleNavigateRight = async () => {
    if (previewQuoteIndex >= filteredQuotes.length - 1 || !onPreview || isNavigating) return;

    setIsNavigating(true);
    try {
      const nextQuote = getNextQuotation(previewQuoteIndex);
      if (!nextQuote) {
        setIsNavigating(false);
        return;
      }

      // Cleanup previous blob
      cleanupBlobUrl();
      const oldBlob = pdfBlob;
      setPdfBlob(null); // Clear blob to trigger cleanup in PDFViewer

      const blob = await onPreview(nextQuote);
      setPdfBlob(blob);
      setPreviewQuote(nextQuote);
      setPreviewQuoteIndex(previewQuoteIndex + 1);
    } catch (error) {
      console.error("PDF navigasyon hatası:", error);
      toast({
        title: "Hata",
        description: "Sonraki teklif yüklenemedi.",
        variant: "destructive",
      });
    } finally {
      setIsNavigating(false);
    }
  };

  // Preview functions for iOS-style drag preview (don't update state)
  const handlePreviewLeft = async (): Promise<Blob | null> => {
    if (previewQuoteIndex <= 0 || !onPreview) return null;
    
    try {
      const prevQuote = getPreviousQuotation(previewQuoteIndex);
      if (!prevQuote) return null;
      
      const blob = await onPreview(prevQuote);
      return blob;
    } catch (error) {
      console.error("Failed to preview previous quote:", error);
      return null;
    }
  };

  const handlePreviewRight = async (): Promise<Blob | null> => {
    if (previewQuoteIndex >= filteredQuotes.length - 1 || !onPreview) return null;
    
    try {
      const nextQuote = getNextQuotation(previewQuoteIndex);
      if (!nextQuote) return null;
      
      const blob = await onPreview(nextQuote);
      return blob;
    } catch (error) {
      console.error("Failed to preview next quote:", error);
      return null;
    }
  };

  const handleDownloadFromPreview = () => {
    if (!previewQuote || !onDownload) return;

    const products = normalizeProducts(previewQuote.products);

    onDownload({
      ...previewQuote,
      products,
    });
  };

  // Reset visible count when search changes
  useEffect(() => {
    setVisibleCount(5);
  }, [searchTerm]);

  // Visible subset
  const visibleQuotes = useMemo(() => {
    return filteredQuotes.slice(0, visibleCount);
  }, [filteredQuotes, visibleCount]);

  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString("tr-TR", {
      day: "2-digit",
      month: "2-digit",
      year: "numeric",
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div ref={panelRef} className="mt-6 mb-6">
      {/* Collapsible Header */}
      <button
        onClick={handleTogglePanel}
        className="w-full flex items-center justify-between px-4 py-3 bg-slate-800/50 hover:bg-slate-800/70 border border-slate-700/50 rounded-lg transition-all duration-200"
      >
        <div className="flex items-center gap-2 text-slate-300">
          <FileText className="w-5 h-5 text-blue-400" />
          <span className="font-medium">Son Teklifler</span>
          {filteredQuotes.length > 0 && (
            <span className="text-xs bg-blue-500/20 text-blue-400 px-2 py-0.5 rounded-full">
              {filteredQuotes.length}
            </span>
          )}
        </div>
        <ChevronDown 
          className={`w-5 h-5 text-slate-400 transition-transform duration-200 ${panelOpen ? 'rotate-180' : ''}`}
        />
      </button>

      {/* Collapsible Content */}
      <div
        className={`overflow-y-auto transition-all duration-300 ease-in-out ${
          panelOpen ? 'max-h-screen opacity-100 mt-2' : 'max-h-0 opacity-0'
        }`}
      >
        <div className="bg-slate-800/30 border border-slate-700/50 rounded-lg overflow-hidden">

          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <Loader2 className="w-6 h-6 text-blue-400 animate-spin" />
              <span className="ml-2 text-slate-400">Yükleniyor...</span>
            </div>
          ) : recentQuotes.length === 0 ? (
            <div className="text-center py-8 text-slate-500">
              Henüz kayıtlı teklif bulunmuyor.
            </div>
          ) : (
            <>
              {/* Search Bar */}
              <div className="px-4 py-3 border-b border-slate-700/50">
                <div className="relative">
                  <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-4 h-4 text-slate-400" />
                  <input
                    type="text"
                    placeholder="Firma adı ile ara..."
                    value={searchTerm}
                    onChange={(e) => setSearchTerm(e.target.value)}
                    className="w-full pl-10 pr-4 py-2 bg-slate-900/50 border border-slate-700/50 rounded-md text-sm text-slate-300 placeholder-slate-500 focus:outline-none focus:ring-2 focus:ring-blue-500/50 focus:border-blue-500/50 transition-colors"
                  />
                </div>
              </div>

              <div className="overflow-x-auto">
              <table className="w-full table-fixed">

                  <thead>
                    <tr className="border-b border-slate-700/50 bg-slate-900/50">
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Teklif No</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Firma</th>
                      <th className="text-left px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">Oluşturma Tarihi</th>
                      <th className="text-center px-4 py-3 text-xs font-medium text-slate-400 uppercase tracking-wider">İndir</th>
                    </tr>
                  </thead>

                  <tbody className="divide-y divide-slate-700/30">
                    {visibleQuotes.length === 0 ? (
                      <tr>
                        <td colSpan={4} className="text-center py-8 text-slate-500">
                          Arama sonucu bulunamadı.
                        </td>
                      </tr>
                    ) : (
                      visibleQuotes.map((quote) => (
                        <tr key={quote.id} className="hover:bg-slate-700/20 transition-colors">
                          <td className="px-4 py-3 max-w-[120px]">
  <span className="text-blue-400 font-medium block truncate">
    {quote.teklif_no}
  </span>
</td>

                          <td className="px-4 py-3 text-slate-300 text-sm">
                            {quote.firma}
                          </td>
                          <td className="px-4 py-3 text-slate-400 text-sm">
                            {formatDate(quote.created_at)}
                          </td>
                          <td className="px-2 py-3 text-center whitespace-nowrap">

                            <div className="flex items-center justify-center gap-2">
                              <button
                                onClick={() => handlePreviewPDF(quote)}
                                disabled={!onPreview || isPreviewLoading}
                                title="Önizle"
                                className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {isPreviewLoading ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Eye className="w-4 h-4" />
                                )}
                              </button>
                              <button
                                onClick={() => handleRecreatePDF(quote)}
                                disabled={!onDownload || recreatingId === quote.teklif_no}
                                className="inline-flex items-center justify-center w-8 h-8 rounded-md bg-blue-500/20 hover:bg-blue-500/30 text-blue-400 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                              >
                                {recreatingId === quote.teklif_no ? (
                                  <Loader2 className="w-4 h-4 animate-spin" />
                                ) : (
                                  <Download className="w-4 h-4" />
                                )}
                              </button>
                            </div>
                          </td>
                        </tr>
                      ))
                    )}
                  </tbody>
                </table>
              </div>

              {/* Load More Button */}
              <div className="px-4 py-3 border-t border-slate-700/50 flex justify-center">
                <button
                  onClick={() => setVisibleCount(prev => prev + 5)}
                  disabled={visibleCount >= filteredQuotes.length}
                  className="px-4 py-2 bg-slate-700/50 hover:bg-slate-700/70 border border-slate-600/50 rounded-md text-sm text-slate-300 hover:text-white transition-colors disabled:opacity-40 disabled:cursor-not-allowed disabled:hover:bg-slate-700/50"
                >
                  Daha Fazla Göster
                </button>
              </div>

            </>
          )}

        </div>
      </div>

      <QuotationPreviewModal
        open={previewOpen}
        onOpenChange={(open) => {
          setPreviewOpen(open);
          if (!open) {
            // Cleanup blob URL
            cleanupBlobUrl();
            if (pdfBlob) {
              setPdfBlob(null);
            }
            setPreviewQuote(null);
            setPreviewQuoteIndex(-1);
            setIsNavigating(false);
          }
        }}
        pdfBlob={pdfBlob}
        teklifNo={previewQuote?.teklif_no || ""}
        onDownload={handleDownloadFromPreview}
        onNavigateLeft={handleNavigateLeft}
        onNavigateRight={handleNavigateRight}
        onPreviewLeft={handlePreviewLeft}
        onPreviewRight={handlePreviewRight}
        canNavigateLeft={previewQuoteIndex > 0}
        canNavigateRight={previewQuoteIndex >= 0 && previewQuoteIndex < filteredQuotes.length - 1}
        isNavigating={isNavigating}
      />
    </div>
  );
}
//test
