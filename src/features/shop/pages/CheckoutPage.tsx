import { useEffect, useMemo, useState } from 'react';
import type { ReactNode } from 'react';
import { Link, useNavigate } from 'react-router-dom';
import { ArrowLeft, CheckCircle, Loader2, MapPin, PackageCheck, Truck, User } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useToast } from '@/hooks/use-toast';
import { CartDrawer } from '../components';
import { useCart } from '../CartContext';
import { createCheckoutOrder, createPaymentSession, fetchShippingMethods, getCurrentCustomerProfile } from '../api';
import { CheckoutPayload, PaymentProvider, ShippingMethod, TAX_RATE } from '../types';
import { formatPrice } from '../utils';

const PROFILE_STORAGE_KEY = 'dayan_shop_customer_profile';

const steps = [
  { key: 'customer', label: 'Müşteri', icon: User },
  { key: 'address', label: 'Adres', icon: MapPin },
  { key: 'shipping', label: 'Sevkiyat', icon: Truck },
  { key: 'payment', label: 'Ödeme', icon: PackageCheck },
];

const paymentProviders: { value: PaymentProvider; label: string; description: string }[] = [
  { value: 'iyzico', label: 'iyzico', description: 'Türkiye ödeme altyapısı ile güvenli ödeme.' },
  { value: 'paytr', label: 'PayTR', description: 'PayTR ödeme altyapısı ile güvenli ödeme.' },
  { value: 'stripe', label: 'Stripe', description: 'Stripe ödeme altyapısı ile güvenli ödeme.' },
];

export function CheckoutPage() {
  const navigate = useNavigate();
  const { toast } = useToast();
  const { items, subtotal, clearCart } = useCart();
  const [activeStep, setActiveStep] = useState(0);
  const [loading, setLoading] = useState(false);
  const [customerReady, setCustomerReady] = useState(false);
  const [shippingMethods, setShippingMethods] = useState<ShippingMethod[]>([]);
  const [formData, setFormData] = useState<CheckoutPayload>(() => {
    const stored = localStorage.getItem(PROFILE_STORAGE_KEY);
    if (stored) {
      try {
        return { shippingMethod: 'company_shipping', notes: '', ...JSON.parse(stored) };
      } catch {
        return emptyCheckoutPayload();
      }
    }
    return emptyCheckoutPayload();
  });

  const taxAmount = subtotal * TAX_RATE;
  const total = subtotal + taxAmount;
  const selectedShipping = shippingMethods.find((method) => method.code === formData.shippingMethod);
  const canGoNext = useMemo(() => {
    if (activeStep === 0) return Boolean(formData.customerName && formData.email && formData.phone);
    if (activeStep === 1) return Boolean(formData.billingAddress && formData.shippingAddress);
    if (activeStep === 2) return Boolean(formData.shippingMethod);
    return true;
  }, [activeStep, formData]);

  useEffect(() => {
    if (items.length === 0) navigate('/shop', { replace: true });
  }, [items.length, navigate]);

  useEffect(() => {
    getCurrentCustomerProfile().then((profile) => {
      if (!profile) {
        setCustomerReady(false);
        return;
      }
      setCustomerReady(true);
      setFormData((current) => ({
        ...current,
        customerName: profile.customerName || current.customerName,
        companyName: profile.companyName || current.companyName,
        email: profile.email || current.email,
        phone: profile.phone || current.phone,
        billingAddress: profile.billingAddress || current.billingAddress,
        shippingAddress: profile.shippingAddress || current.shippingAddress,
      }));
    });
  }, []);

  useEffect(() => {
    fetchShippingMethods().then((methods) => {
      setShippingMethods(methods);
      if (methods.length > 0 && !methods.some((method) => method.code === formData.shippingMethod)) {
        setFormData((current) => ({ ...current, shippingMethod: methods[0].code }));
      }
    });
  }, [formData.shippingMethod]);

  const updateField = (field: keyof CheckoutPayload, value: string) => {
    setFormData((current) => ({ ...current, [field]: value }));
  };

  const next = () => {
    if (!canGoNext) {
      toast({ title: 'Eksik Bilgi', description: 'Devam etmek için zorunlu alanları doldurun.', variant: 'destructive' });
      return;
    }
    setActiveStep((current) => Math.min(current + 1, steps.length - 1));
  };

  const submit = async () => {
    if (!canGoNext || items.length === 0) return;
    if (!customerReady) {
      toast({ title: 'Müşteri Girişi Gerekli', description: 'Sipariş talebi göndermek için hesabınıza giriş yapın.', variant: 'destructive' });
      navigate('/hesabim');
      return;
    }
    setLoading(true);
    try {
      const result = await createCheckoutOrder(formData, items);
      const payment = await createPaymentSession(result.order.id, formData.paymentProvider);
      localStorage.setItem(PROFILE_STORAGE_KEY, JSON.stringify({
        customerName: formData.customerName,
        companyName: formData.companyName,
        email: formData.email,
        phone: formData.phone,
        billingAddress: formData.billingAddress,
        shippingAddress: formData.shippingAddress,
      }));
      clearCart();
      if (result.conversionError) {
        toast({ title: 'ERP bağlantısı beklemede', description: 'Siparişiniz alındı. Satış siparişi ERP ekibi tarafından tamamlanacak.' });
      }
      if (payment.paymentUrl) {
        window.location.assign(payment.paymentUrl);
        return;
      }
      navigate(`/checkout/success?order=${result.order.order_number}&payment=${payment.providerPaymentId}`);
    } catch (error) {
      console.error('Checkout error:', error);
      toast({ title: 'Hata', description: 'Sipariş talebi oluşturulurken bir hata oluştu.', variant: 'destructive' });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) return null;

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 border-b border-border bg-navy/95 backdrop-blur-sm">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link to="/cart"><ArrowLeft className="h-5 w-5" /></Link>
              </Button>
              <h1 className="text-xl font-bold text-foreground">Sipariş Talebi</h1>
            </div>
            <CartDrawer />
          </div>
        </div>
      </header>

      <main className="container mx-auto grid gap-6 px-4 py-6 lg:grid-cols-[1fr_360px]">
        <section className="space-y-6">
          <div className="grid grid-cols-2 gap-2 md:grid-cols-4">
            {steps.map((step, index) => {
              const Icon = step.icon;
              const active = index === activeStep;
              const complete = index < activeStep;
              return (
                <button
                  key={step.key}
                  type="button"
                  onClick={() => index <= activeStep && setActiveStep(index)}
                  className={`flex items-center gap-2 rounded-lg border p-3 text-sm ${active ? 'border-primary bg-primary/10 text-primary' : complete ? 'border-green-500/40 text-green-500' : 'border-border text-muted-foreground'}`}
                >
                  {complete ? <CheckCircle className="h-4 w-4" /> : <Icon className="h-4 w-4" />}
                  {step.label}
                </button>
              );
            })}
          </div>

          <Card className="border-border bg-card">
            <CardHeader><CardTitle>{steps[activeStep].label}</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              {!customerReady ? (
                <div className="rounded-lg border border-primary/30 bg-primary/10 p-4 text-sm text-foreground">
                  Sipariş talebi göndermek için müşteri hesabı gerekir. <Link className="font-semibold text-primary underline-offset-4 hover:underline" to="/hesabim">Hesabım</Link> sayfasından giriş yapabilir veya yeni hesap oluşturabilirsiniz.
                </div>
              ) : null}
              {activeStep === 0 && (
                <div className="grid gap-4 md:grid-cols-2">
                  <Field label="Ad Soyad *"><Input value={formData.customerName} onChange={(event) => updateField('customerName', event.target.value)} /></Field>
                  <Field label="Firma"><Input value={formData.companyName} onChange={(event) => updateField('companyName', event.target.value)} /></Field>
                  <Field label="E-posta *"><Input type="email" value={formData.email} onChange={(event) => updateField('email', event.target.value)} /></Field>
                  <Field label="Telefon *"><Input value={formData.phone} onChange={(event) => updateField('phone', event.target.value)} /></Field>
                </div>
              )}

              {activeStep === 1 && (
                <div className="space-y-4">
                  <Field label="Fatura Adresi *"><Textarea rows={4} value={formData.billingAddress} onChange={(event) => updateField('billingAddress', event.target.value)} /></Field>
                  <Field label="Teslimat Adresi *"><Textarea rows={4} value={formData.shippingAddress} onChange={(event) => updateField('shippingAddress', event.target.value)} /></Field>
                  <Button type="button" variant="outline" onClick={() => updateField('shippingAddress', formData.billingAddress)}>Fatura Adresini Kullan</Button>
                </div>
              )}

              {activeStep === 2 && (
                <RadioGroup value={formData.shippingMethod} onValueChange={(value) => updateField('shippingMethod', value)} className="space-y-3">
                  {(shippingMethods.length ? shippingMethods : fallbackShippingMethods).map((method) => (
                    <label key={method.code} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4">
                      <RadioGroupItem value={method.code} className="mt-1" />
                      <span className="flex-1">
                        <span className="block font-medium text-foreground">{method.name}</span>
                        <span className="mt-1 block text-sm text-muted-foreground">{method.description}</span>
                        {method.estimated_days ? <span className="mt-1 block text-xs text-muted-foreground">Süre: {method.estimated_days}</span> : null}
                      </span>
                      <span className="text-sm font-semibold text-primary">{formatPrice(method.base_price, method.currency)}</span>
                    </label>
                  ))}
                </RadioGroup>
              )}

              {activeStep === 3 && (
                <div className="space-y-4">
                  <RadioGroup value={formData.paymentProvider} onValueChange={(value) => updateField('paymentProvider', value)} className="space-y-3">
                    {paymentProviders.map((provider) => (
                      <label key={provider.value} className="flex cursor-pointer items-start gap-3 rounded-lg border border-border p-4">
                        <RadioGroupItem value={provider.value} className="mt-1" />
                        <span>
                          <span className="block font-medium text-foreground">{provider.label}</span>
                          <span className="mt-1 block text-sm text-muted-foreground">{provider.description}</span>
                        </span>
                      </label>
                    ))}
                  </RadioGroup>
                  <Field label="Sipariş Notu"><Textarea rows={3} value={formData.notes} onChange={(event) => updateField('notes', event.target.value)} /></Field>
                  <div className="grid gap-3 text-sm md:grid-cols-2">
                    <SummaryItem label="Müşteri" value={formData.customerName} />
                    <SummaryItem label="E-posta" value={formData.email} />
                    <SummaryItem label="Sevkiyat" value={selectedShipping?.name || formData.shippingMethod} />
                    <SummaryItem label="Ödeme" value={paymentProviders.find((provider) => provider.value === formData.paymentProvider)?.label || ''} />
                  </div>
                </div>
              )}
            </CardContent>
          </Card>

          <div className="flex justify-between">
            <Button type="button" variant="outline" disabled={activeStep === 0 || loading} onClick={() => setActiveStep((current) => Math.max(0, current - 1))}>Geri</Button>
            {activeStep < steps.length - 1 ? (
              <Button type="button" onClick={next}>Devam Et</Button>
            ) : (
              <Button type="button" onClick={submit} disabled={loading}>
                {loading ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : null}
                Ödemeye Geç
              </Button>
            )}
          </div>
        </section>

        <aside>
          <Card className="sticky top-24 border-border bg-card">
            <CardHeader><CardTitle>Sipariş Özeti</CardTitle></CardHeader>
            <CardContent className="space-y-4">
              <div className="max-h-56 space-y-3 overflow-y-auto">
                {items.map((item) => (
                  <div key={item.productId} className="flex justify-between gap-3 text-sm">
                    <span className="text-muted-foreground">{item.name} x{item.quantity}</span>
                    <span>{formatPrice(item.price * item.quantity, item.currency)}</span>
                  </div>
                ))}
              </div>
              <div className="border-t border-border pt-3 text-sm">
                <div className="flex justify-between"><span className="text-muted-foreground">Ara Toplam</span><span>{formatPrice(subtotal)}</span></div>
                <div className="mt-2 flex justify-between"><span className="text-muted-foreground">KDV (%{TAX_RATE * 100})</span><span>{formatPrice(taxAmount)}</span></div>
                <div className="mt-3 flex justify-between border-t border-border pt-3 text-lg font-bold"><span>Toplam</span><span className="text-primary">{formatPrice(total)}</span></div>
              </div>
            </CardContent>
          </Card>
        </aside>
      </main>
    </div>
  );
}

function Field({ label, children }: { label: string; children: ReactNode }) {
  return <div className="space-y-2"><Label>{label}</Label>{children}</div>;
}

function SummaryItem({ label, value }: { label: string; value: string }) {
  return <div className="rounded-lg bg-muted p-3"><p className="text-xs text-muted-foreground">{label}</p><p className="mt-1 font-medium text-foreground">{value || '-'}</p></div>;
}

function emptyCheckoutPayload(): CheckoutPayload {
  return {
    customerName: '',
    companyName: '',
    email: '',
    phone: '',
    billingAddress: '',
    shippingAddress: '',
    shippingMethod: 'company_shipping',
    paymentProvider: 'iyzico',
    notes: '',
  };
}

const fallbackShippingMethods: ShippingMethod[] = [
  { id: 'company_shipping', name: 'Firma Sevkiyatı', code: 'company_shipping', description: 'Dayan Dişli ekibi tarafından planlanan sevkiyat.', estimated_days: 'Teklif sonrası planlanır', base_price: 0, currency: 'TRY', is_active: true, sort_order: 10 },
  { id: 'customer_pickup', name: 'Müşteri Teslim Alır', code: 'customer_pickup', description: 'Müşteri tarafından teslim alma seçeneği.', estimated_days: 'Hazırlık sonrası', base_price: 0, currency: 'TRY', is_active: true, sort_order: 20 },
];
