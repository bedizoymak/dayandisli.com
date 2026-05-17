import { useSearchParams, Link } from 'react-router-dom';
import { CheckCircle, ArrowRight } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent } from '@/components/ui/card';

export function CheckoutSuccessPage() {
  const [searchParams] = useSearchParams();
  const orderNumber = searchParams.get('order') || '';

  return (
    <div className="min-h-screen bg-background flex items-center justify-center p-4">
      <Card className="bg-card border-border max-w-md w-full">
        <CardContent className="pt-8 pb-8 text-center space-y-6">
          <div className="w-20 h-20 mx-auto bg-green-500/20 rounded-full flex items-center justify-center">
            <CheckCircle className="w-10 h-10 text-green-500" />
          </div>
          
          <div className="space-y-2">
            <h1 className="text-2xl font-bold text-foreground">Siparişiniz Alındı!</h1>
            <p className="text-muted-foreground">Teşekkür ederiz. Siparişiniz başarıyla oluşturuldu.</p>
          </div>

          {orderNumber && (
            <div className="bg-muted rounded-lg p-4">
              <p className="text-sm text-muted-foreground">Sipariş Numarası</p>
              <p className="text-xl font-bold text-primary">{orderNumber}</p>
            </div>
          )}

          <p className="text-sm text-muted-foreground">
            Ödeme ve teslimat detayları için sizinle e-posta veya telefon ile iletişime geçeceğiz.
          </p>

          <Button asChild className="w-full">
            <Link to="/shop">
              Alışverişe Devam Et
              <ArrowRight className="w-4 h-4 ml-2" />
            </Link>
          </Button>
        </CardContent>
      </Card>
    </div>
  );
}
