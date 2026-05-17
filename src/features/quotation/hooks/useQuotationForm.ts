import { useState, useEffect, useRef } from "react";
import { supabase } from "@/lib/supabase";
import { useToast } from "@/hooks/use-toast";
import { ProductRow } from "../types";

export function formatName(name: string) {
  return name
    .trim()
    .split(/\s+/)
    .map(word =>
      word.charAt(0).toLocaleUpperCase("tr-TR") +
      word.slice(1).toLocaleLowerCase("tr-TR")
    )
    .join(" ");
}

export function useQuotationForm() {
  const { toast } = useToast();

  // Customer info state
  const [firma, setFirma] = useState("");
  const [ilgiliKisi, setIlgiliKisi] = useState("");
  const [tel, setTel] = useState("");
  const [email, setEmail] = useState("");
  const [konu, setKonu] = useState("");

  // Active currency for all products
  const [activeCurrency, setActiveCurrency] = useState("TRY");

  // Product rows state
  const [products, setProducts] = useState<ProductRow[]>([
    { id: 1, kod: "", cins: "", malzeme: "C45", miktar: 1, birim: "Adet", birimFiyat: 0, doviz: "TRY" }
  ]);

  // Footer fields state
  const [notlar, setNotlar] = useState("");
  const [opsiyon, setOpsiyon] = useState("");
  const [teslimSuresi, setTeslimSuresi] = useState("");
  const [odemeSekli, setOdemeSekli] = useState("");
  const [teslimYeri, setTeslimYeri] = useState("");

  // Counter & tracking state
  const [currentTeklifNo, setCurrentTeklifNo] = useState("");
  const [formChanged, setFormChanged] = useState(true);
  const [lastFinalizedTeklifNo, setLastFinalizedTeklifNo] = useState("");
  const formSnapshotRef = useRef<string>("");

  const getFormSnapshot = () => {
    return JSON.stringify({
      firma, ilgiliKisi, tel, email, konu,
      products, notlar, opsiyon, teslimSuresi, odemeSekli, teslimYeri, activeCurrency
    });
  };

  const checkFormChanged = () => {
    const currentSnapshot = getFormSnapshot();
    return currentSnapshot !== formSnapshotRef.current;
  };

  const markFormFinalized = () => {
    formSnapshotRef.current = getFormSnapshot();
    setFormChanged(false);
  };

  useEffect(() => {
    if (lastFinalizedTeklifNo && checkFormChanged()) {
      setFormChanged(true);
    }
  }, [firma, ilgiliKisi, tel, email, konu, products, notlar, opsiyon, teslimSuresi, odemeSekli, teslimYeri, activeCurrency, lastFinalizedTeklifNo]);

  const handleCurrencyChange = (newCurrency: string) => {
    if (newCurrency === activeCurrency) return;
    setActiveCurrency(newCurrency);
    setFormChanged(true);
  };

  const addRow = () => {
    const newId = Math.max(...products.map(p => p.id), 0) + 1;
    setProducts([...products, { id: newId, kod: "", cins: "", malzeme: "C45", miktar: 1, birim: "Adet", birimFiyat: 0, doviz: activeCurrency }]);
    setFormChanged(true);
  };

  const loadQuotationByNo = async (teklifNo: string) => {
    const { data, error } = await supabase
      .from("quotations")
      .select("*")
      .eq("teklif_no", teklifNo)
      .single();

    if (error || !data) throw new Error("Teklif bulunamadı");

    setFirma(data.firma);
    setIlgiliKisi(data.ilgili_kisi);
    setTel(data.tel);
    setEmail(data.email);
    setKonu(data.konu);
    setProducts(JSON.parse(data.products));
    setActiveCurrency(data.active_currency);
    setNotlar(data.notlar);
    setOpsiyon(data.opsiyon);
    setTeslimSuresi(data.teslim_suresi);
    setOdemeSekli(data.odeme_sekli);
    setTeslimYeri(data.teslim_yeri);

    setCurrentTeklifNo(data.teklif_no);
    markFormFinalized(); // SAYFA YÜKLENDİĞİNDE KAYDEDİLDİ GÖZÜKSÜN
  };

  const removeRow = (id: number) => {
    if (products.length > 1) {
      setProducts(products.filter(p => p.id !== id));
      setFormChanged(true);
    }
  };

  const updateProduct = (id: number, field: keyof ProductRow, value: string | number) => {
    setProducts(products.map(p => p.id === id ? { ...p, [field]: value } : p));
    setFormChanged(true);
  };

  const calculateRowTotal = (row: ProductRow) => row.miktar * row.birimFiyat;
  const calculateSubtotal = () => products.reduce((sum, p) => sum + calculateRowTotal(p), 0);
  const calculateKDV = () => calculateSubtotal() * 0.20;
  const calculateTotal = () => calculateSubtotal() + calculateKDV();

  const formatCurrency = (amount: number, currency = activeCurrency) => {
    const symbols: Record<string, string> = { TRY: "₺", USD: "$", EUR: "€" };
    return `${symbols[currency] || "₺"}${amount.toLocaleString('tr-TR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`;
  };

  const getOrGenerateTeklifNo = async (): Promise<string | null> => {
    if (!formChanged && lastFinalizedTeklifNo) {
      return lastFinalizedTeklifNo;
    }

    try {
      const { data, error } = await supabase.rpc("increment_monthly_counter");
      if (error || !data) {
        console.error("Counter error:", error);
        return null;
      }

      const formattedCounter = String(data).padStart(3, "0");
      const now = new Date();
      const yearMonth = `${now.getFullYear()}${String(now.getMonth() + 1).padStart(2, "0")}`;
      const teklifNo = `TR-DAYAN-${yearMonth}${formattedCounter}`;
      return teklifNo;
    } catch (error) {
      console.error("Counter generation error:", error);
      return null;
    }
  };

  const hasRequiredFields = () => {
    return !!(firma && ilgiliKisi);
  };

  // SETTERS WITH CHANGE FLAG
  const setFirmaWithChange = (v: string) => { setFirma(v); setFormChanged(true); };
  const setIlgiliKisiWithChange = (v: string) => { setIlgiliKisi(v); setFormChanged(true); };
  const setTelWithChange = (v: string) => { setTel(v); setFormChanged(true); };
  const setEmailWithChange = (v: string) => { setEmail(v); setFormChanged(true); };
  const setKonuWithChange = (v: string) => { setKonu(v); setFormChanged(true); };
  const setNotlarWithChange = (v: string) => { setNotlar(v); setFormChanged(true); };
  const setOpsiyonWithChange = (v: string) => { setOpsiyon(v); setFormChanged(true); };
  const setTeslimSuresiWithChange = (v: string) => { setTeslimSuresi(v); setFormChanged(true); };
  const setOdemeSekliWithChange = (v: string) => { setOdemeSekli(v); setFormChanged(true); };
  const setTeslimYeriWithChange = (v: string) => { setTeslimYeri(v); setFormChanged(true); };

  return {
    firma, ilgiliKisi, tel, email, konu,
    setFirma: setFirmaWithChange,
    setIlgiliKisi: setIlgiliKisiWithChange,
    setTel: setTelWithChange,
    setEmail: setEmailWithChange,
    setKonu: setKonuWithChange,

    products, activeCurrency,
    addRow, removeRow, updateProduct,
    handleCurrencyChange,

    notlar, opsiyon, teslimSuresi, odemeSekli, teslimYeri,
    setNotlar: setNotlarWithChange,
    setOpsiyon: setOpsiyonWithChange,
    setTeslimSuresi: setTeslimSuresiWithChange,
    setOdemeSekli: setOdemeSekliWithChange,
    setTeslimYeri: setTeslimYeriWithChange,

    calculateRowTotal, calculateSubtotal, calculateKDV, calculateTotal,
    formatCurrency, formatName,

    currentTeklifNo, setCurrentTeklifNo,
    formChanged, getOrGenerateTeklifNo,
    markFormFinalized, setLastFinalizedTeklifNo,

    hasRequiredFields,

    // 👇 BİZİM DESTEĞİMİZ
    loadQuotationByNo
  };
}
