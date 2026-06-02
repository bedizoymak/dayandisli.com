import { FormEvent, useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Bell, Loader2, LogOut, MapPin, Package, RotateCcw, Truck, User } from 'lucide-react';
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
import { createCustomerReturnRequest, fetchCustomerNotifications, fetchCustomerOrderDetails, fetchCustomerOrders, getCurrentCustomerProfile, signInCustomer, signOutCustomer, signUpCustomer, upsertCustomerProfile } from '../api';
import { CustomerNotification, CustomerOrderDetails, CustomerProfile, FULFILLMENT_STATUS_LABELS, Order, ORDER_STATUS_LABELS, PAYMENT_STATUS_LABELS, ReturnRequest } from '../types';
import { formatPrice } from '../utils';

export function CustomerPortalPage() {
  const { toast } = useToast();
  const [email, setEmail] = useState<string | null>(null);
  const [orders, setOrders] = useState<Order[]>([]);
  const [selectedOrder, setSelectedOrder] = useState<CustomerOrderDetails | null>(null);
  const [notifications, setNotifications] = useState<CustomerNotification[]>([]);
  const [returnReason, setReturnReason] = useState('');
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
      const [customerProfile, customerOrders, customerNotifications] = await Promise.all([
        getCurrentCustomerProfile(),
        fetchCustomerOrders(),
        fetchCustomerNotifications(),
      ]);
      setProfile(customerProfile ?? { email: sessionEmail, customerName: data.user?.user_metadata?.full_name || '' });
      setOrders(customerOrders);
      setNotifications(customerNotifications);
      if (customerOrders[0]) {
        setSelectedOrder(await fetchCustomerOrderDetails(customerOrders[0].id));
      } else {
        setSelectedOrder(null);
      }
    } else {
      setProfile({});
      setOrders([]);
      setNotifications([]);
      setSelectedOrder(null);
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

  const openOrder = async (orderId: string) => {
    const details = await fetchCustomerOrderDetails(orderId);
    setSelectedOrder(details);
  };

  const submitReturnRequest = async () => {
    if (!selectedOrder || !returnReason.trim()) return;
    try {
      await createCustomerReturnRequest(selectedOrder.id, returnReason.trim());
      toast({ title: 'İade Talebi Alındı', description: 'Talebiniz ERP incelemesine iletildi.' });
      setReturnReason('');
      await openOrder(selectedOrder.id);
      setNotifications(await fetchCustomerNotifications());
    } catch (error) {
      console.error('Return request error:', error);
      toast({ title: 'İade Hatası', description: 'İade talebi oluşturulamadı.', variant: 'destructive' });
    }
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
            <TabsList className="grid h-auto w-full grid-cols-2 md:grid-cols-7">
              <TabsTrigger value="orders">Siparişlerim</TabsTrigger>
              <TabsTrigger value="detail">Sipariş Detayı</TabsTrigger>
              <TabsTrigger value="shipping">Sevkiyat Takibi</TabsTrigger>
              <TabsTrigger value="returns">İade Talepleri</TabsTrigger>
              <TabsTrigger value="notifications">Bildirimler</TabsTrigger>
              <TabsTrigger value="addresses">Adreslerim</TabsTrigger>
              <TabsTrigger value="profile">Profil</TabsTrigger>
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
                              <Badge variant="outline">{FULFILLMENT_STATUS_LABELS[order.fulfillment_status ?? 'received']}</Badge>
                              <Badge variant="outline">{PAYMENT_STATUS_LABELS[order.payment_status ?? 'pending']}</Badge>
                              <Badge variant="secondary">{reservationLabel(order.inventory_reservation_status)}</Badge>
                              <span className="font-semibold text-primary">{formatPrice(order.grand_total, order.currency)}</span>
                              <Button size="sm" variant="outline" onClick={() => openOrder(order.id)}>Detay</Button>
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

            <TabsContent value="detail">
              <Card className="border-border bg-card">
                <CardHeader><CardTitle className="flex items-center gap-2"><Package className="h-5 w-5" /> Sipariş Detayı</CardTitle></CardHeader>
                <CardContent>
                  {!selectedOrder ? <Empty text="Detay için bir sipariş seçiniz." /> : (
                    <div className="space-y-4">
                      <div className="grid gap-3 md:grid-cols-4">
                        <InfoBlock title="Sipariş" value={selectedOrder.order_number} />
                        <InfoBlock title="Karşılama" value={FULFILLMENT_STATUS_LABELS[selectedOrder.fulfillment_status ?? 'received']} />
                        <InfoBlock title="Ödeme" value={PAYMENT_STATUS_LABELS[selectedOrder.payment_status ?? 'pending']} />
                        <InfoBlock title="Toplam" value={formatPrice(selectedOrder.grand_total, selectedOrder.currency)} />
                      </div>
                      <div className="rounded-lg border border-border">
                        {selectedOrder.items.map((item) => (
                          <div key={item.id} className="flex items-center justify-between border-b border-border px-4 py-3 last:border-b-0">
                            <span>{item.product_name}</span>
                            <span className="text-sm text-muted-foreground">{item.quantity} adet</span>
                          </div>
                        ))}
                      </div>
                      <div className="space-y-2">
                        <h3 className="font-semibold text-foreground">İşlem Geçmişi</h3>
                        {selectedOrder.fulfillmentHistory.length === 0 ? <Empty text="Henüz işlem geçmişi yok." /> : selectedOrder.fulfillmentHistory.map((entry) => (
                          <div key={entry.id} className="rounded-lg border border-border p-3">
                            <p className="font-medium">{FULFILLMENT_STATUS_LABELS[entry.to_status]}</p>
                            <p className="text-sm text-muted-foreground">{entry.description || new Date(entry.created_at).toLocaleString('tr-TR')}</p>
                          </div>
                        ))}
                      </div>
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="shipping">
              <Card className="border-border bg-card">
                <CardHeader><CardTitle className="flex items-center gap-2"><Truck className="h-5 w-5" /> Sevkiyat Takibi</CardTitle></CardHeader>
                <CardContent>
                  {!selectedOrder ? <Empty text="Sevkiyat için bir sipariş seçiniz." /> : selectedOrder.shipments.length === 0 ? <Empty text="Bu sipariş için sevkiyat kaydı henüz oluşmadı." /> : (
                    <div className="space-y-3">
                      {selectedOrder.shipments.map((shipment) => (
                        <InfoBlock key={shipment.id} title={`${shipment.carrier_name || 'Kargo'} - ${shippingLabel(shipment.status)}`} value={shipment.tracking_number ? `Takip No: ${shipment.tracking_number}` : 'Takip numarası bekleniyor'} />
                      ))}
                    </div>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="returns">
              <Card className="border-border bg-card">
                <CardHeader><CardTitle className="flex items-center gap-2"><RotateCcw className="h-5 w-5" /> İade Talepleri</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  {!selectedOrder ? <Empty text="İade için bir sipariş seçiniz." /> : (
                    <>
                      <Field label="İade Nedeni"><Textarea rows={4} value={returnReason} onChange={(event) => setReturnReason(event.target.value)} /></Field>
                      <Button onClick={submitReturnRequest} disabled={!returnReason.trim()}>İade Talebi Gönder</Button>
                      <ReturnList returns={selectedOrder.returnRequests} />
                    </>
                  )}
                </CardContent>
              </Card>
            </TabsContent>

            <TabsContent value="notifications">
              <Card className="border-border bg-card">
                <CardHeader><CardTitle className="flex items-center gap-2"><Bell className="h-5 w-5" /> Bildirim Geçmişi</CardTitle></CardHeader>
                <CardContent>
                  {notifications.length === 0 ? <Empty text="Bildirim kaydı bulunmuyor." /> : (
                    <div className="space-y-3">
                      {notifications.map((notification) => (
                        <div key={notification.id} className="rounded-lg border border-border p-4">
                          <p className="font-semibold text-foreground">{notification.title}</p>
                          <p className="text-sm text-muted-foreground">{notification.message || new Date(notification.created_at).toLocaleString('tr-TR')}</p>
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

function ReturnList({ returns }: { returns: ReturnRequest[] }) {
  if (returns.length === 0) return <Empty text="Bu sipariş için iade talebi yok." />;
  return (
    <div className="space-y-3">
      {returns.map((item) => (
        <div key={item.id} className="rounded-lg border border-border p-4">
          <p className="font-semibold text-foreground">{returnStatusLabel(item.status)}</p>
          <p className="text-sm text-muted-foreground">{item.reason}</p>
        </div>
      ))}
    </div>
  );
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

function returnStatusLabel(status: string) {
  if (status === 'erp_review') return 'ERP İncelemede';
  if (status === 'approved') return 'Onaylandı';
  if (status === 'rejected') return 'Reddedildi';
  if (status === 'received') return 'İade Alındı';
  if (status === 'closed') return 'Kapatıldı';
  return 'Talep Alındı';
}
