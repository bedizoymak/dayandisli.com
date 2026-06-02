import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, MapPin, Package, User, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { supabase } from '@/integrations/supabase/client';
import { CartDrawer } from '../components';
import { fetchCustomerOrders } from '../api';
import { CustomerProfile, Order, ORDER_STATUS_LABELS } from '../types';
import { formatPrice } from '../utils';

const PROFILE_STORAGE_KEY = 'dayan_shop_customer_profile';

export function CustomerPortalPage() {
  const [email, setEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<Partial<CustomerProfile>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (stored) {
      try {
        setProfile(JSON.parse(stored));
      } catch {
        setProfile({});
      }
    }

    supabase.auth.getUser().then(async ({ data }) => {
      const sessionEmail = data.user?.email ?? null;
      setEmail(sessionEmail);
      const customerEmail = sessionEmail || readStoredEmail();
      setOrders(customerEmail ? await fetchCustomerOrders(customerEmail) : []);
      setLoading(false);
    });
  }, []);

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-navy/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link to="/shop"><ArrowLeft className="h-5 w-5" /></Link>
              </Button>
              <h1 className="text-xl font-bold text-foreground">Hesabım</h1>
            </div>
            <CartDrawer />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <Tabs defaultValue="orders" className="space-y-6">
          <TabsList className="grid w-full grid-cols-4">
            <TabsTrigger value="orders">Siparişlerim</TabsTrigger>
            <TabsTrigger value="addresses">Adreslerim</TabsTrigger>
            <TabsTrigger value="profile">Profil Bilgilerim</TabsTrigger>
            <TabsTrigger value="future">Hazırlık</TabsTrigger>
          </TabsList>

          <TabsContent value="orders">
            <Card className="border-border bg-card">
              <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Siparişlerim</CardTitle></CardHeader>
              <CardContent>
                {loading ? (
                  <div className="flex justify-center py-12"><Loader2 className="h-6 w-6 animate-spin text-primary" /></div>
                ) : orders.length === 0 ? (
                  <Empty text="Henüz görüntülenecek sipariş bulunmuyor." />
                ) : (
                  <div className="space-y-3">
                    {orders.map((order) => (
                      <div key={order.id} className="rounded-lg border border-border p-4">
                        <div className="flex flex-col gap-3 md:flex-row md:items-center md:justify-between">
                          <div>
                            <p className="font-semibold text-foreground">{order.order_number}</p>
                            <p className="text-sm text-muted-foreground">{new Date(order.created_at).toLocaleDateString('tr-TR')}</p>
                          </div>
                          <div className="flex flex-wrap items-center gap-2">
                            <Badge>{ORDER_STATUS_LABELS[order.status]}</Badge>
                            <Badge variant="outline">{order.shipping_status === 'shipped' ? 'Kargoda' : 'ERP sürecinde'}</Badge>
                            <span className="font-semibold text-primary">{formatPrice(order.grand_total, order.currency)}</span>
                          </div>
                        </div>
                        {order.tracking_number ? <p className="mt-3 text-sm text-muted-foreground">Takip No: {order.tracking_number}</p> : null}
                      </div>
                    ))}
                  </div>
                )}
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="addresses">
            <Card className="border-border bg-card">
              <CardHeader><CardTitle className="flex items-center gap-2"><MapPin className="h-5 w-5" /> Adreslerim</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <InfoBlock title="Fatura Adresi" value={profile.billingAddress} />
                <InfoBlock title="Teslimat Adresi" value={profile.shippingAddress} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="profile">
            <Card className="border-border bg-card">
              <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Profil Bilgilerim</CardTitle></CardHeader>
              <CardContent className="grid gap-4 md:grid-cols-2">
                <InfoBlock title="Ad Soyad" value={profile.customerName} />
                <InfoBlock title="Firma" value={profile.companyName} />
                <InfoBlock title="E-posta" value={email || profile.email} />
                <InfoBlock title="Telefon" value={profile.phone} />
              </CardContent>
            </Card>
          </TabsContent>

          <TabsContent value="future">
            <Card className="border-border bg-card">
              <CardHeader><CardTitle className="flex items-center gap-2"><WalletCards className="h-5 w-5" /> Gelecek Hizmetler</CardTitle></CardHeader>
              <CardContent className="grid gap-3 md:grid-cols-3">
                <InfoBlock title="Faturalar" value="ERP fatura bağlantısı için hazır." />
                <InfoBlock title="Destek Talepleri" value="CRM destek süreci için hazır." />
                <InfoBlock title="İade Talepleri" value="İade operasyonu için hazır." />
              </CardContent>
            </Card>
          </TabsContent>
        </Tabs>
      </main>
    </div>
  );
}

function InfoBlock({ title, value }: { title: string; value?: string | null }) {
  return <div className="rounded-lg border border-border p-4"><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 whitespace-pre-line font-medium text-foreground">{value || 'Henüz kayıt yok'}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">{text}</div>;
}

function readStoredEmail() {
  const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
  if (!stored) return null;
  try {
    return JSON.parse(stored).email || null;
  } catch {
    return null;
  }
}
