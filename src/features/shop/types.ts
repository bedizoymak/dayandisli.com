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
  customer_name: string;
  company_name: string | null;
  email: string;
  phone: string;
  address: string;
  notes: string | null;
  subtotal: number;
  tax_total: number;
  grand_total: number;
  currency: string;
  payment_method: string;
  created_at: string;
}

export interface OrderItem {
  id: string;
  order_id: string;
  product_id: string | null;
  product_name: string;
  unit_price: number;
  quantity: number;
  line_total: number;
}

export interface OrderWithItems extends Order {
  items: OrderItem[];
}

export type OrderStatus = 'pending' | 'confirmed' | 'shipped' | 'completed' | 'cancelled';

export const ORDER_STATUS_LABELS: Record<OrderStatus, string> = {
  pending: 'Beklemede',
  confirmed: 'Onaylandı',
  shipped: 'Kargoda',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

export const TAX_RATE = 0.20; // 20% KDV
