import { Link } from "react-router-dom";
import { Eye, FileText, Pencil, PlusCircle, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card } from "@/components/ui/card";
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from "@/components/ui/table";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { formatMoney } from "@/lib/finance/financeLabels";
import type { Party, PartyFinancialSummary } from "@/lib/finance/financeTypes";

type PartyTableProps = {
  parties: Party[];
  summaries: Record<string, PartyFinancialSummary>;
  mode: "customer" | "supplier";
};

function cityDistrict(party: Party) {
  return [party.city, party.district].filter(Boolean).join(" / ") || "-";
}

function lastTransaction(summary?: PartyFinancialSummary) {
  if (!summary?.lastTransactionDate) return "-";
  return new Intl.DateTimeFormat("tr-TR").format(new Date(summary.lastTransactionDate));
}

function routeBase(mode: "customer" | "supplier") {
  return mode === "customer" ? "/musteriler" : "/tedarikciler";
}

export function PartyTable({ parties, summaries, mode }: PartyTableProps) {
  return (
    <Card className="overflow-hidden border-border/70">
      <Table>
        <TableHeader>
          <TableRow>
            <TableHead>{mode === "customer" ? "Firma Ünvanı" : "Tedarikçi Ünvanı"}</TableHead>
            <TableHead>İlgili Kişi</TableHead>
            <TableHead>TC/VKN</TableHead>
            <TableHead>Telefon</TableHead>
            <TableHead>Email</TableHead>
            <TableHead>Şehir/İlçe</TableHead>
            <TableHead>Bakiye</TableHead>
            <TableHead>Son İşlem</TableHead>
            <TableHead>Kaynak</TableHead>
            <TableHead>Durum</TableHead>
            <TableHead className="text-right">Aksiyonlar</TableHead>
          </TableRow>
        </TableHeader>
        <TableBody>
          {parties.map((party) => {
            const summary = summaries[party.id];
            return (
              <TableRow key={party.id}>
                <TableCell className="font-medium">{party.title}</TableCell>
                <TableCell>{party.contact_name || "-"}</TableCell>
                <TableCell>{party.tax_or_identity_no || "-"}</TableCell>
                <TableCell>{party.phone || "-"}</TableCell>
                <TableCell>{party.email || "-"}</TableCell>
                <TableCell>{cityDistrict(party)}</TableCell>
                <TableCell>{formatMoney(summary?.currentBalance || 0, party.currency)}</TableCell>
                <TableCell>{lastTransaction(summary)}</TableCell>
                <TableCell>
                  <Badge variant="outline">{party.source_label === "ERP" || !party.source_label ? "ERP" : party.source_label}</Badge>
                </TableCell>
                <TableCell>
                  <StatusBadge label={party.is_active ? "Aktif" : "Pasif"} tone={party.is_active ? "success" : "muted"} />
                </TableCell>
                <TableCell>
                  <div className="flex justify-end gap-1">
                    <Button asChild variant="ghost" size="icon" title="Görüntüle">
                      <Link to={`${routeBase(mode)}/${party.id}`}>
                        <Eye className="h-4 w-4" />
                      </Link>
                    </Button>
                    <Button asChild variant="ghost" size="icon" title="Düzenle">
                      {party.is_legacy_readonly ? (
                        <span>
                          <Pencil className="h-4 w-4 opacity-40" />
                        </span>
                      ) : (
                        <Link to={`${routeBase(mode)}/${party.id}/duzenle`}>
                          <Pencil className="h-4 w-4" />
                        </Link>
                      )}
                    </Button>
                    <Button asChild={!party.is_legacy_readonly} variant="ghost" size="icon" title={party.is_legacy_readonly ? "Finans için ERP cari tabloları gerekir" : "Yeni Finans Hareketi"}>
                      {party.is_legacy_readonly ? (
                        <span>
                          <PlusCircle className="h-4 w-4 opacity-40" />
                        </span>
                      ) : (
                        <Link to={`/finans/hareketler/yeni?partyId=${party.id}`}>
                          <PlusCircle className="h-4 w-4" />
                        </Link>
                      )}
                    </Button>
                    <Button asChild variant="ghost" size="icon" title={mode === "customer" ? "Siparişleri Gör" : "Satın Alma Kayıtları"}>
                      <Link to={mode === "customer" ? "/siparisler" : "/purchase-orders"}>
                        <ShoppingBag className="h-4 w-4" />
                      </Link>
                    </Button>
                    {mode === "customer" ? (
                      <Button asChild variant="ghost" size="icon" title="Teklifleri Gör">
                        <Link to="/teklifler">
                          <FileText className="h-4 w-4" />
                        </Link>
                      </Button>
                    ) : null}
                  </div>
                </TableCell>
              </TableRow>
            );
          })}
        </TableBody>
      </Table>
    </Card>
  );
}
