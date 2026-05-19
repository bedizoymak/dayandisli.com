import { Link } from "react-router-dom";
import { Eye, FileText, Pencil, PlusCircle, ShoppingBag } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { ACCOUNT_TYPE_LABELS, formatMoney } from "@/lib/finance/financeLabels";
import type { Party, PartyFinancialSummary } from "@/lib/finance/financeTypes";

type PartyCardProps = {
  party: Party;
  summary?: PartyFinancialSummary;
  mode: "customer" | "supplier";
};

function routeBase(mode: "customer" | "supplier") {
  return mode === "customer" ? "/erp/musteriler" : "/erp/tedarikciler";
}

export function PartyCard({ party, summary, mode }: PartyCardProps) {
  return (
    <Card className="border-border/70">
      <CardHeader className="space-y-3">
        <div className="flex items-start justify-between gap-3">
          <div className="min-w-0">
            <CardTitle className="truncate text-lg">{party.title}</CardTitle>
            <p className="mt-1 text-sm text-muted-foreground">{party.contact_name || "İlgili kişi girilmemiş"}</p>
          </div>
          <StatusBadge label={party.is_active ? "Aktif" : "Pasif"} tone={party.is_active ? "success" : "muted"} />
        </div>
        <Badge variant="outline" className="w-fit">
          Kaynak: {party.source_label === "ERP" || !party.source_label ? "ERP" : party.source_label}
        </Badge>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="grid grid-cols-2 gap-3 text-sm">
          <div>
            <p className="text-muted-foreground">TC/VKN</p>
            <p className="font-medium">{party.tax_or_identity_no || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Hesap</p>
            <p className="font-medium">{ACCOUNT_TYPE_LABELS[party.default_account_type]}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Telefon</p>
            <p className="font-medium">{party.phone || "-"}</p>
          </div>
          <div>
            <p className="text-muted-foreground">Bakiye</p>
            <p className="font-medium">{formatMoney(summary?.currentBalance || 0, party.currency)}</p>
          </div>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to={`${routeBase(mode)}/${party.id}`}>
              <Eye className="h-4 w-4" />
              Görüntüle
            </Link>
          </Button>
          {party.is_legacy_readonly ? (
            <Button variant="outline" size="sm" className="gap-2" disabled>
              <Pencil className="h-4 w-4" />
              Düzenle
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to={`${routeBase(mode)}/${party.id}/duzenle`}>
                <Pencil className="h-4 w-4" />
                Düzenle
              </Link>
            </Button>
          )}
          {party.is_legacy_readonly ? (
            <Button variant="outline" size="sm" className="gap-2" disabled>
              <PlusCircle className="h-4 w-4" />
              Finans
            </Button>
          ) : (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to={`/erp/finans/hareketler/yeni?partyId=${party.id}`}>
                <PlusCircle className="h-4 w-4" />
                Finans
              </Link>
            </Button>
          )}
          <Button asChild variant="outline" size="sm" className="gap-2">
            <Link to={mode === "customer" ? "/erp/siparisler" : "/erp/purchase-orders"}>
              <ShoppingBag className="h-4 w-4" />
              {mode === "customer" ? "Siparişler" : "Satın Alma"}
            </Link>
          </Button>
          {mode === "customer" ? (
            <Button asChild variant="outline" size="sm" className="gap-2">
              <Link to="/erp/teklifler">
                <FileText className="h-4 w-4" />
                Teklifler
              </Link>
            </Button>
          ) : null}
        </div>
      </CardContent>
    </Card>
  );
}
