import { useEffect, useMemo, useState } from "react";
import { Link } from "react-router-dom";
import { Building2, Plus, Search, SlidersHorizontal } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/erp/EmptyState";
import { FilterDrawer } from "@/components/erp/FilterDrawer";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { ViewToggle, type ViewMode } from "@/components/erp/ViewToggle";
import { PartyCard } from "@/components/erp/party/PartyCard";
import { PartyTable } from "@/components/erp/party/PartyTable";
import { ERPLayout } from "@/features/erp/layout/ERPLayout";
import type { AccountType, Party, PartyFinancialSummary } from "@/lib/finance/financeTypes";
import { getParties, getPartyFinancialSummary } from "@/services/partiesService";

type PartyDirectoryPageProps = {
  mode: "customer" | "supplier";
};

type BalanceFilter = "all" | "receivable" | "payable" | "zero";

const emptySummary: PartyFinancialSummary = {
  totalDebit: 0,
  totalCredit: 0,
  totalPayment: 0,
  currentBalance: 0,
  officialBalance: 0,
  operationalBalance: 0,
  lastTransactionDate: null,
  statusLabel: "Kapalı",
};

export default function PartyDirectoryPage({ mode }: PartyDirectoryPageProps) {
  const [parties, setParties] = useState<Party[]>([]);
  const [summaries, setSummaries] = useState<Record<string, PartyFinancialSummary>>({});
  const [viewMode, setViewMode] = useState<ViewMode>("table");
  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<"all" | "active" | "passive">("all");
  const [accountFilter, setAccountFilter] = useState<AccountType | "all">("all");
  const [balanceFilter, setBalanceFilter] = useState<BalanceFilter>("all");
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const title = mode === "customer" ? "Müşteriler" : "Tedarikçiler";
  const description =
    mode === "customer"
      ? "Müşteri cari kartları, iletişim bilgileri ve finans bakiyeleri."
      : "Tedarikçi kartları, satın alma ilişkileri ve ödeme takibi.";
  const newPath = mode === "customer" ? "/erp/musteriler/yeni" : "/erp/tedarikciler/yeni";

  useEffect(() => {
    const load = async () => {
      setLoading(true);
      const result = await getParties({
        type: mode,
        search,
        active: activeFilter,
        accountType: accountFilter,
      });

      setParties(result.data);
      setError(result.error);

      if (result.data.length) {
        const summaryRows = await Promise.all(
          result.data.map(async (party) => {
            const summary = await getPartyFinancialSummary(party.id);
            return [party.id, summary.data] as const;
          }),
        );
        setSummaries(Object.fromEntries(summaryRows));
      } else {
        setSummaries({});
      }

      setLoading(false);
    };

    load();
  }, [accountFilter, activeFilter, mode, search]);

  const filteredParties = useMemo(() => {
    return parties.filter((party) => {
      const summary = summaries[party.id] || emptySummary;
      if (balanceFilter === "receivable") return summary.currentBalance > 0;
      if (balanceFilter === "payable") return summary.currentBalance < 0;
      if (balanceFilter === "zero") return summary.currentBalance === 0;
      return true;
    });
  }, [balanceFilter, parties, summaries]);

  return (
    <ERPLayout title={title}>
      <PageHeader
        title={title}
        description={description}
        actions={
          <Button asChild className="gap-2">
            <Link to={newPath}>
              <Plus className="h-4 w-4" />
              Yeni {mode === "customer" ? "Müşteri" : "Tedarikçi"}
            </Link>
          </Button>
        }
      />

      {error ? <MigrationNotice message={error} /> : null}

      <Card>
        <CardContent className="grid gap-3 pt-6 lg:grid-cols-[minmax(240px,1fr)_160px_190px_190px_auto_auto]">
          <div className="relative">
            <Search className="pointer-events-none absolute left-3 top-1/2 h-4 w-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              className="pl-9"
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder={mode === "customer" ? "Firma, kişi, telefon, email, TC/VKN ara" : "Tedarikçi, kişi, telefon, email, TC/VKN ara"}
            />
          </div>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={activeFilter} onChange={(event) => setActiveFilter(event.target.value as typeof activeFilter)}>
            <option value="all">Aktif / Pasif</option>
            <option value="active">Aktif</option>
            <option value="passive">Pasif</option>
          </select>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={accountFilter} onChange={(event) => setAccountFilter(event.target.value as AccountType | "all")}>
            <option value="all">Tüm hesaplar</option>
            <option value="official">Resmi Hesap</option>
            <option value="operational">Operasyonel Takip</option>
          </select>
          <select className="h-10 rounded-md border border-input bg-background px-3 text-sm" value={balanceFilter} onChange={(event) => setBalanceFilter(event.target.value as BalanceFilter)}>
            <option value="all">Tüm bakiyeler</option>
            <option value="receivable">Alacaklı</option>
            <option value="payable">Borçlu</option>
            <option value="zero">Bakiyesi Sıfır</option>
          </select>
          <FilterDrawer triggerLabel="Son İşlem" />
          <ViewToggle value={viewMode} onChange={setViewMode} />
        </CardContent>
      </Card>

      {loading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Kayıtlar yükleniyor...</CardContent>
        </Card>
      ) : filteredParties.length ? (
        viewMode === "table" ? (
          <PartyTable parties={filteredParties} summaries={summaries} mode={mode} />
        ) : (
          <div className="grid gap-4 md:grid-cols-2 xl:grid-cols-3">
            {filteredParties.map((party) => (
              <PartyCard key={party.id} party={party} summary={summaries[party.id]} mode={mode} />
            ))}
          </div>
        )
      ) : (
        <EmptyState
          icon={<Building2 className="h-5 w-5" />}
          title={mode === "customer" ? "Müşteri kaydı bulunamadı" : "Tedarikçi kaydı bulunamadı"}
          description="Filtreleri temizleyebilir veya yeni bir cari kart oluşturabilirsiniz."
          action={
            <Button asChild className="gap-2">
              <Link to={newPath}>
                <Plus className="h-4 w-4" />
                Yeni {mode === "customer" ? "Müşteri" : "Tedarikçi"}
              </Link>
            </Button>
          }
        />
      )}
    </ERPLayout>
  );
}
