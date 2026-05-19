import { useState, useEffect } from "react";
import { Button } from "@/components/ui/button";
import {
  Command,
  CommandEmpty,
  CommandGroup,
  CommandInput,
  CommandItem,
  CommandList,
} from "@/components/ui/command";
import {
  Popover,
  PopoverContent,
  PopoverTrigger,
} from "@/components/ui/popover";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { supabase } from "@/lib/supabaseClient";
import { generateKargoPdf } from "@/utils/generateKargoPdf";
import { useLanguage } from "@/contexts/LanguageContext";
import { Package, ChevronDown, FileText, Loader2, Search } from "lucide-react";

type Customer = {
  id: number;
  short_name: string;
  name?: string;
  address?: string;
  phone?: string;
};

// Türkçe karakter normalize
function normalize(text: string) {
  return text
    .toLowerCase()
    .replace(/ç/g, "c")
    .replace(/ğ/g, "g")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ş/g, "s")
    .replace(/ü/g, "u");
}

// PDF adına uygun slug üretimi
function slugifyForPdf(text: string) {
  return normalize(text)
    .replace(/\s+/g, "-")
    .replace(/[^a-z0-9-]/g, "")
    .replace(/-+/g, "-")
    .replace(/^-|-$/g, "");
}

type KargoProps = {
  embedded?: boolean;
};

export default function Kargo({ embedded = false }: KargoProps) {
  const { t } = useLanguage();
  const [open, setOpen] = useState(false);
  const [search, setSearch] = useState("");
  const [selectedCustomerId, setSelectedCustomerId] = useState<number | null>(null);
  const [selectedCustomerSlug, setSelectedCustomerSlug] = useState("");
  const [selectedName, setSelectedName] = useState("");
  const [customers, setCustomers] = useState<Customer[]>([]);
  const [loading, setLoading] = useState(true);
  const [generating, setGenerating] = useState(false);
  const [selectedShortName, setSelectedShortName] = useState("");


  // Müşterileri Supabase'den yükle
  useEffect(() => {
    const loadCustomers = async () => {
      setLoading(true);
      const { data: authData } = await supabase.auth.getSession();
      const { data, error } = await supabase
        .from("customers_full")
        .select("id, short_name, name")
        .order("short_name", { ascending: true });

      if (!error && data) {
        console.info("[Supabase] table loaded:", {
          table: "customers_full",
          rowCount: data.length,
          hasAuthSession: Boolean(authData.session),
          firstRowKeys: data[0] ? Object.keys(data[0]) : [],
        });
        setCustomers(data);
      } else if (error) {
        console.error("[Supabase] customers_full select failed:", error);
      }
      setLoading(false);
    };

    loadCustomers();
  }, []);

  // Arama filtresi
  const filteredCustomers = customers.filter((c) =>
    normalize(c.short_name).includes(normalize(search))
  );

  // PDF oluşturma
  const handleGeneratePDF = async () => {
    if (!selectedCustomerId) return;

    setGenerating(true);
    try {
      const { data, error } = await supabase
        .from("customers_full")
        .select("name, short_name, address, phone")
        .eq("id", selectedCustomerId)
        .single();

      if (error || !data) {
        console.error("[Supabase] customers_full single select failed:", error);
        return;
      }

      const pdfBytes = await generateKargoPdf(data);
const blob = new Blob([new Uint8Array(pdfBytes)], { type: "application/pdf" });
const url = URL.createObjectURL(blob);

// 📍 Dosyayı indirmeye zorla (iOS/Android uyumlu)
const link = document.createElement("a");
link.href = url;
link.download = `${data.short_name}-kargo.pdf`; 
document.body.appendChild(link);
link.click();
link.remove();

// 📍 Android’de otomatik görüntüleme
if (/Android/i.test(navigator.userAgent)) {
  setTimeout(() => {
    window.open(url, "_blank");
  }, 500);
}

    } finally {
      setGenerating(false);
    }
  };

  return (
    <div className={embedded ? "flex flex-col rounded-xl bg-slate-950 text-white" : "flex flex-col min-h-screen bg-gradient-to-br from-slate-900 via-slate-800 to-slate-900"}>
      {/* Header */}
      {!embedded && <header className="border-b border-slate-700/50 bg-slate-900/80 backdrop-blur-sm sticky top-0 z-50">
        <div className="container mx-auto px-4">
          <div className="flex items-center justify-between h-16">
            <div className="flex items-center gap-3">
              <div className="w-10 h-10 rounded-lg bg-gradient-to-br from-blue-500 to-blue-700 flex items-center justify-center">
                <Package className="w-6 h-6 text-white" />
              </div>
              <div>
                <h1 className="text-lg font-bold text-white tracking-tight">
                  {t.kargo?.title || "Kargo Yönetimi"}
                </h1>
                <p className="text-xs text-slate-400">
                  {t.kargo?.subtitle || "Müşteri Kargo Formu"}
                </p>
              </div>
            </div>
          </div>
        </div>
      </header>}

      {/* Main Content */}
      <main className={embedded ? "px-4 py-6 md:px-6" : "container mx-auto px-4 py-8"}>
        <div className="max-w-2xl mx-auto">
          {/* Page Title Card */}
          <div className="text-center mb-8">
            <h2 className="text-2xl md:text-3xl font-bold text-white mb-2">
              {t.kargo?.pageTitle || "Kargo Gönderim Formu"}
            </h2>
            <p className="text-slate-400">
              {t.kargo?.pageDescription || "Müşteri seçerek kargo etiketini PDF olarak oluşturun"}
            </p>
          </div>

          {/* Main Form Card */}
          <Card className="bg-slate-800/50 border-slate-700/50 backdrop-blur-sm">
            <CardHeader className="border-b border-slate-700/50">
              <CardTitle className="text-white flex items-center gap-2">
                <Search className="w-5 h-5 text-blue-400" />
                {t.kargo?.selectCustomer || "Müşteri Seçimi"}
              </CardTitle>
              <CardDescription className="text-slate-400">
                {t.kargo?.selectCustomerDescription || "Kargo göndermek istediğiniz müşteriyi seçin"}
              </CardDescription>
            </CardHeader>
            <CardContent className="pt-6 space-y-6">
              {loading ? (
                <div className="flex items-center justify-center py-12">
                  <div className="flex flex-col items-center gap-3">
                    <Loader2 className="w-8 h-8 text-blue-500 animate-spin" />
                    <p className="text-slate-400 text-sm">
                      {t.kargo?.loading || "Müşteriler yükleniyor..."}
                    </p>
                  </div>
                </div>
              ) : (
                <>
                  {/* Customer Dropdown */}
                  <div className="space-y-2">
                    <label className="text-sm font-medium text-slate-300">
                      {t.kargo?.customerLabel || "Müşteri"}
                    </label>
                    <Popover open={open} onOpenChange={setOpen}>
                      <PopoverTrigger asChild>
                        <Button 
                          variant="outline" 
                          className="w-full justify-between bg-slate-900/50 border-slate-600 text-slate-200 hover:bg-slate-700/50 hover:text-white h-12"
                        >
                          <span className={selectedName ? "text-white" : "text-slate-400"}>
                            {selectedShortName || (t.kargo?.selectPlaceholder || "Müşteri Seçin")}
                          </span>
                          <ChevronDown className="w-4 h-4 text-slate-400" />
                        </Button>
                      </PopoverTrigger>

                      <PopoverContent className="w-[var(--radix-popover-trigger-width)] p-0 bg-slate-800 border-slate-700" align="start">
                        <Command className="bg-transparent">
                          <CommandInput
                            placeholder={t.kargo?.searchPlaceholder || "Ara..."}
                            value={search}
                            onValueChange={setSearch}
                            className="border-slate-700 text-white placeholder:text-slate-400"
                          />
                          <CommandList className="max-h-[300px]">
                            <CommandEmpty className="py-6 text-center text-slate-400">
                              {t.kargo?.noResults || "Sonuç bulunamadı."}
                            </CommandEmpty>

                            <CommandGroup>
                              {filteredCustomers.map((c) => (
                                <CommandItem
                                  key={c.id}
                                  value={c.short_name}
                                  onSelect={async () => {
  const slug = slugifyForPdf(c.short_name);
  setSelectedCustomerSlug(slug);

  setSelectedShortName(c.short_name);
  setSelectedCustomerId(c.id);
  setOpen(false);

  const { data, error } = await supabase
    .from("customers_full")
    .select("name")
    .eq("id", c.id)
    .single();

  if (error) {
    console.error("[Supabase] customers_full selected customer failed:", error);
  } else {
    console.info("[Supabase] customers_full selected customer loaded:", data ? 1 : 0);
  }

  setSelectedName(data?.name || "");  // Altta gösterilecek
}}


                                  className="text-slate-200 hover:bg-slate-700/50 cursor-pointer aria-selected:bg-blue-600/20 aria-selected:text-blue-300"
                                >
                                  {c.short_name}
                                </CommandItem>
                              ))}
                            </CommandGroup>
                          </CommandList>
                        </Command>
                      </PopoverContent>
                    </Popover>
                  </div>

                  {/* Selected Customer Info */}
                  {selectedShortName && (
                    <div className="bg-slate-900/50 rounded-lg p-4 border border-slate-700/50">
                      <p className="text-sm text-slate-400 mb-1">
                        {t.kargo?.selectedCustomer || "Seçilen Müşteri"}
                      </p>
                      <p className="text-white font-medium">{selectedName}</p>
                    </div>
                  )}

                  {/* Submit Button */}
                  <div className="flex justify-end pt-2">
                    <Button
                      onClick={handleGeneratePDF}
                      disabled={!selectedCustomerId || generating}
                      className="w-full md:w-auto bg-gradient-to-r from-blue-600 to-blue-700 hover:from-blue-500 hover:to-blue-600 text-white font-medium px-6 h-12 disabled:opacity-50 disabled:cursor-not-allowed"
                    >
                      {generating ? (
                        <>
                          <Loader2 className="w-4 h-4 mr-2 animate-spin" />
                          {t.kargo?.generating || "Oluşturuluyor..."}
                        </>
                      ) : (
                        <>
                          <FileText className="w-4 h-4 mr-2" />
                          {t.kargo?.generatePdf || "PDF Oluştur"}
                        </>
                      )}
                    </Button>
                  </div>
                </>
              )}
            </CardContent>
          </Card>
        </div>
      </main>

      {/* Footer */}
      {!embedded && <footer className="border-t border-slate-700/50 bg-slate-900/50 mt-auto">
        <div className="container mx-auto px-4 py-4">
          <p className="text-center text-sm text-slate-500">
            © {new Date().getFullYear()} DAYAN DİŞLİ SANAYİ | İkitelli O.S.B. Çevre Sanayi Sitesi, 8. Blok No: 45/47 Başakşehir / İstanbul <br /> Tel: +90 536 583 74 20 | E-mail: info@dayandisli.com | Web: dayandisli.com
          </p>
        </div>
      </footer>}
    </div>
  );
}
