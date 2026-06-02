import { supabase } from '@/integrations/supabase/client';
import { Product, ProductWithImages, ProductImage, Order, OrderItem, OrderWithItems, ShippingMethod, CartItem, CheckoutPayload, TAX_RATE } from './types';

export type ShopCategory = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  is_active: boolean;
  sort_order: number;
};

// Fetch all products with their primary images
export async function fetchProducts(options?: {
  category?: string;
  inStockOnly?: boolean;
  search?: string;
  sortBy?: 'newest' | 'price_asc' | 'price_desc';
  limit?: number;
  offset?: number;
}): Promise<{ products: ProductWithImages[]; count: number }> {
  // Build query dynamically based on options
  let queryBuilder = supabase
    .from('products')
    .select('*, product_images(*)', { count: 'exact' })
    .eq('is_shop_visible', true);

  // Apply filters
  if (options?.category) {
    const uuidLike = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i.test(options.category);
    if (uuidLike) {
      queryBuilder = queryBuilder.eq('shop_category_id', options.category);
    } else {
      const { data: shopCategory } = await supabase
        .from('shop_categories' as never)
        .select('id')
        .eq('is_active' as never, true as never)
        .or(`slug.eq.${options.category},name.eq.${options.category}`)
        .maybeSingle() as unknown as { data: { id: string } | null; error: Error | null };

      queryBuilder = shopCategory?.id
        ? queryBuilder.or(`category.eq.${options.category},shop_category_id.eq.${shopCategory.id}`)
        : queryBuilder.eq('category', options.category);
    }
  }

  if (options?.inStockOnly) {
    queryBuilder = queryBuilder.eq('in_stock', true);
  }

  if (options?.search) {
    const searchTerm = `%${options.search}%`;
    queryBuilder = queryBuilder.or(`name.ilike.${searchTerm},sku.ilike.${searchTerm},category.ilike.${searchTerm}`);
  }

  // Apply sorting
  switch (options?.sortBy) {
    case 'price_asc':
      queryBuilder = queryBuilder.order('price', { ascending: true });
      break;
    case 'price_desc':
      queryBuilder = queryBuilder.order('price', { ascending: false });
      break;
    case 'newest':
    default:
      queryBuilder = queryBuilder.order('created_at', { ascending: false });
      break;
  }

  // Apply pagination
  if (options?.limit !== undefined && options?.offset !== undefined) {
    queryBuilder = queryBuilder.range(options.offset, options.offset + options.limit - 1);
  }

  const { data, error, count } = await queryBuilder as unknown as { 
    data: (Product & { product_images: ProductImage[] })[] | null; 
    count: number | null; 
    error: Error | null 
  };

  if (error) {
    console.error('Error fetching products:', error);
    throw error;
  }

  const products: ProductWithImages[] = (data || []).map((p) => ({
    ...p,
    images: p.product_images || [],
    primary_image: p.product_images?.find((img: ProductImage) => img.is_primary)?.image_url ||
                   p.product_images?.[0]?.image_url,
  }));

  return { products, count: count || 0 };
}

export function getAvailability(product: Pick<Product, 'in_stock' | 'stock_quantity'>) {
  if (!product.in_stock || product.stock_quantity <= 0) {
    return { status: 'out_of_stock' as const, label: 'Stokta Yok' };
  }
  if (product.stock_quantity <= 5) {
    return { status: 'low_stock' as const, label: `Son ${product.stock_quantity} Adet` };
  }
  return { status: 'available' as const, label: 'Stokta Var' };
}

// Fetch single product by slug
export async function fetchProductBySlug(slug: string): Promise<ProductWithImages | null> {
  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('slug', slug)
    .eq('is_shop_visible', true)
    .maybeSingle() as unknown as { 
      data: (Product & { product_images: ProductImage[] }) | null; 
      error: Error | null 
    };

  if (error) {
    console.error('Error fetching product:', error);
    throw error;
  }

  if (!data) return null;

  return {
    ...data,
    images: data.product_images || [],
    primary_image: data.product_images?.find((img) => img.is_primary)?.image_url ||
                   data.product_images?.[0]?.image_url,
  };
}

// Fetch related products (same category, excluding current)
export async function fetchRelatedProducts(category: string | null, excludeId: string, limit = 4): Promise<ProductWithImages[]> {
  if (!category) return [];

  const { data, error } = await supabase
    .from('products')
    .select('*, product_images(*)')
    .eq('category', category)
    .neq('id', excludeId)
    .eq('in_stock', true)
    .eq('is_shop_visible', true)
    .limit(limit) as unknown as { 
      data: (Product & { product_images: ProductImage[] })[] | null; 
      error: Error | null 
    };

  if (error) {
    console.error('Error fetching related products:', error);
    return [];
  }

  return (data || []).map((p) => ({
    ...p,
    images: p.product_images || [],
    primary_image: p.product_images?.find((img) => img.is_primary)?.image_url ||
                   p.product_images?.[0]?.image_url,
  }));
}

// Fetch public shipping method foundation
export async function fetchShippingMethods(): Promise<ShippingMethod[]> {
  const { data, error } = await supabase
    .from('shop_shipping_methods' as never)
    .select('*')
    .eq('is_active' as never, true as never)
    .order('sort_order', { ascending: true }) as unknown as {
      data: ShippingMethod[] | null;
      error: Error | null;
    };

  if (error) {
    console.error('Error fetching shipping methods:', error);
    return [];
  }

  return data || [];
}

// Fetch all unique categories
export async function fetchCategories(): Promise<string[]> {
  const { data: shopCategories, error: categoryError } = await supabase
    .from('shop_categories' as never)
    .select('id, name, slug, description, is_active, sort_order')
    .eq('is_active' as never, true as never)
    .order('sort_order', { ascending: true }) as unknown as {
      data: ShopCategory[] | null;
      error: Error | null;
    };

  if (!categoryError && shopCategories?.length) {
    return shopCategories.map((category) => category.slug || category.name);
  }

  const { data, error } = await supabase
    .from('products')
    .select('category')
    .eq('is_shop_visible', true)
    .not('category', 'is', null) as unknown as { 
      data: { category: string }[] | null; 
      error: Error | null 
    };

  if (error) {
    console.error('Error fetching categories:', error);
    return [];
  }

  const categories = [...new Set((data || []).map((p) => p.category))];
  return categories.filter(Boolean) as string[];
}

// Generate order number
export async function generateOrderNumber(): Promise<string> {
  const { data, error } = await supabase.rpc('generate_order_number') as unknown as {
    data: string | null;
    error: Error | null;
  };

  if (error || !data) {
    console.error('Error generating order number:', error);
    // Fallback: generate client-side
    const year = new Date().getFullYear();
    const random = Math.floor(Math.random() * 9999).toString().padStart(4, '0');
    return `DYN-${year}-${random}`;
  }

  return data;
}

// Create order with items
export async function createOrder(
  orderData: Omit<Order, 'id' | 'order_number' | 'created_at'>,
  items: Omit<OrderItem, 'id' | 'order_id'>[]
): Promise<Order> {
  // Generate order number first
  const orderNumber = await generateOrderNumber();

  // Insert order
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .insert({
      ...orderData,
      order_number: orderNumber,
    })
    .select()
    .single() as unknown as { data: Order | null; error: Error | null };

  if (orderError || !order) {
    console.error('Error creating order:', orderError);
    throw orderError || new Error('Failed to create order');
  }

  // Insert order items
  const orderItems = items.map((item) => ({
    ...item,
    order_id: order.id,
  }));

  const { error: itemsError } = await supabase
    .from('order_items')
    .insert(orderItems) as unknown as { error: Error | null };

  if (itemsError) {
    console.error('Error creating order items:', itemsError);
    // Note: Order is already created, so we don't throw here
  }

  return order;
}

export async function createCheckoutOrder(payload: CheckoutPayload, items: CartItem[]) {
  const { data: authData } = await supabase.auth.getUser();
  const subtotal = items.reduce((sum, item) => sum + item.price * item.quantity, 0);
  const taxAmount = subtotal * TAX_RATE;
  const total = subtotal + taxAmount;

  const order = await createOrder(
    {
      status: 'pending',
      customer_user_id: authData.user?.id ?? null,
      customer_name: payload.customerName,
      company_name: payload.companyName || null,
      email: payload.email,
      phone: payload.phone,
      address: payload.shippingAddress || payload.billingAddress,
      billing_address: payload.billingAddress,
      shipping_address: payload.shippingAddress || payload.billingAddress,
      notes: payload.notes || null,
      subtotal,
      tax_total: taxAmount,
      grand_total: total,
      currency: 'TRY',
      payment_method: 'erp_review',
      payment_status: 'pending',
      shipping_method: payload.shippingMethod,
      shipping_status: 'pending',
      inventory_reservation_status: 'pending',
      checkout_source: 'public_shop',
      customer_reference: payload.email,
    },
    items.map((item) => ({
      product_id: item.productId,
      inventory_item_id: item.inventoryItemId ?? null,
      product_name: item.name,
      unit_price: item.price,
      quantity: item.quantity,
      line_total: item.price * item.quantity,
      reservation_status: 'pending',
    }))
  );

  return { order, salesOrderId: order.sales_order_id ?? null, conversionError: null };
}

// Fetch orders (for admin)
export async function fetchOrders(limit = 50, offset = 0): Promise<{ orders: Order[]; count: number }> {
  const { data, error, count } = await supabase
    .from('orders')
    .select('*', { count: 'exact' })
    .order('created_at', { ascending: false })
    .range(offset, offset + limit - 1) as unknown as { 
      data: Order[] | null; 
      count: number | null;
      error: Error | null 
    };

  if (error) {
    console.error('Error fetching orders:', error);
    throw error;
  }

  return { orders: data || [], count: count || 0 };
}

export async function fetchCustomerOrders(email?: string): Promise<Order[]> {
  const { data: authData } = await supabase.auth.getUser();
  const customerEmail = authData.user?.email || email;
  if (!customerEmail) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('email', customerEmail)
    .order('created_at', { ascending: false })
    .limit(25) as unknown as {
      data: Order[] | null;
      error: Error | null;
    };

  if (error) {
    console.error('Error fetching customer orders:', error);
    return [];
  }

  return data || [];
}

// Fetch single order with items
export async function fetchOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .maybeSingle() as unknown as { data: Order | null; error: Error | null };

  if (orderError || !order) {
    console.error('Error fetching order:', orderError);
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from('order_items')
    .select('*')
    .eq('order_id', orderId) as unknown as { data: OrderItem[] | null; error: Error | null };

  if (itemsError) {
    console.error('Error fetching order items:', itemsError);
  }

  return {
    ...order,
    items: items || [],
  };
}

// Update order status
export async function updateOrderStatus(orderId: string, status: string): Promise<void> {
  const { error } = await supabase
    .from('orders')
    .update({ status })
    .eq('id', orderId) as unknown as { error: Error | null };

  if (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
}
