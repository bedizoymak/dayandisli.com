import { useState, useEffect } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { ArrowLeft, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Textarea } from '@/components/ui/textarea';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { useCart } from '../CartContext';
import { createOrder } from '../api';
import { formatPrice } from '../utils';
import { TAX_RATE, OrderStatus } from '../types';
import { useToast } from '@/hooks/use-toast';
import { CartDrawer } from '../components';

export function CheckoutPage() {
  const navigate = useNavigate();
  const { items, subtotal, clearCart } = useCart();
  const { toast } = useToast();
  const [loading, setLoading] = useState(false);

  const taxAmount = subtotal * TAX_RATE;
  const total = subtotal + taxAmount;

  // Form state
  const [formData, setFormData] = useState({
    customerName: '',
    companyName: '',
    email: '',
    phone: '',
    address: '',
    notes: '',
    paymentMethod: 'bank_transfer',
  });

  // Redirect if cart is empty
  useEffect(() => {
    if (items.length === 0) {
      navigate('/shop');
    }
  }, [items.length, navigate]);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement | HTMLTextAreaElement>) => {
    const { name, value } = e.target;
    setFormData((prev) => ({ ...prev, [name]: value }));
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();

    // Basic validation
    if (!formData.customerName || !formData.email || !formData.phone || !formData.address) {
      toast({
        title: 'Eksik Bilgi',
        description: 'Lütfen zorunlu alanları doldurun.',
        variant: 'destructive',
      });
      return;
    }

    setLoading(true);

    try {
      const order = await createOrder(
        {
          status: 'pending' as OrderStatus,
          customer_name: formData.customerName,
          company_name: formData.companyName || null,
          email: formData.email,
          phone: formData.phone,
          address: formData.address,
          notes: formData.notes || null,
          subtotal,
          tax_total: taxAmount,
          grand_total: total,
          currency: 'TRY',
          payment_method: formData.paymentMethod,
        },
        items.map((item) => ({
          product_id: item.productId,
          product_name: item.name,
          unit_price: item.price,
          quantity: item.quantity,
          line_total: item.price * item.quantity,
        }))
      );

      clearCart();
      navigate(`/checkout/success?order=${order.order_number}`);
    } catch (error) {
      console.error('Checkout error:', error);
      toast({
        title: 'Hata',
        description: 'Sipariş oluşturulurken bir hata oluştu.',
        variant: 'destructive',
      });
    } finally {
      setLoading(false);
    }
  };

  if (items.length === 0) {
    return null;
  }

  return (
    <div className="min-h-screen bg-background">
      <header className="sticky top-0 z-40 bg-navy/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-4">
              <Button asChild variant="ghost" size="icon">
                <Link to="/cart"><ArrowLeft className="h-5 w-5" /></Link>
              </Button>
              <h1 className="text-xl font-bold text-foreground">Ödeme</h1>
            </div>
            <CartDrawer />
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        <form onSubmit={handleSubmit}>
          <div className="grid lg:grid-cols-3 gap-6">
            <div className="lg:col-span-2 space-y-6">
              <Card className="bg-card border-border">
                <CardHeader><CardTitle>Müşteri Bilgileri</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="customerName">Ad Soyad *</Label>
                      <Input id="customerName" name="customerName" value={formData.customerName} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="companyName">Firma Adı</Label>
                      <Input id="companyName" name="companyName" value={formData.companyName} onChange={handleInputChange} />
                    </div>
                  </div>
                  <div className="grid sm:grid-cols-2 gap-4">
                    <div className="space-y-2">
                      <Label htmlFor="email">E-posta *</Label>
                      <Input id="email" name="email" type="email" value={formData.email} onChange={handleInputChange} required />
                    </div>
                    <div className="space-y-2">
                      <Label htmlFor="phone">Telefon *</Label>
                      <Input id="phone" name="phone" value={formData.phone} onChange={handleInputChange} required />
                    </div>
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="address">Adres *</Label>
                    <Textarea id="address" name="address" value={formData.address} onChange={handleInputChange} required rows={3} />
                  </div>
                  <div className="space-y-2">
                    <Label htmlFor="notes">Sipariş Notu</Label>
                    <Textarea id="notes" name="notes" value={formData.notes} onChange={handleInputChange} rows={2} />
                  </div>
                </CardContent>
              </Card>

              <Card className="bg-card border-border">
                <CardHeader><CardTitle>Ödeme Yöntemi</CardTitle></CardHeader>
                <CardContent>
                  <RadioGroup value={formData.paymentMethod} onValueChange={(v) => setFormData((prev) => ({ ...prev, paymentMethod: v }))}>
                    <div className="flex items-center space-x-2 p-3 rounded-lg border border-border">
                      <RadioGroupItem value="bank_transfer" id="bank_transfer" />
                      <Label htmlFor="bank_transfer" className="flex-1 cursor-pointer">Havale / EFT</Label>
                    </div>
                    <div className="flex items-center space-x-2 p-3 rounded-lg border border-border mt-2">
                      <RadioGroupItem value="proforma" id="proforma" />
                      <Label htmlFor="proforma" className="flex-1 cursor-pointer">Proforma Fatura</Label>
                    </div>
                  </RadioGroup>
                </CardContent>
              </Card>
            </div>

            <div className="lg:col-span-1">
              <Card className="bg-card border-border sticky top-24">
                <CardHeader><CardTitle>Sipariş Özeti</CardTitle></CardHeader>
                <CardContent className="space-y-4">
                  <div className="space-y-2 max-h-40 overflow-y-auto">
                    {items.map((item) => (
                      <div key={item.productId} className="flex justify-between text-sm">
                        <span className="text-muted-foreground">{item.name} x{item.quantity}</span>
                        <span>{formatPrice(item.price * item.quantity)}</span>
                      </div>
                    ))}
                  </div>
                  <div className="border-t border-border pt-3 space-y-2">
                    <div className="flex justify-between"><span className="text-muted-foreground">Ara Toplam</span><span>{formatPrice(subtotal)}</span></div>
                    <div className="flex justify-between"><span className="text-muted-foreground">KDV (%{TAX_RATE * 100})</span><span>{formatPrice(taxAmount)}</span></div>
                    <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                      <span>Toplam</span><span className="text-primary">{formatPrice(total)}</span>
                    </div>
                  </div>
                  <Button type="submit" className="w-full" size="lg" disabled={loading}>
                    {loading ? <><Loader2 className="w-4 h-4 mr-2 animate-spin" />İşleniyor...</> : 'Siparişi Onayla'}
                  </Button>
                </CardContent>
              </Card>
            </div>
          </div>
        </form>
      </main>
    </div>
  );
}
