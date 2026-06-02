// E-commerce types for the shop module

export interface Product {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  sku: string | null;
  price: number;
  currency: string;
  in_stock: boolean;
  stock_quantity: number;
  category: string | null;
  brand: string | null;
  shop_category_id?: string | null;
  inventory_item_id?: string | null;
  is_shop_visible?: boolean;
  created_at: string;
  updated_at: string;
}

export interface ProductImage {
  id: string;
  product_id: string;
  image_url: string;
  is_primary: boolean;
}

export interface ProductWithImages extends Product {
  images: ProductImage[];
  primary_image?: string;
}

export interface CartItem {
  productId: string;
  inventoryItemId?: string | null;
  name: string;
  slug: string;
  price: number;
  quantity: number;
  imageUrl: string | null;
  stockQuantity: number;
  currency: string;
}

export interface Order {
  id: string;
  order_number: string;
  status: OrderStatus;
  customer_user_id?: string | null;
  customer_name: string;
  company_name: string | null;
  email: string;
  phone: string;
  address: string;
  billing_address?: string | null;
  shipping_address?: string | null;
  notes: string | null;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  currency: string;
  payment_method: string;
  payment_status?: PaymentStatus;
  fulfillment_status?: FulfillmentStatus;
  refund_status?: RefundStatus;
  carrier_name?: string | null;
  shipping_method?: string | null;
  shipping_status?: ShippingStatus;
  tracking_number?: string | null;
  inventory_reservation_status?: InventoryReservationStatus;
  stakeholder_id?: string | null;
  sales_order_id?: string | null;
  invoice_id?: string | null;
  payment_id?: string | null;
  checkout_source?: string | null;
  customer_reference?: string | null;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  inventory_item_id?: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
  reservation_status?: InventoryReservationStatus;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';
export type PaymentStatus = 'pending' | 'authorized' | 'paid' | 'failed' | 'refunded' | 'cancelled';
export type PaymentProvider = 'iyzico' | 'paytr' | 'stripe';
export type ShippingStatus = 'pending' | 'preparing' | 'ready' | 'shipped' | 'delivered' | 'cancelled';
export type InventoryReservationStatus = 'pending' | 'reserved' | 'partial' | 'failed' | 'released';
export type FulfillmentStatus = 'received' | 'preparing' | 'packed' | 'shipped' | 'delivered' | 'completed' | 'cancelled';
export type RefundStatus = 'none' | 'pending' | 'approved' | 'completed' | 'rejected';
export type ShipmentStatus = 'preparing' | 'packed' | 'shipped' | 'delivered' | 'cancelled';
export type ReturnRequestStatus = 'requested' | 'erp_review' | 'approved' | 'rejected' | 'received' | 'closed';
export type ReturnRefundStatus = 'refund_pending' | 'refund_approved' | 'refund_completed' | 'refund_rejected';
export type CustomerNotificationStatus = 'pending' | 'sent' | 'failed' | 'read';

export interface Shipment {
  id: string;
  order_id: string;
  customer_user_id: string | null;
  carrier_name: string | null;
  tracking_number: string | null;
  status: ShipmentStatus;
  shipped_at: string | null;
  delivered_at: string | null;
  notes: string | null;
  created_at: string;
}

export interface FulfillmentHistory {
  id: string;
  order_id: string;
  from_status: FulfillmentStatus | null;
  to_status: FulfillmentStatus;
  description: string | null;
  created_at: string;
}

export interface CustomerNotification {
  id: string;
  order_id: string | null;
  event_type: string;
  title: string;
  message: string | null;
  channel: string;
  status: CustomerNotificationStatus;
  created_at: string;
  read_at: string | null;
}

export interface ReturnRequest {
  id: string;
  order_id: string;
  reason: string;
  status: ReturnRequestStatus;
  refund_status: ReturnRefundStatus;
  requested_at: string;
  reviewed_at: string | null;
  notes: string | null;
}

export interface CustomerOrderDetails extends OrderWithItems {
  shipments: Shipment[];
  fulfillmentHistory: FulfillmentHistory[];
  notifications: CustomerNotification[];
  returnRequests: ReturnRequest[];
}

export interface ShippingMethod {
  id: string;
  name: string;
  code: string;
  description: string | null;
  estimated_days: string | null;
  base_price: number;
  currency: string;
  is_active: boolean;
  sort_order: number;
}

export interface CustomerProfile {
  id?: string;
  auth_user_id?: string;
  customerName: string;
  companyName: string;
  email: string;
  phone: string;
  billingAddress: string;
  shippingAddress: string;
  stakeholder_id?: string | null;
  is_active?: boolean;
}

export interface CheckoutPayload extends CustomerProfile {
  shippingMethod: string;
  paymentProvider: PaymentProvider;
  notes: string;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Beklemede',
  confirmed: 'Onaylandı',
  shipped: 'Kargoda',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

export const FULFILLMENT_STATUS_LABELS: Record<FulfillmentStatus, string> = {
  received: 'Sipariş Alındı',
  preparing: 'Hazırlanıyor',
  packed: 'Paketleniyor',
  shipped: 'Kargoya Verildi',
  delivered: 'Teslim Edildi',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: 'Ödeme Bekliyor',
  authorized: 'Provizyon Alındı',
  paid: 'Ödeme Alındı',
  failed: 'Ödeme Başarısız',
  refunded: 'İade Tamamlandı',
  cancelled: 'İptal Edildi',
};

export const TAX_RATE = 0.20; // 20% KDV
