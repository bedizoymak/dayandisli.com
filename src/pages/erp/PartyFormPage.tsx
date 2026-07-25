import { useEffect, useState } from "react";
import { Link, useNavigate, useParams } from "react-router-dom";
import { ArrowLeft } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { EmptyState } from "@/components/erp/EmptyState";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { PartyForm } from "@/components/erp/party/PartyForm";
import { ERPLayout } from "@/features/erp/layout/ERPLayout";
import { useToast } from "@/hooks/use-toast";
import type { Party } from "@/lib/finance/financeTypes";
import { createParty, getPartyById, type PartyPayload, updateParty } from "@/services/partiesService";

type PartyFormPageProps = {
  mode: "customer" | "supplier";
};

export default function PartyFormPage({ mode }: PartyFormPageProps) {
  const { id } = useParams();
  const navigate = useNavigate();
  const { toast } = useToast();
  const [party, setParty] = useState<Party | null>(null);
  const [loading, setLoading] = useState(Boolean(id));
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const basePath = mode === "customer" ? "/musteriler" : "/tedarikciler";
  const pageTitle = id
    ? mode === "customer"
      ? "Müşteri Düzenle"
      : "Tedarikçi Düzenle"
    : mode === "customer"
    ? "Yeni Müşteri"
    : "Yeni Tedarikçi";

  useEffect(() => {
    if (!id) return;
    const load = async () => {
      setLoading(true);
      const result = await getPartyById(id);
      setParty(result.data);
      setError(result.error);
      setLoading(false);
    };
    load();
  }, [id]);

  const handleSubmit = async (payload: PartyPayload) => {
    setSaving(true);
    const result = id ? await updateParty(id, payload) : await createParty(payload);
    setSaving(false);

    if (result.error || !result.data) {
      toast({ title: "Kayıt Hatası", description: result.error || "Cari kart kaydedilemedi.", variant: "destructive" });
      return;
    }

    toast({ title: "Kaydedildi", description: mode === "customer" ? "Müşteri kartı kaydedildi." : "Tedarikçi kartı kaydedildi." });
    navigate(`${basePath}/${result.data.id}`);
  };

  return (
    <ERPLayout title={pageTitle}>
      <PageHeader
        title={pageTitle}
        description={mode === "customer" ? "Müşteri cari kart bilgilerini yönetin." : "Tedarikçi cari kart bilgilerini yönetin."}
        actions={
          <Button asChild variant="outline" className="gap-2">
            <Link to={id ? `${basePath}/${id}` : basePath}>
              <ArrowLeft className="h-4 w-4" />
              Geri
            </Link>
          </Button>
        }
      />

      {error ? <MigrationNotice message={error} /> : null}

      {loading ? (
        <Card>
          <CardContent className="py-8 text-sm text-muted-foreground">Cari kart yükleniyor...</CardContent>
        </Card>
      ) : id && !party ? (
        <EmptyState title="Cari kart bulunamadı" description="Kayıt silinmiş, pasifleştirilmiş veya erişim izniniz olmayabilir." />
      ) : (
        <PartyForm mode={mode} initialParty={party} loading={saving} onSubmit={handleSubmit} />
      )}
    </ERPLayout>
  );
}
