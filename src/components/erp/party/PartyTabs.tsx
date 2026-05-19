import { FileText, ReceiptText, ShoppingBag } from "lucide-react";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { EmptyState } from "@/components/erp/EmptyState";
import { FinanceTransactionTable } from "@/components/erp/finance/FinanceTransactionTable";
import { PaymentDocumentTable } from "@/components/erp/finance/PaymentDocumentTable";
import type { FinancialTransaction, Party, PartyNote, PaymentDocument } from "@/lib/finance/financeTypes";

type PartyTabsProps = {
  party: Party;
  mode: "customer" | "supplier";
  transactions: FinancialTransaction[];
  payments: PaymentDocument[];
  notes: PartyNote[];
};

export function PartyTabs({ party, mode, transactions, payments, notes }: PartyTabsProps) {
  return (
    <Tabs defaultValue="general" className="space-y-4">
      <TabsList className="flex h-auto flex-wrap justify-start">
        <TabsTrigger value="general">Genel Bilgiler</TabsTrigger>
        <TabsTrigger value="orders">{mode === "customer" ? "Siparişler" : "Satın Alma/Siparişler"}</TabsTrigger>
        {mode === "customer" ? <TabsTrigger value="quotations">Teklifler</TabsTrigger> : null}
        <TabsTrigger value="transactions">Finans Hareketleri</TabsTrigger>
        <TabsTrigger value="payments">Ödemeler</TabsTrigger>
        <TabsTrigger value="notes">Notlar</TabsTrigger>
      </TabsList>

      <TabsContent value="general">
        <Card>
          <CardHeader>
            <CardTitle>Cari Kart</CardTitle>
          </CardHeader>
          <CardContent className="grid gap-4 text-sm md:grid-cols-2">
            <Info label={mode === "customer" ? "Firma Ünvanı" : "Tedarikçi Ünvanı"} value={party.title} />
            <Info label="Kişi Tipi" value={party.entity_type === "company" ? "Firma" : "Şahıs"} />
            <Info label="TC/VKN" value={party.tax_or_identity_no} />
            <Info label="Vergi Dairesi" value={party.tax_office} />
            <Info label="İlgili Kişi" value={party.contact_name} />
            <Info label="Telefon" value={party.phone} />
            <Info label="Email" value={party.email} />
            <Info label="Web Sitesi" value={party.website} />
            <Info label="İl/İlçe" value={[party.city, party.district].filter(Boolean).join(" / ")} />
            <Info label="Ödeme Vadesi" value={`${party.payment_term_days || 0} gün`} />
            <Info label="Adres" value={party.address} wide />
            <Info label="Notlar" value={party.notes} wide />
          </CardContent>
        </Card>
      </TabsContent>

      <TabsContent value="orders">
        <EmptyState
          icon={<ShoppingBag className="h-5 w-5" />}
          title={mode === "customer" ? "Sipariş bağlantıları hazırlanıyor" : "Satın alma bağlantıları hazırlanıyor"}
          description="Mevcut sipariş verileri korunuyor. Cari kart ile sipariş ilişkisi netleştirildiğinde bu sekme canlı kayıtları gösterecek."
        />
      </TabsContent>

      {mode === "customer" ? (
        <TabsContent value="quotations">
          <EmptyState
            icon={<FileText className="h-5 w-5" />}
            title="Teklif bağlantıları hazırlanıyor"
            description="Mevcut teklif ve PDF akışı korunur. Cari kartlar teklif sistemine güvenli şekilde bağlandığında bu sekme otomatik dolacak."
          />
        </TabsContent>
      ) : null}

      <TabsContent value="transactions">
        {transactions.length ? (
          <FinanceTransactionTable transactions={transactions} />
        ) : (
          <EmptyState
            icon={<ReceiptText className="h-5 w-5" />}
            title="Finans hareketi yok"
            description="Bu cari kart için henüz finans hareketi kaydedilmemiş."
          />
        )}
      </TabsContent>

      <TabsContent value="payments">
        {payments.length ? (
          <PaymentDocumentTable documents={payments} />
        ) : (
          <EmptyState title="Ödeme dokümanı yok" description="Bu cari kart için çek, senet veya ödeme dokümanı bulunmuyor." />
        )}
      </TabsContent>

      <TabsContent value="notes">
        {notes.length ? (
          <Card>
            <CardContent className="space-y-3 pt-6">
              {notes.map((note) => (
                <div key={note.id} className="rounded-md border p-3">
                  <p className="text-sm">{note.note}</p>
                  <p className="mt-2 text-xs text-muted-foreground">{new Intl.DateTimeFormat("tr-TR").format(new Date(note.created_at))}</p>
                </div>
              ))}
            </CardContent>
          </Card>
        ) : (
          <EmptyState title="Not bulunmuyor" description="Bu cari karta ait not eklenmemiş." />
        )}
      </TabsContent>
    </Tabs>
  );
}

function Info({ label, value, wide = false }: { label: string; value?: string | null; wide?: boolean }) {
  return (
    <div className={wide ? "md:col-span-2" : ""}>
      <p className="text-muted-foreground">{label}</p>
      <p className="mt-1 font-medium">{value || "-"}</p>
    </div>
  );
}
