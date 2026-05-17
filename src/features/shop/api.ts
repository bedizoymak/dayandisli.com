import { supabase } from '@/integrations/supabase/client';
import { Product, ProductWithImages, ProductImage, Order, OrderItem, OrderWithItems } from './types';

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
    .from('products' as never)
    .select('*, product_images(*)', { count: 'exact' });

  // Apply filters
  if (options?.category) {
    queryBuilder = queryBuilder.eq('category', options.category);
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

// Fetch single product by slug
export async function fetchProductBySlug(slug: string): Promise<ProductWithImages | null> {
  const { data, error } = await supabase
    .from('products' as never)
    .select('*, product_images(*)')
    .eq('slug', slug)
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
    .from('products' as never)
    .select('*, product_images(*)')
    .eq('category', category)
    .neq('id', excludeId)
    .eq('in_stock', true)
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

// Fetch all unique categories
export async function fetchCategories(): Promise<string[]> {
  const { data, error } = await supabase
    .from('products' as never)
    .select('category')
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
  const { data, error } = await supabase.rpc('generate_order_number' as never) as unknown as {
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
    .from('orders' as never)
    .insert({
      ...orderData,
      order_number: orderNumber,
    } as never)
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
    .from('order_items' as never)
    .insert(orderItems as never) as unknown as { error: Error | null };

  if (itemsError) {
    console.error('Error creating order items:', itemsError);
    // Note: Order is already created, so we don't throw here
  }

  return order;
}

// Fetch orders (for admin)
export async function fetchOrders(limit = 50, offset = 0): Promise<{ orders: Order[]; count: number }> {
  const { data, error, count } = await supabase
    .from('orders' as never)
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

// Fetch single order with items
export async function fetchOrderWithItems(orderId: string): Promise<OrderWithItems | null> {
  const { data: order, error: orderError } = await supabase
    .from('orders' as never)
    .select('*')
    .eq('id', orderId)
    .maybeSingle() as unknown as { data: Order | null; error: Error | null };

  if (orderError || !order) {
    console.error('Error fetching order:', orderError);
    return null;
  }

  const { data: items, error: itemsError } = await supabase
    .from('order_items' as never)
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
    .from('orders' as never)
    .update({ status } as never)
    .eq('id', orderId) as unknown as { error: Error | null };

  if (error) {
    console.error('Error updating order status:', error);
    throw error;
  }
}
