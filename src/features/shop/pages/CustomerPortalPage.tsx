import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, LogOut, MapPin, Package, User, WalletCards } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Badge } from '@/components/ui/badge';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { useToast } from '@/hooks/use-toast';
import { supabase } from '@/integrations/supabase/client';
import { CartDrawer } from '../components';
import { fetchCustomerOrders, getCurrentCustomerProfile, signInCustomer, signOutCustomer, signUpCustomer, upsertCustomerProfile } from '../api';
import { CustomerProfile, Order, ORDER_STATUS_LABELS } from '../types';
import { formatPrice } from '../utils';

export function CustomerPortalPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [profile, setProfile] = useState<Partial<CustomerProfile>>({});
  const [authForm, setAuthForm] = useState({ fullName: '', email: '', password: '' });
  const [loading, setLoading] = useState(true);
  const [authMode, setAuthMode] = useState<'login' | 'signup'>('login');
  const [authLoading, setAuthLoading] = useState(false);

  useEffect(() => {
    loadPortal();
  }, []);

  const loadPortal = async () => {
    setLoading(true);
    const { data } = await supabase.auth.getUser();
    const sessionEmail = data.user?.email ?? null;
    setEmail(sessionEmail);
    if (sessionEmail) {
      const [customerProfile, customerOrders] = await Promise.all([
        getCurrentCustomerProfile(),
        fetchCustomerOrders(),
      ]);
      setProfile(customerProfile ?? { email: sessionEmail, customerName: data.user?.user_metadata?.full_name || '' });
      setOrders(customerOrders);
    } else {
      setProfile({});
      setOrders([]);
    }
    setLoading(false);
  };

  const submitAuth = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    setAuthLoading(true);
    try {
      const result = authMode === 'signup'
        ? await signUpCustomer(authForm.email, authForm.password, authForm.fullName || authForm.email)
        : await signInCustomer(authForm.email, authForm.password);
      if (result.error) throw result.error;
      toast({
        title: authMode === 'signup' ? 'Hesap oluşturuldu' : 'Giriş yapıldı',
        description: authMode === 'signup' ? 'E-posta doğrulaması gerekiyorsa lütfen gelen kutunuzu kontrol edin.' : 'Müşteri hesabınız açıldı.',
      });
      await loadPortal();
    } catch (error) {
      console.error('Customer auth error:', error);
      toast({ title: 'Hesap Hatası', description: 'İşlem tamamlanamadı. Bilgileri kontrol edip tekrar deneyin.', variant: 'destructive' });
    } finally {
      setAuthLoading(false);
    }
  };

  const saveProfile = async () => {
    try {
      await upsertCustomerProfile({
        customerName: profile.customerName || '',
        companyName: profile.companyName || '',
        email: email || profile.email || '',
        phone: profile.phone || '',
        billingAddress: profile.billingAddress || '',
        shippingAddress: profile.shippingAddress || '',
        shippingMethod: 'company_shipping',
        notes: '',
      });
      toast({ title: 'Profil Kaydedildi', description: 'Müşteri bilgileriniz güncellendi.' });
      await loadPortal();
    } catch (error) {
      console.error('Profile save error:', error);
      toast({ title: 'Kayıt Hatası', description: 'Profil bilgileri kaydedilemedi.', variant: 'destructive' });
    }
  };

  const logout = async () => {
    await signOutCustomer();
    await loadPortal();
  };

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
            <div className="flex items-center gap-2">
              {email ? <Button variant="ghost" size="sm" onClick={logout}><LogOut className="mr-2 h-4 w-4" />Çıkış</Button> : null}
              <CartDrawer />
            </div>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex justify-center py-20"><Loader2 className="h-8 w-8 animate-spin text-primary" /></div>
        ) : !email ? (
          <Card className="mx-auto max-w-md border-border bg-card">
            <CardHeader><CardTitle>{authMode === 'login' ? 'Müşteri Girişi' : 'Yeni Müşteri Hesabı'}</CardTitle></CardHeader>
            <CardContent>
              <form onSubmit={submitAuth} className="space-y-4">
                {authMode === 'signup' ? <Field label="Ad Soyad"><Input value={authForm.fullName} onChange={(event) => setAuthForm((current) => ({ ...current, fullName: event.target.value }))} /></Field> : null}
                <Field label="E-posta"><Input required type="email" value={authForm.email} onChange={(event) => setAuthForm((current) => ({ ...current, email: event.target.value }))} /></Field>
                <Field label="Şifre"><Input required type="password" minLength={6} value={authForm.password} onChange={(event) => setAuthForm((current) => ({ ...current, password: event.target.value }))} /></Field>
                <Button className="w-full" type="submit" disabled={authLoading}>{authLoading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}{authMode === 'login' ? 'Giriş Yap' : 'Hesap Oluştur'}</Button>
              </form>
              <Button variant="link" className="mt-3 w-full" onClick={() => setAuthMode((current) => current === 'login' ? 'signup' : 'login')}>
                {authMode === 'login' ? 'Yeni hesap oluştur' : 'Zaten hesabım var'}
              </Button>
            </CardContent>
          </Card>
        ) : (
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
                  {orders.length === 0 ? <Empty text="Henüz görüntülenecek sipariş bulunmuyor." /> : (
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
                              <Badge variant="outline">{shippingLabel(order.shipping_status)}</Badge>
                              <Badge variant="secondary">{reservationLabel(order.inventory_reservation_status)}</Badge>
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
                <CardContent className="space-y-4">
                  <Field label="Fatura Adresi"><Textarea rows={4} value={profile.billingAddress || ''} onChange={(event) => setProfile((current) => ({ ...current, billingAddress: event.target.value }))} /></Field>
                  <Field label="Teslimat Adresi"><Textarea rows={4} value={profile.shippingAddress || ''} onChange={(event) => setProfile((current) => ({ ...current, shippingAddress: event.target.value }))} /></Field>
                  <Button onClick={saveProfile}>Adresleri Kaydet</Button>
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="profile">
              <Card className="border-border bg-card">
                <CardHeader><CardTitle className="flex items-center gap-2"><User className="h-5 w-5" /> Profil Bilgilerim</CardTitle></CardHeader>
                <CardContent className="grid gap-4 md:grid-cols-2">
                  <Field label="Ad Soyad"><Input value={profile.customerName || ''} onChange={(event) => setProfile((current) => ({ ...current, customerName: event.target.value }))} /></Field>
                  <Field label="Firma"><Input value={profile.companyName || ''} onChange={(event) => setProfile((current) => ({ ...current, companyName: event.target.value }))} /></Field>
                  <Field label="E-posta"><Input disabled value={email} /></Field>
                  <Field label="Telefon"><Input value={profile.phone || ''} onChange={(event) => setProfile((current) => ({ ...current, phone: event.target.value }))} /></Field>
                  <div className="md:col-span-2"><Button onClick={saveProfile}>Profili Kaydet</Button></div>
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
        )}
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function InfoBlock({ title, value }: { title: string; value?: string | null }) {
  return <div className="rounded-lg border border-border p-4"><p className="text-sm text-muted-foreground">{title}</p><p className="mt-2 whitespace-pre-line font-medium text-foreground">{value || 'Henüz kayıt yok'}</p></div>;
}

function Empty({ text }: { text: string }) {
  return <div className="rounded-lg border border-dashed border-border p-8 text-center text-muted-foreground">{text}</div>;
}

function shippingLabel(status?: string | null) {
  if (status === 'shipped') return 'Kargoda';
  if (status === 'delivered') return 'Teslim Edildi';
  if (status === 'preparing') return 'Hazırlanıyor';
  return 'ERP sürecinde';
}

function reservationLabel(status?: string | null) {
  if (status === 'reserved') return 'Stok Ayrıldı';
  if (status === 'partial') return 'Kısmi Stok';
  if (status === 'failed') return 'Stok Bekliyor';
  return 'Stok Kontrolü';
}
