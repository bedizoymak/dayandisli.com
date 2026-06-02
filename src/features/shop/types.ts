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
export type ShippingStatus = 'pending' | 'preparing' | 'ready' | 'shipped' | 'delivered' | 'cancelled';
export type InventoryReservationStatus = 'pending' | 'reserved' | 'partial' | 'failed' | 'released';

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
  customerName: string;
  companyName: string;
  email: string;
  phone: string;
  billingAddress: string;
  shippingAddress: string;
}

export interface CheckoutPayload extends CustomerProfile {
  shippingMethod: string;
  notes: string;
}

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Beklemede',
  confirmed: 'Onaylandı',
  shipped: 'Kargoda',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

export const TAX_RATE = 0.20; // 20% KDV
