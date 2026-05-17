import { useState, useEffect } from 'react';
import { Link } from 'react-router-dom';
import { ArrowLeft, Loader2, Eye, Package } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { Card, CardContent, CardHeader, CardTitle } from '@/components/ui/card';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { fetchOrders, fetchOrderWithItems, updateOrderStatus } from '../api';
import { Order, OrderWithItems, ORDER_STATUS_LABELS, OrderStatus } from '../types';
import { formatPrice } from '../utils';
import { useToast } from '@/hooks/use-toast';

const STATUS_COLORS: Record<OrderStatus, string> = {
  pending: 'bg-yellow-500/20 text-yellow-500',
  confirmed: 'bg-blue-500/20 text-blue-500',
  shipped: 'bg-purple-500/20 text-purple-500',
  completed: 'bg-green-500/20 text-green-500',
  cancelled: 'bg-red-500/20 text-red-500',
};

export function ShopOrdersPage() {
  const [orders, setOrders] = useState<Order[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedOrder, setSelectedOrder] = useState<OrderWithItems | null>(null);
  const [drawerOpen, setDrawerOpen] = useState(false);
  const [loadingDetails, setLoadingDetails] = useState(false);
  const [updatingStatus, setUpdatingStatus] = useState<string | null>(null);
  const { toast } = useToast();

  // Load orders
  useEffect(() => {
    const loadOrders = async () => {
      setLoading(true);
      try {
        const { orders: fetchedOrders } = await fetchOrders();
        setOrders(fetchedOrders);
      } catch (error) {
        console.error('Error loading orders:', error);
        toast({
          title: 'Hata',
          description: 'Siparişler yüklenirken bir hata oluştu.',
          variant: 'destructive',
        });
      } finally {
        setLoading(false);
      }
    };

    loadOrders();
  }, [toast]);

  // Open order details
  const handleViewOrder = async (orderId: string) => {
    setLoadingDetails(true);
    setDrawerOpen(true);
    try {
      const orderWithItems = await fetchOrderWithItems(orderId);
      setSelectedOrder(orderWithItems);
    } catch (error) {
      console.error('Error loading order details:', error);
      toast({
        title: 'Hata',
        description: 'Sipariş detayları yüklenemedi.',
        variant: 'destructive',
      });
    } finally {
      setLoadingDetails(false);
    }
  };

  // Update order status
  const handleStatusChange = async (orderId: string, newStatus: string) => {
    setUpdatingStatus(orderId);
    try {
      await updateOrderStatus(orderId, newStatus);
      // Update local state
      setOrders((prev) =>
        prev.map((order) =>
          order.id === orderId ? { ...order, status: newStatus as OrderStatus } : order
        )
      );
      // Update selected order if open
      if (selectedOrder?.id === orderId) {
        setSelectedOrder({ ...selectedOrder, status: newStatus as OrderStatus });
      }
      toast({
        title: 'Güncellendi',
        description: 'Sipariş durumu başarıyla güncellendi.',
      });
    } catch (error) {
      console.error('Error updating order status:', error);
      toast({
        title: 'Hata',
        description: 'Sipariş durumu güncellenemedi.',
        variant: 'destructive',
      });
    } finally {
      setUpdatingStatus(null);
    }
  };

  // Format date
  const formatDate = (dateStr: string) => {
    return new Date(dateStr).toLocaleDateString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit',
    });
  };

  return (
    <div className="min-h-screen bg-background">
      {/* Header */}
      <header className="sticky top-0 z-40 bg-navy/95 backdrop-blur-sm border-b border-border">
        <div className="container mx-auto px-4 py-4">
          <div className="flex items-center gap-4">
            <Button asChild variant="ghost" size="icon">
              <Link to="/apps">
                <ArrowLeft className="h-5 w-5" />
              </Link>
            </Button>
            <h1 className="text-xl font-bold text-foreground">Sipariş Yönetimi</h1>
          </div>
        </div>
      </header>

      <main className="container mx-auto px-4 py-6">
        {loading ? (
          <div className="flex items-center justify-center py-20">
            <Loader2 className="w-8 h-8 animate-spin text-primary" />
          </div>
        ) : orders.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-20 text-muted-foreground">
            <Package className="w-16 h-16 mb-4" />
            <p className="text-lg">Henüz sipariş bulunmuyor</p>
          </div>
        ) : (
          <Card className="bg-card border-border">
            <CardHeader>
              <CardTitle>Siparişler ({orders.length})</CardTitle>
            </CardHeader>
            <CardContent>
              <div className="overflow-x-auto">
                <Table>
                  <TableHeader>
                    <TableRow>
                      <TableHead>Sipariş No</TableHead>
                      <TableHead>Tarih</TableHead>
                      <TableHead>Müşteri</TableHead>
                      <TableHead>Durum</TableHead>
                      <TableHead className="text-right">Toplam</TableHead>
                      <TableHead className="text-right">İşlem</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {orders.map((order) => (
                      <TableRow key={order.id}>
                        <TableCell className="font-medium">{order.order_number}</TableCell>
                        <TableCell>{formatDate(order.created_at)}</TableCell>
                        <TableCell>
                          <div>
                            <p className="font-medium">{order.customer_name}</p>
                            {order.company_name && (
                              <p className="text-sm text-muted-foreground">{order.company_name}</p>
                            )}
                          </div>
                        </TableCell>
                        <TableCell>
                          <Select
                            value={order.status}
                            onValueChange={(value) => handleStatusChange(order.id, value)}
                            disabled={updatingStatus === order.id}
                          >
                            <SelectTrigger className="w-[140px]">
                              <SelectValue>
                                <Badge className={STATUS_COLORS[order.status]}>
                                  {ORDER_STATUS_LABELS[order.status]}
                                </Badge>
                              </SelectValue>
                            </SelectTrigger>
                            <SelectContent>
                              {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => (
                                <SelectItem key={value} value={value}>
                                  {label}
                                </SelectItem>
                              ))}
                            </SelectContent>
                          </Select>
                        </TableCell>
                        <TableCell className="text-right font-semibold">
                          {formatPrice(order.grand_total, order.currency)}
                        </TableCell>
                        <TableCell className="text-right">
                          <Button
                            variant="ghost"
                            size="sm"
                            onClick={() => handleViewOrder(order.id)}
                          >
                            <Eye className="w-4 h-4 mr-1" />
                            Detay
                          </Button>
                        </TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              </div>
            </CardContent>
          </Card>
        )}
      </main>

      {/* Order Details Drawer */}
      <Sheet open={drawerOpen} onOpenChange={setDrawerOpen}>
        <SheetContent className="w-full sm:max-w-lg bg-card border-border overflow-y-auto">
          <SheetHeader>
            <SheetTitle className="text-foreground">
              Sipariş Detayı {selectedOrder?.order_number}
            </SheetTitle>
          </SheetHeader>

          {loadingDetails ? (
            <div className="flex items-center justify-center py-10">
              <Loader2 className="w-6 h-6 animate-spin text-primary" />
            </div>
          ) : selectedOrder ? (
            <div className="space-y-6 mt-6">
              {/* Status */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Durum</h3>
                <Badge className={STATUS_COLORS[selectedOrder.status]}>
                  {ORDER_STATUS_LABELS[selectedOrder.status]}
                </Badge>
              </div>

              {/* Customer Info */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Müşteri Bilgileri</h3>
                <div className="bg-muted rounded-lg p-3 space-y-1">
                  <p className="font-medium">{selectedOrder.customer_name}</p>
                  {selectedOrder.company_name && (
                    <p className="text-sm text-muted-foreground">{selectedOrder.company_name}</p>
                  )}
                  <p className="text-sm">{selectedOrder.email}</p>
                  <p className="text-sm">{selectedOrder.phone}</p>
                </div>
              </div>

              {/* Address */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Adres</h3>
                <p className="text-sm bg-muted rounded-lg p-3">{selectedOrder.address}</p>
              </div>

              {/* Notes */}
              {selectedOrder.notes && (
                <div>
                  <h3 className="text-sm font-medium text-muted-foreground mb-2">Sipariş Notu</h3>
                  <p className="text-sm bg-muted rounded-lg p-3">{selectedOrder.notes}</p>
                </div>
              )}

              {/* Order Items */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Ürünler</h3>
                <div className="space-y-2">
                  {selectedOrder.items.map((item) => (
                    <div
                      key={item.id}
                      className="flex justify-between items-center bg-muted rounded-lg p-3"
                    >
                      <div>
                        <p className="font-medium">{item.product_name}</p>
                        <p className="text-sm text-muted-foreground">
                          {item.quantity} x {formatPrice(item.unit_price)}
                        </p>
                      </div>
                      <p className="font-semibold">{formatPrice(item.line_total)}</p>
                    </div>
                  ))}
                </div>
              </div>

              {/* Totals */}
              <div className="border-t border-border pt-4 space-y-2">
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">Ara Toplam</span>
                  <span>{formatPrice(selectedOrder.subtotal, selectedOrder.currency)}</span>
                </div>
                <div className="flex justify-between text-sm">
                  <span className="text-muted-foreground">KDV</span>
                  <span>{formatPrice(selectedOrder.tax_total, selectedOrder.currency)}</span>
                </div>
                <div className="flex justify-between text-lg font-bold pt-2 border-t border-border">
                  <span>Genel Toplam</span>
                  <span className="text-primary">
                    {formatPrice(selectedOrder.grand_total, selectedOrder.currency)}
                  </span>
                </div>
              </div>

              {/* Payment Method */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Ödeme Yöntemi</h3>
                <p className="text-sm">
                  {selectedOrder.payment_method === 'bank_transfer' ? 'Havale / EFT' : 'Proforma Fatura'}
                </p>
              </div>

              {/* Order Date */}
              <div>
                <h3 className="text-sm font-medium text-muted-foreground mb-2">Sipariş Tarihi</h3>
                <p className="text-sm">{formatDate(selectedOrder.created_at)}</p>
              </div>
            </div>
          ) : null}
        </SheetContent>
      </Sheet>
    </div>
  );
}
