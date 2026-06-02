import { serve } from "https://deno.land/std/http/server.ts";
import { createClient } from "https://esm.sh/@supabase/supabase-js@2.39.7";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Headers": "authorization, x-client-info, apikey, content-type",
};

type CartItem = {
  productId: string;
  inventoryItemId?: string | null;
  name: string;
  price: number;
  quantity: number;
  currency: string;
};

type CheckoutPayload = {
  customerName: string;
  companyName?: string;
  email: string;
  phone: string;
  billingAddress: string;
  shippingAddress: string;
  shippingMethod: string;
  notes?: string;
  items: CartItem[];
};

function requireEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`${name} is not configured`);
  return value;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function hashText(value: string) {
  let hash = 0;
  for (let index = 0; index < value.length; index += 1) {
    hash = (hash << 5) - hash + value.charCodeAt(index);
    hash |= 0;
  }
  return String(Math.abs(hash));
}

serve(async (req) => {
  if (req.method === "OPTIONS") return new Response(null, { headers: corsHeaders });
  if (req.method !== "POST") return json({ error: "Method not allowed" }, 405);

  const supabaseUrl = requireEnv("SUPABASE_URL");
  const serviceRoleKey = requireEnv("SUPABASE_SERVICE_ROLE_KEY");
  const anonKey = requireEnv("SUPABASE_ANON_KEY");
  const authHeader = req.headers.get("Authorization") ?? "";
  const token = authHeader.replace("Bearer ", "");
  const ipHash = hashText(req.headers.get("x-forwarded-for") ?? "unknown");
  const userAgent = req.headers.get("user-agent") ?? null;

  const authClient = createClient(supabaseUrl, anonKey, { global: { headers: { Authorization: authHeader } } });
  const adminClient = createClient(supabaseUrl, serviceRoleKey);

  const { data: userData, error: userError } = await authClient.auth.getUser(token);
  const user = userData.user;
  if (userError || !user?.id || !user.email) {
    return json({ error: "Sipariş için müşteri girişi gerekli." }, 401);
  }

  const payload = (await req.json()) as CheckoutPayload;
  if (!payload.customerName || !payload.email || !payload.phone || !payload.billingAddress || !payload.shippingAddress || !payload.shippingMethod) {
    return json({ error: "Zorunlu müşteri, adres ve sevkiyat alanları eksik." }, 400);
  }
  if (payload.email.toLowerCase() !== user.email.toLowerCase()) {
    return json({ error: "Sipariş e-postası oturum e-postası ile eşleşmelidir." }, 403);
  }
  if (!Array.isArray(payload.items) || payload.items.length === 0 || payload.items.length > 50) {
    return json({ error: "Sepet içeriği geçersiz." }, 400);
  }

  const since = new Date(Date.now() - 10 * 60 * 1000).toISOString();
  const { count: recentCount } = await adminClient
    .from("commerce_checkout_events")
    .select("id", { count: "exact", head: true })
    .eq("auth_user_id", user.id)
    .gte("created_at", since);

  if ((recentCount ?? 0) >= 5) {
    await adminClient.from("commerce_checkout_events").insert({
      auth_user_id: user.id,
      email: user.email,
      event_type: "checkout_rate_limited",
      ip_hash: ipHash,
      user_agent: userAgent,
    });
    return json({ error: "Çok fazla deneme yapıldı. Lütfen daha sonra tekrar deneyin." }, 429);
  }

  await adminClient.from("commerce_checkout_events").insert({
    auth_user_id: user.id,
    email: user.email,
    event_type: "checkout_started",
    ip_hash: ipHash,
    user_agent: userAgent,
    metadata: { item_count: payload.items.length },
  });

  let orderId: string | null = null;
  try {
    await adminClient.from("shop_customer_profiles").upsert({
      auth_user_id: user.id,
      email: user.email,
      full_name: payload.customerName,
      company_name: payload.companyName || null,
      phone: payload.phone,
      billing_address: payload.billingAddress,
      shipping_address: payload.shippingAddress,
      is_active: true,
    }, { onConflict: "auth_user_id" });

    const subtotal = payload.items.reduce((sum, item) => sum + Number(item.price) * Number(item.quantity), 0);
    const taxTotal = subtotal * 0.2;
    const grandTotal = subtotal + taxTotal;

    const { data: orderNoData } = await adminClient.rpc("generate_order_number");
    const orderNumber = orderNoData || `DYN-${new Date().getFullYear()}-${Math.floor(Math.random() * 9999).toString().padStart(4, "0")}`;

    const productIds = payload.items.map((item) => item.productId);
    const { data: products, error: productsError } = await adminClient
      .from("products")
      .select("id, name, price, currency, stock_quantity, in_stock, inventory_item_id, is_shop_visible")
      .in("id", productIds);
    if (productsError) throw productsError;

    const productById = new Map((products ?? []).map((product) => [product.id, product]));
    for (const item of payload.items) {
      const product = productById.get(item.productId);
      if (!product || product.is_shop_visible === false || !product.in_stock) {
        throw new Error(`${item.name} ürünü satışa uygun değil.`);
      }
      if (Number(product.stock_quantity) < Number(item.quantity)) {
        throw new Error(`${product.name} için yeterli stok yok.`);
      }
    }

    const { data: order, error: orderError } = await adminClient
      .from("orders")
      .insert({
        order_number: orderNumber,
        status: "pending",
        customer_user_id: user.id,
        customer_name: payload.customerName,
        company_name: payload.companyName || null,
        email: user.email,
        phone: payload.phone,
        address: payload.shippingAddress,
        billing_address: payload.billingAddress,
        shipping_address: payload.shippingAddress,
        notes: payload.notes || null,
        subtotal,
        tax_total: taxTotal,
        grand_total: grandTotal,
        currency: "TRY",
        payment_method: "erp_review",
        payment_status: "pending",
        shipping_method: payload.shippingMethod,
        shipping_status: "pending",
        inventory_reservation_status: "pending",
        checkout_source: "public_shop_edge",
        customer_reference: user.id,
      })
      .select("*")
      .single();
    if (orderError || !order) throw orderError || new Error("Order could not be created");
    orderId = order.id;

    for (const item of payload.items) {
      const product = productById.get(item.productId);
      const quantity = Number(item.quantity);
      const unitPrice = Number(product.price);
      const { data: orderItem, error: itemError } = await adminClient
        .from("order_items")
        .insert({
          order_id: order.id,
          product_id: item.productId,
          inventory_item_id: product.inventory_item_id ?? item.inventoryItemId ?? null,
          product_name: product.name,
          unit_price: unitPrice,
          quantity,
          line_total: unitPrice * quantity,
          reservation_status: "pending",
        })
        .select("*")
        .single();
      if (itemError || !orderItem) throw itemError || new Error("Order item could not be created");

      if (product.inventory_item_id) {
        const { data: inventoryRow, error: inventoryError } = await adminClient
          .from("inventory_items")
          .select("id, current_stock")
          .eq("id", product.inventory_item_id)
          .single();
        if (inventoryError || !inventoryRow) throw inventoryError || new Error("Inventory item not found");
        if (Number(inventoryRow.current_stock) < quantity) throw new Error(`${product.name} için ERP stoku yetersiz.`);

        const { error: stockError } = await adminClient
          .from("inventory_items")
          .update({ current_stock: Number(inventoryRow.current_stock) - quantity })
          .eq("id", product.inventory_item_id);
        if (stockError) throw stockError;

        await adminClient.from("shop_inventory_reservations").insert({
          order_id: order.id,
          order_item_id: orderItem.id,
          product_id: item.productId,
          inventory_item_id: product.inventory_item_id,
          quantity,
          status: "reserved",
        });

        await adminClient.from("order_items").update({ reservation_status: "reserved" }).eq("id", orderItem.id);
      }
    }

    await adminClient.from("orders").update({ inventory_reservation_status: "reserved" }).eq("id", order.id);
    await adminClient.from("commerce_checkout_events").insert({
      auth_user_id: user.id,
      email: user.email,
      event_type: "order_confirmation_email_pending",
      ip_hash: ipHash,
      user_agent: userAgent,
      order_id: order.id,
      metadata: { order_number: order.order_number },
    });
    await adminClient.from("commerce_checkout_events").insert({
      auth_user_id: user.id,
      email: user.email,
      event_type: "checkout_completed",
      ip_hash: ipHash,
      user_agent: userAgent,
      order_id: order.id,
    });

    return json({ order });
  } catch (error) {
    console.error("Commerce checkout failed:", error);
    if (orderId) {
      const { data: rollbackOrder } = await adminClient
        .from("orders")
        .select("sales_order_id")
        .eq("id", orderId)
        .maybeSingle();
      const { data: reservations } = await adminClient
        .from("shop_inventory_reservations")
        .select("id, inventory_item_id, quantity")
        .eq("order_id", orderId)
        .eq("status", "reserved");
      for (const reservation of reservations ?? []) {
        if (reservation.inventory_item_id) {
          const { data: inventoryRow } = await adminClient
            .from("inventory_items")
            .select("current_stock")
            .eq("id", reservation.inventory_item_id)
            .single();
          if (inventoryRow) {
            await adminClient
              .from("inventory_items")
              .update({ current_stock: Number(inventoryRow.current_stock) + Number(reservation.quantity) })
              .eq("id", reservation.inventory_item_id);
          }
        }
        await adminClient
          .from("shop_inventory_reservations")
          .update({ status: "released", reason: "checkout_rollback", released_at: new Date().toISOString() })
          .eq("id", reservation.id);
      }
      await adminClient.from("orders").delete().eq("id", orderId);
      if (rollbackOrder?.sales_order_id) {
        await adminClient.from("sales_orders").delete().eq("id", rollbackOrder.sales_order_id);
      }
    }
    await adminClient.from("commerce_checkout_events").insert({
      auth_user_id: user.id,
      email: user.email,
      event_type: "checkout_failed",
      ip_hash: ipHash,
      user_agent: userAgent,
      order_id: orderId,
      metadata: { error: error instanceof Error ? error.message : String(error) },
    });
    return json({ error: "Sipariş talebi güvenli şekilde oluşturulamadı." }, 500);
  }
});
