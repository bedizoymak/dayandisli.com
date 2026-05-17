import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Button } from "@/components/ui/button";
import { useNavigate } from "react-router-dom";
import { Package, FileText, Calculator, ShoppingBag } from "lucide-react";

const apps = [
  {
    title: "Kargo Yönetimi",
    description: "Kargo etiketlerini oluşturun ve PDF indirin",
    route: "/kargo",
    icon: Package,
  },
  {
    title: "Teklif Oluşturucu",
    description: "Müşterilerinize özel teklif PDF'i oluşturun",
    route: "/teklif-sayfasi",
    icon: FileText,
  },
  {
    title: "DAYAN Calculator",
    description: "Dişli hesaplama ve üretim reçetesi oluşturma",
    route: "/apps/calculator",
    icon: Calculator,
  },
  {
    title: "Sipariş Yönetimi",
    description: "E-ticaret siparişlerini görüntüleyin ve yönetin",
    route: "/apps/shop-orders",
    icon: ShoppingBag,
  },
];

export default function Apps() {
  const navigate = useNavigate();

  return (
    <div className="min-h-screen bg-background p-6 md:p-12">
      <div className="max-w-4xl mx-auto">
        <div className="text-center mb-10">
          <h1 className="text-3xl md:text-4xl font-bold text-foreground mb-2">
            Uygulamalar
          </h1>
          <p className="text-muted-foreground text-lg">
            Kullanmak istediğiniz uygulamayı seçin
          </p>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          {apps.map((app) => (
            <Card key={app.route} className="hover:shadow-lg transition-shadow">
              <CardHeader className="text-center">
                <div className="mx-auto mb-4 p-4 rounded-full bg-primary/10">
                  <app.icon className="h-10 w-10 text-primary" />
                </div>
                <CardTitle>{app.title}</CardTitle>
                <CardDescription>{app.description}</CardDescription>
              </CardHeader>
              <CardContent className="text-center">
                <Button onClick={() => navigate(app.route)}>Aç</Button>
              </CardContent>
            </Card>
          ))}
        </div>
      </div>
    </div>
  );
}
