import { supabase } from '@/integrations/supabase/client';
import { Product, ProductWithImages, ProductImage, Order, OrderItem, OrderWithItems, ShippingMethod, CartItem, CheckoutPayload, TAX_RATE, CustomerNotification, CustomerOrderDetails, FulfillmentHistory, ReturnRequest, Shipment, PaymentProvider } from './types';

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

export function applyProductStructuredMetadata(product: ProductWithImages) {
  document.title = `${product.name} | Dayan Dişli Mağaza`;
  setMeta("description", product.description || `${product.name} ürün detayları ve stok durumu.`);
  setMeta("og:title", product.name, "property");
  setMeta("og:description", product.description || `${product.name} ürün detayları.`, "property");
  if (product.primary_image) setMeta("og:image", product.primary_image, "property");
  setJsonLd("commerce-product-jsonld", {
    "@context": "https://schema.org",
    "@type": "Product",
    name: product.name,
    sku: product.sku,
    image: product.primary_image ? [product.primary_image] : undefined,
    description: product.description,
    offers: {
      "@type": "Offer",
      price: product.price,
      priceCurrency: product.currency,
      availability: product.in_stock ? "https://schema.org/InStock" : "https://schema.org/OutOfStock",
    },
  });
}

export function applyCategoryStructuredMetadata(category?: string) {
  const title = category ? `${category} | Dayan Dişli Mağaza` : "Mağaza | Dayan Dişli";
  document.title = title;
  setMeta("description", category ? `${category} kategorisindeki Dayan Dişli ürünleri.` : "Dayan Dişli ürün kataloğu.");
}

function setMeta(name: string, content: string, key: "name" | "property" = "name") {
  let element = document.querySelector(`meta[${key}="${name}"]`) as HTMLMetaElement | null;
  if (!element) {
    element = document.createElement("meta");
    element.setAttribute(key, name);
    document.head.appendChild(element);
  }
  element.content = content;
}

function setJsonLd(id: string, payload: unknown) {
  let element = document.getElementById(id) as HTMLScriptElement | null;
  if (!element) {
    element = document.createElement("script");
    element.id = id;
    element.type = "application/ld+json";
    document.head.appendChild(element);
  }
  element.textContent = JSON.stringify(payload);
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
  const { data, error } = await supabase.functions.invoke("commerce-checkout", {
    body: { ...payload, items },
  }) as unknown as { data: { order: Order } | null; error: Error | null };

  if (error || !data?.order) {
    console.error("Checkout function error:", error);
    throw error || new Error("Checkout function failed");
  }

  return { order: data.order, salesOrderId: data.order.sales_order_id ?? null, conversionError: null };
}

export async function createPaymentSession(orderId: string, provider: PaymentProvider) {
  const { data, error } = await supabase.functions.invoke("payment-create", {
    body: {
      orderId,
      provider,
      callbackUrl: `${window.location.origin}/checkout/success`,
    },
  }) as unknown as {
    data: { paymentUrl: string | null; providerPaymentId: string; provider: PaymentProvider } | null;
    error: Error | null;
  };

  if (error || !data) {
    console.error("Payment session error:", error);
    throw error || new Error("Payment session failed");
  }

  return data;
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
  if (!authData.user?.id) return [];

  const { data, error } = await supabase
    .from('orders')
    .select('*')
    .eq('customer_user_id', authData.user.id)
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

export async function fetchCustomerOrderDetails(orderId: string): Promise<CustomerOrderDetails | null> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user?.id) return null;

  const { data: order, error: orderError } = await supabase
    .from('orders')
    .select('*')
    .eq('id', orderId)
    .eq('customer_user_id', authData.user.id)
    .maybeSingle() as unknown as { data: Order | null; error: Error | null };

  if (orderError || !order) {
    console.error('Error fetching customer order details:', orderError);
    return null;
  }

  const [itemsResult, shipmentsResult, historyResult, notificationsResult, returnsResult] = await Promise.all([
    supabase.from('order_items').select('*').eq('order_id', orderId),
    supabase.from('shop_shipments' as never).select('*').eq('order_id' as never, orderId as never).order('created_at', { ascending: false }),
    supabase.from('shop_fulfillment_history' as never).select('*').eq('order_id' as never, orderId as never).order('created_at', { ascending: true }),
    supabase.from('shop_customer_notifications' as never).select('*').eq('order_id' as never, orderId as never).order('created_at', { ascending: false }),
    supabase.from('shop_return_requests' as never).select('*').eq('order_id' as never, orderId as never).order('created_at', { ascending: false }),
  ]) as unknown as [
    { data: OrderItem[] | null; error: Error | null },
    { data: Shipment[] | null; error: Error | null },
    { data: FulfillmentHistory[] | null; error: Error | null },
    { data: CustomerNotification[] | null; error: Error | null },
    { data: ReturnRequest[] | null; error: Error | null },
  ];

  for (const result of [itemsResult, shipmentsResult, historyResult, notificationsResult, returnsResult]) {
    if (result.error) console.error('Error fetching customer order child records:', result.error);
  }

  return {
    ...order,
    items: itemsResult.data || [],
    shipments: shipmentsResult.data || [],
    fulfillmentHistory: historyResult.data || [],
    notifications: notificationsResult.data || [],
    returnRequests: returnsResult.data || [],
  };
}

export async function fetchCustomerNotifications(): Promise<CustomerNotification[]> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user?.id) return [];

  const { data, error } = await supabase
    .from('shop_customer_notifications' as never)
    .select('*')
    .eq('customer_user_id' as never, authData.user.id as never)
    .order('created_at', { ascending: false })
    .limit(50) as unknown as { data: CustomerNotification[] | null; error: Error | null };

  if (error) {
    console.error('Error fetching customer notifications:', error);
    return [];
  }

  return data || [];
}

export async function createCustomerReturnRequest(orderId: string, reason: string): Promise<ReturnRequest> {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user?.id) throw new Error('Müşteri oturumu gerekli.');

  const { data, error } = await supabase
    .from('shop_return_requests' as never)
    .insert({
      order_id: orderId,
      customer_user_id: authData.user.id,
      reason,
      status: 'requested',
      refund_status: 'refund_pending',
    } as never)
    .select('*')
    .single() as unknown as { data: ReturnRequest | null; error: Error | null };

  if (error || !data) {
    console.error('Return request error:', error);
    throw error || new Error('İade talebi oluşturulamadı.');
  }

  return data;
}

export async function signUpCustomer(email: string, password: string, fullName: string) {
  return supabase.auth.signUp({
    email,
    password,
    options: { data: { full_name: fullName } },
  });
}

export async function signInCustomer(email: string, password: string) {
  return supabase.auth.signInWithPassword({ email, password });
}

export async function signOutCustomer() {
  return supabase.auth.signOut();
}

export async function getCurrentCustomerProfile() {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user?.id) return null;

  const { data, error } = await supabase
    .from("shop_customer_profiles" as never)
    .select("*")
    .eq("auth_user_id" as never, authData.user.id as never)
    .maybeSingle() as unknown as {
      data: {
        id: string;
        auth_user_id: string;
        email: string;
        full_name: string;
        company_name: string | null;
        phone: string | null;
        billing_address: string | null;
        shipping_address: string | null;
        stakeholder_id: string | null;
        is_active: boolean;
      } | null;
      error: Error | null;
    };

  if (error) {
    console.error("Customer profile fetch error:", error);
    return null;
  }

  if (!data) {
    return {
      auth_user_id: authData.user.id,
      customerName: authData.user.user_metadata?.full_name || "",
      companyName: "",
      email: authData.user.email || "",
      phone: "",
      billingAddress: "",
      shippingAddress: "",
      stakeholder_id: null,
      is_active: true,
    };
  }

  return {
    id: data.id,
    auth_user_id: data.auth_user_id,
    customerName: data.full_name,
    companyName: data.company_name || "",
    email: data.email,
    phone: data.phone || "",
    billingAddress: data.billing_address || "",
    shippingAddress: data.shipping_address || "",
    stakeholder_id: data.stakeholder_id,
    is_active: data.is_active,
  };
}

export async function upsertCustomerProfile(profile: CheckoutPayload) {
  const { data: authData } = await supabase.auth.getUser();
  if (!authData.user?.id || !authData.user.email) throw new Error("Müşteri oturumu gerekli.");

  const { data, error } = await supabase
    .from("shop_customer_profiles" as never)
    .upsert({
      auth_user_id: authData.user.id,
      email: authData.user.email,
      full_name: profile.customerName,
      company_name: profile.companyName || null,
      phone: profile.phone || null,
      billing_address: profile.billingAddress || null,
      shipping_address: profile.shippingAddress || null,
      is_active: true,
    } as never, { onConflict: "auth_user_id" })
    .select("*")
    .single() as unknown as { data: unknown; error: Error | null };

  if (error) throw error;
  return data;
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
