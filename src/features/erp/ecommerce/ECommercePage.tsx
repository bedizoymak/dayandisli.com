import { FormEvent, useEffect, useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { DataTable } from "@/components/erp/DataTable";
import { EmptyState } from "@/components/erp/EmptyState";
import { FormSection } from "@/components/erp/FormSection";
import { MigrationNotice } from "@/components/erp/MigrationNotice";
import { PageHeader } from "@/components/erp/PageHeader";
import { StatusBadge } from "@/components/erp/StatusBadge";
import { useToast } from "@/hooks/use-toast";
import { ERPLayout } from "../layout/ERPLayout";
import {
  convertShopOrderToSalesOrder,
  createShopCampaign,
  createShopCategory,
  createShopPaymentStatus,
  createShopShipment,
  listShopCampaigns,
  listShopCarts,
  listShopCarriers,
  listShopCategories,
  listShopCustomerNotifications,
  listShopFulfillmentHistory,
  listShopOrders,
  listShopPaymentStatuses,
  listShopProducts,
  listShopReturnRequests,
  listShopShipments,
  updateShopCampaign,
  updateShopCategory,
  updateShopOrder,
  updateShopProduct,
  updateShopReturnRequest,
  updateShopShipment,
} from "../shared/erpApi";
import { formatCurrency, formatDate } from "../shared/formatters";
import { ShopCampaign, ShopCarrier, ShopCart, ShopCategory, ShopCustomerNotification, ShopFulfillmentHistory, ShopFulfillmentStatus, ShopOrder, ShopPaymentLifecycleStatus, ShopPaymentStatus, ShopPaymentStatusRecord, ShopProduct, ShopReturnRefundStatus, ShopReturnRequest, ShopReturnRequestStatus, ShopShipment, ShopShipmentStatus } from "../shared/types";

const ORDER_STATUS_LABELS: Record<string, string> = {
  pending: "Beklemede",
  confirmed: "Onaylandı",
  shipped: "Kargoda",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const CART_STATUS_LABELS: Record<string, string> = {
  active: "Aktif",
  converted: "Siparişe Döndü",
  abandoned: "Terk Edildi",
  expired: "Süresi Doldu",
};

const PAYMENT_STATUS_LABELS: Record<ShopPaymentStatus, string> = {
  pending: "Ödeme Bekliyor",
  authorized: "Provizyon",
  paid: "Ödeme Alındı",
  failed: "Ödeme Başarısız",
  refunded: "İade Tamamlandı",
  cancelled: "İptal",
};

const PAYMENT_LIFECYCLE_LABELS: Record<ShopPaymentLifecycleStatus, string> = {
  payment_pending: "Ödeme Bekliyor",
  payment_received: "Ödeme Alındı",
  payment_failed: "Ödeme Başarısız",
  refund_pending: "İade Bekliyor",
  refund_completed: "İade Tamamlandı",
};

const FULFILLMENT_STATUS_LABELS: Record<ShopFulfillmentStatus, string> = {
  received: "Sipariş Alındı",
  preparing: "Hazırlanıyor",
  packed: "Paketleniyor",
  shipped: "Kargoya Verildi",
  delivered: "Teslim Edildi",
  completed: "Tamamlandı",
  cancelled: "İptal",
};

const SHIPMENT_STATUS_LABELS: Record<ShopShipmentStatus, string> = {
  preparing: "Hazırlanıyor",
  packed: "Paketleniyor",
  shipped: "Kargoya Verildi",
  delivered: "Teslim Edildi",
  cancelled: "İptal",
};

const RETURN_STATUS_LABELS: Record<ShopReturnRequestStatus, string> = {
  requested: "Talep Alındı",
  erp_review: "ERP İncelemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  received: "İade Alındı",
  closed: "Kapatıldı",
};

const RETURN_REFUND_LABELS: Record<ShopReturnRefundStatus, string> = {
  refund_pending: "Geri Ödeme Bekliyor",
  refund_approved: "Geri Ödeme Onaylandı",
  refund_completed: "Geri Ödeme Tamamlandı",
  refund_rejected: "Geri Ödeme Reddedildi",
};

function tone(status: string) {
  if (["completed", "paid", "converted", "active", "delivered", "payment_received", "refund_completed", "approved", "refund_approved"].includes(status)) return "success" as const;
  if (["pending", "authorized", "shipped", "preparing", "packed", "received", "payment_pending", "refund_pending", "requested", "erp_review"].includes(status)) return "warning" as const;
  if (["cancelled", "failed", "refunded", "abandoned", "expired", "payment_failed", "rejected", "refund_rejected"].includes(status)) return "danger" as const;
  return "default" as const;
}

function slugify(value: string) {
  return value
    .toLocaleLowerCase("tr-TR")
    .replace(/ğ/g, "g")
    .replace(/ü/g, "u")
    .replace(/ş/g, "s")
    .replace(/ı/g, "i")
    .replace(/ö/g, "o")
    .replace(/ç/g, "c")
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-|-$/g, "");
}

export default function ECommercePage() {
  const { toast } = useToast();
  const [products, setProducts] = useState<ShopProduct[]>([]);
  const [categories, setCategories] = useState<ShopCategory[]>([]);
  const [orders, setOrders] = useState<ShopOrder[]>([]);
  const [campaigns, setCampaigns] = useState<ShopCampaign[]>([]);
  const [carts, setCarts] = useState<ShopCart[]>([]);
  const [payments, setPayments] = useState<ShopPaymentStatusRecord[]>([]);
  const [carriers, setCarriers] = useState<ShopCarrier[]>([]);
  const [shipments, setShipments] = useState<ShopShipment[]>([]);
  const [fulfillmentHistory, setFulfillmentHistory] = useState<ShopFulfillmentHistory[]>([]);
  const [notifications, setNotifications] = useState<ShopCustomerNotification[]>([]);
  const [returns, setReturns] = useState<ShopReturnRequest[]>([]);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState("all");
  const [error, setError] = useState<string | null>(null);
  const [categoryForm, setCategoryForm] = useState({ name: "", slug: "", description: "" });
  const [campaignForm, setCampaignForm] = useState({ name: "", code: "", discount_type: "percentage", discount_value: "0", starts_at: "", ends_at: "" });
  const [paymentForm, setPaymentForm] = useState({ order_id: "", status: "pending" as ShopPaymentStatus, lifecycle_status: "payment_pending" as ShopPaymentLifecycleStatus, future_provider: "manual", provider: "", transaction_reference: "", amount: "", notes: "" });
  const [shipmentForm, setShipmentForm] = useState({ order_id: "", carrier_id: "", carrier_name: "", tracking_number: "", status: "preparing" as ShopShipmentStatus, notes: "" });

  const load = async () => {
    const [productResult, categoryResult, orderResult, campaignResult, cartResult, paymentResult, carrierResult, shipmentResult, historyResult, notificationResult, returnResult] = await Promise.all([
      listShopProducts(),
      listShopCategories(),
      listShopOrders(),
      listShopCampaigns(),
      listShopCarts(),
      listShopPaymentStatuses(),
      listShopCarriers(),
      listShopShipments(),
      listShopFulfillmentHistory(),
      listShopCustomerNotifications(),
      listShopReturnRequests(),
    ]);
    const firstError = [productResult, categoryResult, orderResult, campaignResult, cartResult, paymentResult, carrierResult, shipmentResult, historyResult, notificationResult, returnResult].find((result) => result.error)?.error ?? null;
    setError(firstError);
    setProducts(productResult.data);
    setCategories(categoryResult.data);
    setOrders(orderResult.data);
    setCampaigns(campaignResult.data);
    setCarts(cartResult.data);
    setPayments(paymentResult.data);
    setCarriers(carrierResult.data);
    setShipments(shipmentResult.data);
    setFulfillmentHistory(historyResult.data);
    setNotifications(notificationResult.data);
    setReturns(returnResult.data);
    if (firstError) toast({ title: "E-Ticaret", description: firstError, variant: "destructive" });
  };

  useEffect(() => {
    load();
  }, []);

  const filteredOrders = useMemo(() => {
    const needle = search.trim().toLocaleLowerCase("tr-TR");
    return orders.filter((order) => {
      const matchesStatus = statusFilter === "all" || order.status === statusFilter || order.payment_status === statusFilter;
      const matchesSearch = !needle || [order.order_number, order.customer_name, order.company_name, order.email, order.phone].join(" ").toLocaleLowerCase("tr-TR").includes(needle);
      return matchesStatus && matchesSearch;
    });
  }, [orders, search, statusFilter]);

  const save = async (action: Promise<{ error: string | null }>, message: string) => {
    const result = await action;
    if (result.error) {
      toast({ title: "Hata", description: result.error, variant: "destructive" });
      return false;
    }
    toast({ title: "Kaydedildi", description: message });
    await load();
    return true;
  };

  const submitCategory = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await save(createShopCategory({
      name: categoryForm.name,
      slug: categoryForm.slug || slugify(categoryForm.name),
      description: categoryForm.description || null,
    }), "Kategori oluşturuldu.");
    if (ok) setCategoryForm({ name: "", slug: "", description: "" });
  };

  const submitCampaign = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const ok = await save(createShopCampaign({
      name: campaignForm.name,
      code: campaignForm.code || null,
      discount_type: campaignForm.discount_type as ShopCampaign["discount_type"],
      discount_value: Number(campaignForm.discount_value || 0),
      starts_at: campaignForm.starts_at || null,
      ends_at: campaignForm.ends_at || null,
    }), "Kampanya oluşturuldu.");
    if (ok) setCampaignForm({ name: "", code: "", discount_type: "percentage", discount_value: "0", starts_at: "", ends_at: "" });
  };

  const submitPayment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const order = orders.find((item) => item.id === paymentForm.order_id);
    if (!order) return;
    const ok = await save(createShopPaymentStatus({
      order_id: order.id,
      status: paymentForm.status,
      lifecycle_status: paymentForm.lifecycle_status,
      future_provider: paymentForm.future_provider as ShopPaymentStatusRecord["future_provider"],
      customer_user_id: order.customer_user_id ?? null,
      provider: paymentForm.provider || null,
      transaction_reference: paymentForm.transaction_reference || null,
      amount: Number(paymentForm.amount || order.grand_total || 0),
      currency: order.currency,
      notes: paymentForm.notes || null,
    }), "Ödeme durumu kaydedildi.");
    if (ok) setPaymentForm({ order_id: "", status: "pending", lifecycle_status: "payment_pending", future_provider: "manual", provider: "", transaction_reference: "", amount: "", notes: "" });
  };

  const submitShipment = async (event: FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    const order = orders.find((item) => item.id === shipmentForm.order_id);
    const carrier = carriers.find((item) => item.id === shipmentForm.carrier_id);
    if (!order) return;
    const ok = await save(createShopShipment({
      order_id: order.id,
      customer_user_id: order.customer_user_id ?? null,
      carrier_id: carrier?.id ?? null,
      carrier_name: shipmentForm.carrier_name || carrier?.name || null,
      tracking_number: shipmentForm.tracking_number || null,
      status: shipmentForm.status,
      notes: shipmentForm.notes || null,
      shipped_at: shipmentForm.status === "shipped" || shipmentForm.status === "delivered" ? new Date().toISOString() : null,
      delivered_at: shipmentForm.status === "delivered" ? new Date().toISOString() : null,
    }), "Sevkiyat kaydı oluşturuldu.");
    if (ok) setShipmentForm({ order_id: "", carrier_id: "", carrier_name: "", tracking_number: "", status: "preparing", notes: "" });
  };

  return (
    <ERPLayout title="E-Ticaret">
      <PageHeader title="E-Ticaret" description="shop.dayandisli.com hazırlığı için ürün, kategori, sipariş, müşteri, kampanya, sepet ve ödeme durumlarını yönetin." />

      {error ? <MigrationNotice message={error} /> : null}

      <div className="grid gap-4 md:grid-cols-4">
        <Summary title="Ürünler" value={products.length} />
        <Summary title="Siparişler" value={orders.length} />
        <Summary title="Açık Sepetler" value={carts.filter((cart) => cart.status === "active").length} />
        <Summary title="Ödeme Bekleyen" value={orders.filter((order) => (order.payment_status ?? "pending") === "pending").length} />
      </div>

      <Tabs defaultValue="products" className="space-y-4">
        <TabsList className="flex h-auto flex-wrap justify-start">
          <TabsTrigger value="products">Ürünler</TabsTrigger>
          <TabsTrigger value="categories">Kategoriler</TabsTrigger>
          <TabsTrigger value="orders">Siparişler</TabsTrigger>
          <TabsTrigger value="customers">Müşteriler</TabsTrigger>
          <TabsTrigger value="campaigns">Kampanyalar</TabsTrigger>
          <TabsTrigger value="carts">Sepetler</TabsTrigger>
          <TabsTrigger value="payments">Ödeme Durumları</TabsTrigger>
          <TabsTrigger value="fulfillment">Karşılama</TabsTrigger>
          <TabsTrigger value="shipping">Sevkiyat</TabsTrigger>
          <TabsTrigger value="returns">İadeler</TabsTrigger>
          <TabsTrigger value="notifications">Bildirimler</TabsTrigger>
        </TabsList>

        <TabsContent value="products">
          <DataTable data={products} rowKey={(row) => row.id} columns={[
            { key: "name", header: "Ürün", render: (row) => <div><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground">{row.sku || row.slug}</p></div> },
            { key: "category", header: "Kategori", render: (row) => categories.find((category) => category.id === row.shop_category_id)?.name || row.category || "-" },
            { key: "price", header: "Fiyat", className: "text-right", render: (row) => formatCurrency(row.price, row.currency) },
            { key: "stock", header: "Stok", render: (row) => <StatusBadge label={row.in_stock ? `${row.stock_quantity} adet` : "Stokta Yok"} tone={row.in_stock ? "success" : "danger"} /> },
            { key: "visible", header: "Mağaza", render: (row) => <StatusBadge label={row.is_shop_visible === false ? "Gizli" : "Görünür"} tone={row.is_shop_visible === false ? "muted" : "success"} /> },
            { key: "action", header: "İşlem", render: (row) => <Button size="sm" variant="outline" onClick={() => save(updateShopProduct(row.id, { is_shop_visible: row.is_shop_visible === false }), "Ürün görünürlüğü güncellendi.")}>{row.is_shop_visible === false ? "Göster" : "Gizle"}</Button> },
          ]} />
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <FormSection title="Yeni Kategori" description="Mağaza kategori ağacını hazırlayın.">
            <form className="grid gap-3 md:grid-cols-4" onSubmit={submitCategory}>
              <Input required placeholder="Kategori adı *" value={categoryForm.name} onChange={(event) => setCategoryForm((current) => ({ ...current, name: event.target.value, slug: current.slug || slugify(event.target.value) }))} />
              <Input placeholder="SEO adresi" value={categoryForm.slug} onChange={(event) => setCategoryForm((current) => ({ ...current, slug: event.target.value }))} />
              <Input placeholder="Açıklama" value={categoryForm.description} onChange={(event) => setCategoryForm((current) => ({ ...current, description: event.target.value }))} />
              <Button type="submit">Kategori Ekle</Button>
            </form>
          </FormSection>
          <DataTable data={categories} rowKey={(row) => row.id} columns={[
            { key: "name", header: "Kategori", render: (row) => row.name },
            { key: "slug", header: "SEO Adresi", render: (row) => row.slug },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.is_active ? "Aktif" : "Pasif"} tone={row.is_active ? "success" : "muted"} /> },
            { key: "action", header: "İşlem", render: (row) => <Button size="sm" variant="outline" onClick={() => save(updateShopCategory(row.id, { is_active: !row.is_active }), "Kategori durumu güncellendi.")}>{row.is_active ? "Pasifleştir" : "Aktifleştir"}</Button> },
          ]} />
        </TabsContent>

        <TabsContent value="orders" className="space-y-4">
          <div className="grid gap-3 md:grid-cols-[1fr_220px]">
            <Input placeholder="Sipariş ara" value={search} onChange={(event) => setSearch(event.target.value)} />
            <select className="h-10 rounded-md border bg-background px-3 text-sm" value={statusFilter} onChange={(event) => setStatusFilter(event.target.value)}>
              <option value="all">Tüm Durumlar</option>
              {Object.entries(ORDER_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
            </select>
          </div>
          <DataTable data={filteredOrders} rowKey={(row) => row.id} emptyMessage="Sipariş bulunamadı" columns={[
            { key: "order", header: "Sipariş", render: (row) => <div><p className="font-medium">{row.order_number}</p><p className="text-xs text-muted-foreground">{formatDate(row.created_at)}</p></div> },
            { key: "customer", header: "Müşteri", render: (row) => <div><p>{row.customer_name}</p><p className="text-xs text-muted-foreground">{row.company_name || row.email}</p></div> },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={ORDER_STATUS_LABELS[row.status] ?? row.status} tone={tone(row.status)} /> },
            { key: "payment", header: "Ödeme", render: (row) => <StatusBadge label={PAYMENT_STATUS_LABELS[row.payment_status ?? "pending"]} tone={tone(row.payment_status ?? "pending")} /> },
            { key: "fulfillment", header: "Karşılama", render: (row) => <StatusBadge label={FULFILLMENT_STATUS_LABELS[row.fulfillment_status ?? "received"]} tone={tone(row.fulfillment_status ?? "received")} /> },
            { key: "total", header: "Toplam", className: "text-right", render: (row) => formatCurrency(row.grand_total, row.currency) },
            { key: "next", header: "Sonraki Adım", render: (row) => <select className="h-9 rounded-md border bg-background px-2 text-sm" value={row.fulfillment_status ?? "received"} onChange={(event) => save(updateShopOrder(row.id, { fulfillment_status: event.target.value as ShopFulfillmentStatus }), "Karşılama durumu güncellendi.")}>{Object.entries(FULFILLMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> },
            { key: "flow", header: "ERP Akışı", render: (row) => row.sales_order_id ? <StatusBadge label="Satış Siparişine Bağlı" tone="success" /> : <Button size="sm" onClick={() => save(convertShopOrderToSalesOrder(row), "Satış siparişi oluşturuldu.")}>Satış Siparişine Aktar</Button> },
          ]} />
        </TabsContent>

        <TabsContent value="customers">
          <DataTable data={orders} rowKey={(row) => row.id} columns={[
            { key: "customer", header: "Müşteri", render: (row) => row.customer_name },
            { key: "company", header: "Firma", render: (row) => row.company_name || "-" },
            { key: "email", header: "E-posta", render: (row) => row.email },
            { key: "phone", header: "Telefon", render: (row) => row.phone },
            { key: "order", header: "Sipariş", render: (row) => row.order_number },
          ]} />
        </TabsContent>

        <TabsContent value="campaigns" className="space-y-4">
          <FormSection title="Yeni Kampanya" description="İndirim ve kampanya temelini hazırlayın.">
            <form className="grid gap-3 md:grid-cols-6" onSubmit={submitCampaign}>
              <Input required placeholder="Kampanya adı *" value={campaignForm.name} onChange={(event) => setCampaignForm((current) => ({ ...current, name: event.target.value }))} />
              <Input placeholder="Kod" value={campaignForm.code} onChange={(event) => setCampaignForm((current) => ({ ...current, code: event.target.value }))} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={campaignForm.discount_type} onChange={(event) => setCampaignForm((current) => ({ ...current, discount_type: event.target.value }))}>
                <option value="percentage">Yüzde</option>
                <option value="amount">Tutar</option>
                <option value="free_shipping">Ücretsiz Kargo</option>
              </select>
              <Input type="number" step="0.01" value={campaignForm.discount_value} onChange={(event) => setCampaignForm((current) => ({ ...current, discount_value: event.target.value }))} />
              <Input type="datetime-local" value={campaignForm.starts_at} onChange={(event) => setCampaignForm((current) => ({ ...current, starts_at: event.target.value }))} />
              <Button type="submit">Kampanya Ekle</Button>
            </form>
          </FormSection>
          <DataTable data={campaigns} rowKey={(row) => row.id} columns={[
            { key: "name", header: "Kampanya", render: (row) => <div><p className="font-medium">{row.name}</p><p className="text-xs text-muted-foreground">{row.code || "-"}</p></div> },
            { key: "discount", header: "İndirim", render: (row) => row.discount_type === "percentage" ? `%${row.discount_value}` : row.discount_type === "amount" ? formatCurrency(row.discount_value) : "Ücretsiz Kargo" },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.is_active ? "Aktif" : "Pasif"} tone={row.is_active ? "success" : "muted"} /> },
            { key: "action", header: "İşlem", render: (row) => <Button size="sm" variant="outline" onClick={() => save(updateShopCampaign(row.id, { is_active: !row.is_active }), "Kampanya durumu güncellendi.")}>{row.is_active ? "Pasifleştir" : "Aktifleştir"}</Button> },
          ]} />
        </TabsContent>

        <TabsContent value="carts">
          {carts.length === 0 ? <EmptyState title="Sepet kaydı yok" description="Shop sepetleri Supabase üzerinde oluştuğunda burada izlenecek." /> : (
            <DataTable data={carts} rowKey={(row) => row.id} columns={[
              { key: "customer", header: "Müşteri", render: (row) => row.customer_name || row.customer_email || "-" },
              { key: "status", header: "Durum", render: (row) => <StatusBadge label={CART_STATUS_LABELS[row.status]} tone={tone(row.status)} /> },
              { key: "total", header: "Tutar", className: "text-right", render: (row) => formatCurrency(row.subtotal, row.currency) },
              { key: "converted", header: "Sipariş", render: (row) => row.converted_order_id ? <StatusBadge label="Dönüştü" tone="success" /> : "-" },
            ]} />
          )}
        </TabsContent>

        <TabsContent value="payments" className="space-y-4">
          <FormSection title="Ödeme Durumu" description="Sipariş ödeme durumunu ERP takibine alın.">
            <form className="grid gap-3 md:grid-cols-6" onSubmit={submitPayment}>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={paymentForm.order_id} onChange={(event) => setPaymentForm((current) => ({ ...current, order_id: event.target.value }))}>
                <option value="">Sipariş seçiniz</option>
                {orders.map((order) => <option key={order.id} value={order.id}>{order.order_number} - {order.customer_name}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={paymentForm.status} onChange={(event) => setPaymentForm((current) => ({ ...current, status: event.target.value as ShopPaymentStatus }))}>
                {Object.entries(PAYMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={paymentForm.lifecycle_status} onChange={(event) => setPaymentForm((current) => ({ ...current, lifecycle_status: event.target.value as ShopPaymentLifecycleStatus }))}>
                {Object.entries(PAYMENT_LIFECYCLE_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={paymentForm.future_provider} onChange={(event) => setPaymentForm((current) => ({ ...current, future_provider: event.target.value }))}>
                <option value="manual">Manuel</option>
                <option value="iyzico">iyzico Hazırlığı</option>
                <option value="paytr">PayTR Hazırlığı</option>
                <option value="stripe">Stripe Hazırlığı</option>
              </select>
              <Input placeholder="Sağlayıcı" value={paymentForm.provider} onChange={(event) => setPaymentForm((current) => ({ ...current, provider: event.target.value }))} />
              <Input placeholder="Referans" value={paymentForm.transaction_reference} onChange={(event) => setPaymentForm((current) => ({ ...current, transaction_reference: event.target.value }))} />
              <Input type="number" step="0.01" placeholder="Tutar" value={paymentForm.amount} onChange={(event) => setPaymentForm((current) => ({ ...current, amount: event.target.value }))} />
              <Button type="submit">Kaydet</Button>
            </form>
          </FormSection>
          <DataTable data={payments} rowKey={(row) => row.id} columns={[
            { key: "order", header: "Sipariş", render: (row) => orders.find((order) => order.id === row.order_id)?.order_number || row.order_id },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={PAYMENT_STATUS_LABELS[row.status]} tone={tone(row.status)} /> },
            { key: "lifecycle", header: "Yaşam Döngüsü", render: (row) => <StatusBadge label={PAYMENT_LIFECYCLE_LABELS[row.lifecycle_status ?? "payment_pending"]} tone={tone(row.lifecycle_status ?? "payment_pending")} /> },
            { key: "provider", header: "Sağlayıcı", render: (row) => row.provider || "-" },
            { key: "reference", header: "Referans", render: (row) => row.transaction_reference || "-" },
            { key: "amount", header: "Tutar", className: "text-right", render: (row) => formatCurrency(row.amount, row.currency) },
          ]} />
        </TabsContent>

        <TabsContent value="fulfillment">
          <DataTable data={fulfillmentHistory} rowKey={(row) => row.id} emptyMessage="Karşılama geçmişi bulunamadı" columns={[
            { key: "order", header: "Sipariş", render: (row) => orders.find((order) => order.id === row.order_id)?.order_number || row.order_id },
            { key: "from", header: "Önceki", render: (row) => row.from_status ? FULFILLMENT_STATUS_LABELS[row.from_status] : "-" },
            { key: "to", header: "Yeni", render: (row) => <StatusBadge label={FULFILLMENT_STATUS_LABELS[row.to_status]} tone={tone(row.to_status)} /> },
            { key: "description", header: "Açıklama", render: (row) => row.description || "-" },
            { key: "date", header: "Tarih", render: (row) => formatDate(row.created_at) },
          ]} />
        </TabsContent>

        <TabsContent value="shipping" className="space-y-4">
          <FormSection title="Yeni Sevkiyat" description="Kargo firması, takip numarası ve teslimat durumunu ERP ile müşteriye görünür hale getirin.">
            <form className="grid gap-3 md:grid-cols-6" onSubmit={submitShipment}>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={shipmentForm.order_id} onChange={(event) => setShipmentForm((current) => ({ ...current, order_id: event.target.value }))}>
                <option value="">Sipariş seçiniz</option>
                {orders.map((order) => <option key={order.id} value={order.id}>{order.order_number} - {order.customer_name}</option>)}
              </select>
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={shipmentForm.carrier_id} onChange={(event) => setShipmentForm((current) => ({ ...current, carrier_id: event.target.value }))}>
                <option value="">Kargo firması</option>
                {carriers.map((carrier) => <option key={carrier.id} value={carrier.id}>{carrier.name}</option>)}
              </select>
              <Input placeholder="Firma adı" value={shipmentForm.carrier_name} onChange={(event) => setShipmentForm((current) => ({ ...current, carrier_name: event.target.value }))} />
              <Input placeholder="Takip numarası" value={shipmentForm.tracking_number} onChange={(event) => setShipmentForm((current) => ({ ...current, tracking_number: event.target.value }))} />
              <select className="h-10 rounded-md border bg-background px-3 text-sm" value={shipmentForm.status} onChange={(event) => setShipmentForm((current) => ({ ...current, status: event.target.value as ShopShipmentStatus }))}>
                {Object.entries(SHIPMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}
              </select>
              <Button type="submit">Sevkiyat Ekle</Button>
            </form>
          </FormSection>
          <DataTable data={shipments} rowKey={(row) => row.id} emptyMessage="Sevkiyat kaydı bulunamadı" columns={[
            { key: "order", header: "Sipariş", render: (row) => orders.find((order) => order.id === row.order_id)?.order_number || row.order_id },
            { key: "carrier", header: "Kargo", render: (row) => row.carrier_name || "-" },
            { key: "tracking", header: "Takip No", render: (row) => row.tracking_number || "-" },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={SHIPMENT_STATUS_LABELS[row.status]} tone={tone(row.status)} /> },
            { key: "action", header: "İşlem", render: (row) => <select className="h-9 rounded-md border bg-background px-2 text-sm" value={row.status} onChange={(event) => save(updateShopShipment(row.id, { status: event.target.value as ShopShipmentStatus, delivered_at: event.target.value === "delivered" ? new Date().toISOString() : row.delivered_at }), "Sevkiyat durumu güncellendi.")}>{Object.entries(SHIPMENT_STATUS_LABELS).map(([value, label]) => <option key={value} value={value}>{label}</option>)}</select> },
          ]} />
        </TabsContent>

        <TabsContent value="returns">
          <DataTable data={returns} rowKey={(row) => row.id} emptyMessage="İade talebi bulunamadı" columns={[
            { key: "order", header: "Sipariş", render: (row) => orders.find((order) => order.id === row.order_id)?.order_number || row.order_id },
            { key: "reason", header: "Neden", render: (row) => row.reason },
            { key: "status", header: "İade Durumu", render: (row) => <StatusBadge label={RETURN_STATUS_LABELS[row.status]} tone={tone(row.status)} /> },
            { key: "refund", header: "Geri Ödeme", render: (row) => <StatusBadge label={RETURN_REFUND_LABELS[row.refund_status]} tone={tone(row.refund_status)} /> },
            { key: "request", header: "Talep", render: (row) => formatDate(row.requested_at) },
            { key: "action", header: "İşlem", render: (row) => <div className="flex flex-wrap gap-2"><Button size="sm" variant="outline" onClick={() => save(updateShopReturnRequest(row.id, { status: "erp_review" }), "İade talebi incelemeye alındı.")}>İncele</Button><Button size="sm" onClick={() => save(updateShopReturnRequest(row.id, { status: "approved", refund_status: "refund_approved" }), "İade talebi onaylandı.")}>Onayla</Button></div> },
          ]} />
        </TabsContent>

        <TabsContent value="notifications">
          <DataTable data={notifications} rowKey={(row) => row.id} emptyMessage="Bildirim kaydı bulunamadı" columns={[
            { key: "order", header: "Sipariş", render: (row) => row.order_id ? orders.find((order) => order.id === row.order_id)?.order_number || row.order_id : "-" },
            { key: "title", header: "Başlık", render: (row) => row.title },
            { key: "message", header: "Mesaj", render: (row) => row.message || "-" },
            { key: "channel", header: "Kanal", render: (row) => row.channel === "email_event" ? "E-posta Olayı" : "ERP Bildirimi" },
            { key: "status", header: "Durum", render: (row) => <StatusBadge label={row.status === "read" ? "Okundu" : row.status === "sent" ? "Gönderildi" : row.status === "failed" ? "Başarısız" : "Bekliyor"} tone={tone(row.status)} /> },
            { key: "date", header: "Tarih", render: (row) => formatDate(row.created_at) },
          ]} />
        </TabsContent>
      </Tabs>
    </ERPLayout>
  );
}

function Summary({ title, value }: { title: string; value: number }) {
  return (
    <div className="erp-surface rounded-lg p-4">
      <p className="text-sm text-muted-foreground">{title}</p>
      <p className="mt-1 text-2xl font-semibold">{value}</p>
    </div>
  );
}
